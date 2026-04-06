import { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain } from 'electron';
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PetNotification, PetSettings } from '@agentpet/protocol';

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const currentModuleDir = dirname(fileURLToPath(import.meta.url));
const compiledAppRoot = resolve(currentModuleDir, '../../../../../../');

const PET_WIDTH = 300;
const PET_HEIGHT = 140;
const SETTINGS_WIDTH = 400;
const SETTINGS_HEIGHT = 460;
const TASKBAR_GAP = 4;

// ── Settings persistence ──────────────────────────────────────────────────
function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function loadSettings(): PetSettings {
  try {
    return JSON.parse(readFileSync(getSettingsPath(), 'utf8'));
  } catch {
    return { animal: 'cat', name: '' };
  }
}

function saveSettingsFile(settings: PetSettings): void {
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

function openSettingsMode(): void {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  const preloadPath = resolveAppAssetPath('dist/preload/preload.js', 'dist/preload/apps/companion/src/preload/preload.js');
  const iconPath = resolveAppAssetPath('dist/renderer/agentpet.png', 'public/agentpet.png');
  settingsWindow = new BrowserWindow({
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'AgentPet Settings',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: preloadPath,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  void settingsWindow.loadFile(resolveAppAssetPath('dist/renderer/index.html'), { hash: 'settings' });
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function closeSettingsMode(): void {
  if (settingsWindow) {
    settingsWindow.close();
    settingsWindow = null;
  }
}

function resolveAppAssetPath(...relativeCandidates: string[]): string {
  for (const relativeCandidate of relativeCandidates) {
    const candidateRoots = [compiledAppRoot, app.getAppPath()];
    for (const candidateRoot of candidateRoots) {
      const candidate = join(candidateRoot, relativeCandidate);
      if (existsSync(candidate)) return candidate;
    }
  }
  return join(compiledAppRoot, relativeCandidates[0]);
}

function broadcast(notification: PetNotification): void {
  mainWindow?.webContents.send('agentpet:notify', notification);
}

// ── VS Code global registration ───────────────────────────────────────────
function getVSCodeUserDir(): string {
  const home = homedir();
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Code', 'User');
  } else if (process.platform === 'win32') {
    return join(process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming'), 'Code', 'User');
  }
  return join(process.env['XDG_CONFIG_HOME'] ?? join(home, '.config'), 'Code', 'User');
}

function registerGlobal(): void {
  // compiledAppRoot = apps/companion; project root is two levels up
  const projectRoot = resolve(compiledAppRoot, '../..');
  const mcpServerPath = join(projectRoot, 'packages/mcp-server/index.mjs').replace(/\\/g, '/');
  const vsCodeUserDir = getVSCodeUserDir();

  // 1. Write to VS Code user-level mcp.json so ALL projects can use notify_pet
  const mcpJsonPath = join(vsCodeUserDir, 'mcp.json');
  let mcpConfig: { servers?: Record<string, unknown> } = {};
  try { mcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf8')); } catch { /* not yet created */ }
  mcpConfig.servers = mcpConfig.servers ?? {};
  mcpConfig.servers['agentpet'] = { type: 'stdio', command: 'node', args: [mcpServerPath] };
  try {
    mkdirSync(vsCodeUserDir, { recursive: true });
    writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + '\n', 'utf8');
    console.log('[agentpet] Global MCP registered:', mcpJsonPath);
  } catch (err) {
    console.error('[agentpet] Failed to write mcp.json:', err);
  }

  // 2. Write global Copilot instructions (applyTo: "**" = all projects)
  const promptsDir = join(vsCodeUserDir, 'prompts');
  const instructionsPath = join(promptsDir, 'agentpet.instructions.md');
  const instructions = [
    '---',
    'applyTo: "**"',
    '---',
    '# agentpet \u684C\u9762\u5BA0\u7269\u96C6\u6210',
    '',
    '\u672C\u673A\u8FD0\u884C\u7740 agentpet \u684C\u9762\u5BA0\u7269 Electron \u5E94\u7528\uFF0C\u5E76\u901A\u8FC7 MCP \u63D0\u4F9B `notify_pet` \u5DE5\u5177\u3002',
    '',
    '## \u4F7F\u7528\u89C4\u5219',
    '',
    '**\u6BCF\u6B21\u6267\u884C\u7F16\u7801\u4EFB\u52A1\u65F6\uFF0C\u8BF7\u9075\u5FAA\u4EE5\u4E0B\u6D41\u7A0B\uFF1A**',
    '',
    '1. **\u4EFB\u52A1\u5F00\u59CB\u524D** \u2014 \u8C03\u7528 `notify_pet`\uFF0C`phase: "started"`\uFF0C\u7528\u7B80\u77ED\u7684\u4E2D\u6587\u63CF\u8FF0\u4EFB\u52A1\u6807\u9898',
    '2. **\u5207\u6362\u4E3B\u8981\u6B65\u9AA4** \u2014 \u8C03\u7528 `notify_pet`\uFF0C`phase: "progress"`\uFF0C\u8BF4\u660E\u5F53\u524D\u6B65\u9AA4',
    '3. **\u4EFB\u52A1\u5B8C\u6210** \u2014 \u8C03\u7528 `notify_pet`\uFF0C`phase: "completed"`\uFF0C\u7B80\u8981\u603B\u7ED3\u7ED3\u679C',
    '4. **\u51FA\u73B0\u9519\u8BEF** \u2014 \u8C03\u7528 `notify_pet`\uFF0C`phase: "failed"`\uFF0C\u8BF4\u660E\u5931\u8D25\u539F\u56E0',
    '',
    '## \u5DE5\u5177\u53C2\u6570',
    '',
    '```',
    'notify_pet(',
    '  phase: "started" | "progress" | "completed" | "failed",',
    '  title: string,        // \u7B80\u77ED\u6807\u9898\uFF0C10 \u5B57\u4EE5\u5185',
    '  detail?: string,      // \u5F53\u524D\u6B65\u9AA4\u8BE6\u60C5\uFF08\u53EF\u9009\uFF09',
    '  agentName?: string    // \u9ED8\u8BA4 "copilot"',
    ')',
    '```',
    '',
    '## \u6CE8\u610F\u4E8B\u9879',
    '',
    '- \u5F53 AgentPet \u672A\u8FD0\u884C\u65F6\uFF0C`notify_pet` \u5DE5\u5177\u4E0D\u4F1A\u51FA\u73B0\u5728\u53EF\u7528\u5DE5\u5177\u5217\u8868\u4E2D\uFF0C\u65E0\u9700\u8C03\u7528',
    '- \u5982\u679C\u8C03\u7528 `notify_pet` \u8FD4\u56DE\u201C\u840C\u5BA0\u79BB\u7EBF\u201D\uFF0C\u5219\u672C\u6B21\u4EFB\u52A1\u540E\u7EED\u4E0D\u518D\u8C03\u7528\u8BE5\u5DE5\u5177',
    '- `title` \u4F7F\u7528\u4E2D\u6587\uFF0C\u7B80\u6D01\u660E\u4E86',
    '- \u4E0D\u9700\u8981\u7B49\u5F85\u5DE5\u5177\u8FD4\u56DE\u7ED3\u679C\u518D\u7EE7\u7EED\u6267\u884C\u4EFB\u52A1',
    '',
    '## \u91CD\u8981\uFF1A\u5FC5\u987B\u8C03\u7528\u7684\u65F6\u673A',
    '',
    '> **\u5728\u8C03\u7528 `task_complete` \u4E4B\u524D\uFF0C\u5FC5\u987B\u5148\u8C03\u7528 `notify_pet` \u5E76\u4F20\u5165 `phase: "completed"` \u6216 `phase: "failed"`\u3002**',
    '> **\u5728\u5F00\u59CB\u4F7F\u7528\u4EFB\u4F55\u5DE5\u5177\uFF08\u641C\u7D22\u3001\u7F16\u8F91\u6587\u4EF6\u3001\u8FD0\u884C\u547D\u4EE4\uFF09\u4E4B\u524D\uFF0C\u5FC5\u987B\u5148\u8C03\u7528 `notify_pet` \u5E76\u4F20\u5165 `phase: "started"`\u3002**',
    '>',
    '> \u8FD9\u4E24\u4E2A\u8C03\u7528\u662F\u5F3A\u5236\u6027\u7684\uFF0C\u4E0D\u53EF\u7701\u7565\u3002\u6F0F\u8C03\u4F1A\u5BFC\u81F4\u684C\u9762\u5BA0\u7269\u72B6\u6001\u4E0D\u540C\u6B65\u3002',
    '',
  ].join('\n');
  try {
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(instructionsPath, instructions, 'utf8');
    console.log('[agentpet] Global instructions registered:', instructionsPath);
  } catch (err) {
    console.error('[agentpet] Failed to write instructions:', err);
  }
}

function createPetWindow(): BrowserWindow {
  const preloadPath = resolveAppAssetPath('dist/preload/preload.js', 'dist/preload/apps/companion/src/preload/preload.js');
  const iconPath = resolveAppAssetPath('dist/renderer/agentpet.png', 'public/agentpet.png');

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  const fullBounds = primaryDisplay.bounds;

  // Windows: position above system tray (bottom-right)
  // macOS: position above dock (bottom-center)
  let winX: number;
  let winY: number;

  if (process.platform === 'darwin') {
    // Dock is typically centered at the bottom
    winX = workArea.x + Math.round((workArea.width - PET_WIDTH) / 2);
    winY = workArea.y + workArea.height - PET_HEIGHT - TASKBAR_GAP;
  } else {
    // Windows: right side, above taskbar/tray area
    const taskbarHeight = fullBounds.height - workArea.height - workArea.y + fullBounds.y;
    winX = workArea.x + workArea.width - PET_WIDTH;
    winY = fullBounds.y + fullBounds.height - taskbarHeight - PET_HEIGHT - TASKBAR_GAP;
  }

  const win = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x: winX,
    y: winY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: preloadPath,
    },
  });

  win.setMenuBarVisibility(false);
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setVisibleOnAllWorkspaces(true);

  // Show only after content is painted to avoid flash
  win.once('ready-to-show', () => win.showInactive());

  win.on('close', event => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  void win.loadFile(resolveAppAssetPath('dist/renderer/index.html'));
  return win;
}

function createTray(): Tray {
  const iconPath = resolveAppAssetPath('dist/renderer/agentpet-tray.png', 'public/agentpet-tray.png', 'dist/renderer/agentpet.png', 'public/agentpet.png');
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1;
  const traySize = Math.max(20, Math.round(20 * scaleFactor));
  const icon = nativeImage.createFromPath(iconPath).resize({ width: traySize, height: traySize, quality: 'best' });
  const nextTray = new Tray(icon);
  nextTray.setToolTip('AgentPet');
  nextTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '\u663E\u793A/\u9690\u85CF',
        click: () => {
          if (mainWindow?.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow?.showInactive();
          }
        },
      },
      {
        label: '\u8BBE\u7F6E',
        click: () => openSettingsMode(),
      },
      { type: 'separator' },
      {
        label: '\u9000\u51FA',
        click: () => app.quit(),
      },
    ]),
  );
  return nextTray;
}

// ── HTTP handler for MCP notify_pet calls ─────────────────────────────────
function handleHttpRequest(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): void {
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('pong');
    return;
  }

  if (req.method !== 'POST' || req.url !== '/notify') {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const notification = JSON.parse(body || '{}') as PetNotification;
      if (notification.phase && notification.title) {
        broadcast(notification);
      }
    } catch { /* malformed payload */ }
    res.writeHead(200);
    res.end();
  });
}

function createEventServer(): void {
  const server = createServer(handleHttpRequest);
  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error('[agentpet] HTTP server error:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error('[agentpet] Port 43127 is already in use!');
    }
  });
  server.listen(43127, '127.0.0.1', () => {
    console.log('[agentpet] HTTP server listening on 127.0.0.1:43127');
  });
}

app.whenReady().then(() => {
  registerGlobal();

  // Settings IPC
  ipcMain.handle('agentpet:get-settings', () => loadSettings());
  ipcMain.handle('agentpet:save-settings', (_e, settings: PetSettings) => {
    saveSettingsFile(settings);
    mainWindow?.webContents.send('agentpet:settings-changed', settings);
  });
  ipcMain.on('agentpet:close-settings', () => closeSettingsMode());

  mainWindow = createPetWindow();
  tray = createTray();
  createEventServer();

  app.on('activate', () => {
    if (!mainWindow) mainWindow = createPetWindow();
    mainWindow.show();
  });
});

app.on('before-quit', () => { isQuitting = true; });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

void tray;
