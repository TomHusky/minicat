import { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain } from 'electron';
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
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
const SETTINGS_WIDTH = 380;
const SETTINGS_HEIGHT = 420;
const TASKBAR_GAP = 4;
const DEFAULT_SETTINGS: PetSettings = { animal: 'cat', name: '', copilotListenerEnabled: true };
const GLOBAL_INSTRUCTIONS_FRONTMATTER = ['---', 'applyTo: "**"', '---', ''].join('\n');
const FALLBACK_INSTRUCTIONS_BODY = [
  '# agentpet 桌面宠物集成',
  '',
  '本项目运行着一个 agentpet 桌面宠物 Electron 应用，并通过 MCP 服务器提供 `notify_pet` 工具。',
  '',
  '## 使用规则',
  '',
  '**每次对话开始执行编码任务时，请遵循以下流程：**',
  '',
  '0. **首次调用前（每次对话必须执行一次）** — 使用 `tool_search` 搜索 `mcp_agentpet_notify_pet` 以加载该延迟工具。这是强制步骤，不可跳过。如果搜索结果中没有该工具，说明宠物离线，后续无需调用。',
  '1. **任务开始前** — 调用 `notify_pet`，`phase: "started"`，用简短的中文描述任务标题',
  '2. **切换主要步骤** — 调用 `notify_pet`，`phase: "progress"`，说明当前步骤',
  '3. **任务完成** — 调用 `notify_pet`，`phase: "completed"`，简要总结结果',
  '4. **出现错误** — 调用 `notify_pet`，`phase: "failed"`，说明失败原因',
  '',
  '## 工具参数',
  '',
  '```',
  'notify_pet(',
  '  phase: "started" | "progress" | "completed" | "failed",',
  '  title: string,        // 简短标题，10 字以内',
  '  detail?: string,      // 当前步骤详情（可选）',
  '  agentName?: string    // 默认 "copilot"',
  ')',
  '```',
  '',
  '## 注意事项',
  '',
  '- 当 AgentPet 桌面宠物未运行时，`notify_pet` 工具不会出现在可用工具列表中，无需调用',
  '- 如果调用 `notify_pet` 返回“萌宠离线”，则本次任务后续不再调用该工具',
  '- `title` 使用中文，简洁明了',
  '- 不需要等待工具返回结果再继续执行任务',
  '',
  '## 重要：必须调用的时机',
  '',
  '> **在调用 `task_complete` 之前，必须先调用 `notify_pet` 并传入 `phase: "completed"` 或 `phase: "failed"`。**',
  '> **在开始使用任何工具（搜索、编辑文件、运行命令）之前，必须先调用 `notify_pet` 并传入 `phase: "started"`。**',
  '>',
  '> 这两个调用是强制性的，不可省略。漏调会导致桌面宠物状态不同步。',
  '',
].join('\n');

// ── Settings persistence ──────────────────────────────────────────────────
function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function normalizeSettings(raw: unknown): PetSettings {
  const parsed = raw && typeof raw === 'object' ? raw as Partial<PetSettings> : {};
  return {
    animal: parsed.animal === 'lobster' ? 'lobster' : 'cat',
    name: typeof parsed.name === 'string' ? parsed.name : '',
    copilotListenerEnabled: typeof parsed.copilotListenerEnabled === 'boolean'
      ? parsed.copilotListenerEnabled
      : DEFAULT_SETTINGS.copilotListenerEnabled,
  };
}

function loadSettings(): PetSettings {
  try {
    return normalizeSettings(JSON.parse(readFileSync(getSettingsPath(), 'utf8')));
  } catch {
    return DEFAULT_SETTINGS;
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

function getProjectRoot(): string {
  return resolve(compiledAppRoot, '../..');
}

function getInstructionsLinkPath(): string {
  return join(getVSCodeUserDir(), 'prompts', 'agentpet.instructions.md');
}

function getManagedInstructionsSourcePath(): string {
  return join(app.getPath('userData'), 'agentpet.instructions.md');
}

function resolveInstructionsTemplatePath(): string | null {
  const candidates = [
    join(getProjectRoot(), '.github', 'copilot-instructions.md'),
    join(app.getAppPath(), '.github', 'copilot-instructions.md'),
    join(resolve(app.getAppPath(), '..'), '.github', 'copilot-instructions.md'),
    join(resolve(app.getAppPath(), '../..'), '.github', 'copilot-instructions.md'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function toGlobalPromptContent(content: string): string {
  const normalized = content.replace(/^\uFEFF/, '').trim();
  if (normalized.startsWith('---')) {
    return `${normalized}\n`;
  }
  return `${GLOBAL_INSTRUCTIONS_FRONTMATTER}${normalized}\n`;
}

function ensureManagedInstructionsSourceFile(): string {
  const sourcePath = getManagedInstructionsSourcePath();
  const templatePath = resolveInstructionsTemplatePath();
  const rawContent = templatePath
    ? readFileSync(templatePath, 'utf8')
    : FALLBACK_INSTRUCTIONS_BODY;

  writeFileSync(sourcePath, toGlobalPromptContent(rawContent), 'utf8');
  return sourcePath;
}

function disableCopilotInstructionsLink(): void {
  const linkPath = getInstructionsLinkPath();
  rmSync(linkPath, { force: true });
}

function enableCopilotInstructionsLink(): void {
  const linkPath = getInstructionsLinkPath();
  const promptsDir = dirname(linkPath);
  const sourcePath = ensureManagedInstructionsSourceFile();

  mkdirSync(promptsDir, { recursive: true });
  disableCopilotInstructionsLink();

  try {
    copyFileSync(sourcePath, linkPath);
    console.log('[agentpet] Global instructions copied:', linkPath, '<-', sourcePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`复制 VS Code 全局指令文件失败：${message}`);
  }
}

function syncCopilotInstructionsLink(enabled: boolean): void {
  if (enabled) {
    enableCopilotInstructionsLink();
    return;
  }

  disableCopilotInstructionsLink();
  console.log('[agentpet] Global instructions link removed:', getInstructionsLinkPath());
}

function registerGlobal(): void {
  const projectRoot = getProjectRoot();
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
        label: '显示/隐藏',
        click: () => {
          if (mainWindow?.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow?.showInactive();
          }
        },
      },
      {
        label: '设置',
        click: () => openSettingsMode(),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit(),
      },
    ]),
  );
  return nextTray;
}

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
  req.on('data', chunk => { body += String(chunk); });
  req.on('end', () => {
    try {
      const notification = JSON.parse(body || '{}') as PetNotification;
      if (notification.phase && notification.title) {
        broadcast(notification);
      }
    } catch {
      // malformed payload
    }
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
  const initialSettings = loadSettings();

  try {
    syncCopilotInstructionsLink(initialSettings.copilotListenerEnabled);
  } catch (error) {
    console.error('[agentpet] Failed to sync Copilot instructions link on startup:', error);
  }

  // Settings IPC
  ipcMain.handle('agentpet:get-settings', () => loadSettings());
  ipcMain.handle('agentpet:save-settings', (_e, settings: PetSettings) => {
    const previousSettings = loadSettings();
    const nextSettings = normalizeSettings(settings);

    syncCopilotInstructionsLink(nextSettings.copilotListenerEnabled);

    try {
      saveSettingsFile(nextSettings);
    } catch (error) {
      syncCopilotInstructionsLink(previousSettings.copilotListenerEnabled);
      throw error;
    }

    mainWindow?.webContents.send('agentpet:settings-changed', nextSettings);
    settingsWindow?.webContents.send('agentpet:settings-changed', nextSettings);
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
