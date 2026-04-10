import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserWindow as BrowserWindowInstance, Tray as TrayInstance } from 'electron';
import type { PetNotification, PetSettings } from '@agentpet/protocol';

// Use createRequire to avoid the ESM cjsPreparseModuleExports crash in Node.js 22 / Electron 41
const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, powerMonitor, shell } =
  createRequire(import.meta.url)('electron') as typeof import('electron');

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

let mainWindow: BrowserWindowInstance | null = null;
let settingsWindow: BrowserWindowInstance | null = null;
let tray: TrayInstance | null = null;
let isQuitting = false;
let userActivityMonitorTimer: NodeJS.Timeout | null = null;
let activeTaskLeaseTimer: NodeJS.Timeout | null = null;
let isUserActive = true;
const currentModuleDir = dirname(fileURLToPath(import.meta.url));
const compiledAppRoot = resolve(currentModuleDir, '../../../../../../');

const PET_WIDTH = 300;
const PET_HEIGHT = 192;
const SETTINGS_WIDTH = 380;
const SETTINGS_HEIGHT = 420;
const TASKBAR_GAP = 4;
const USER_IDLE_THRESHOLD_SECONDS = 60;
const USER_IDLE_POLL_INTERVAL_MS = 5000;
const ACTIVE_TASK_LEASE_MS = 2 * 60 * 1000;
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
  '1. **任务开始前** — 直接调用 agentpet 的 `notify_pet` 工具，传入 `phase: "started"`，用简短中文描述任务标题。不要先搜索工具名。',
  '2. **切换主要步骤** — 调用 `notify_pet`，`phase: "progress"`，说明当前步骤。',
  '3. **长任务持续汇报** — 如果连续搜索、读文件、运行多步命令、等待较久或持续编码超过 30-60 秒，必须再次调用 `notify_pet` 并传入 `phase: "progress"`，更新当前步骤，不能只在开始时通知一次。',
  '4. **任务完成** — 调用 `notify_pet`，`phase: "completed"`，简要总结结果。',
  '5. **出现错误** — 调用 `notify_pet`，`phase: "failed"`，说明失败原因。',
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
  '- 如果当前会话没有看到 `notify_pet` 工具，说明 MCP 尚未加载或当前环境不可用，此时无需反复重试。',
  '- 如果调用 `notify_pet` 返回“萌宠离线”，则本次任务后续无需再调用该工具。',
  '- `title` 使用中文，简洁明了。',
  '- 不需要等待工具返回结果再继续执行任务。',
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
    copilotListenerEnabled: DEFAULT_SETTINGS.copilotListenerEnabled,
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

function clearActiveTaskLease(): void {
  if (!activeTaskLeaseTimer) {
    return;
  }

  clearTimeout(activeTaskLeaseTimer);
  activeTaskLeaseTimer = null;
}

function scheduleActiveTaskLease(): void {
  clearActiveTaskLease();
  activeTaskLeaseTimer = setTimeout(() => {
    activeTaskLeaseTimer = null;
    console.log('[agentpet] Active task lease expired, resetting pet to idle');
    broadcast({
      phase: 'idle',
      title: '',
      detail: '长时间未收到 Copilot Chat 更新，已自动恢复待机。',
      agentName: 'agentpet',
    });
  }, ACTIVE_TASK_LEASE_MS);
}

function handleNotification(notification: PetNotification): void {
  if (notification.phase === 'started' || notification.phase === 'progress') {
    scheduleActiveTaskLease();
  } else {
    clearActiveTaskLease();
  }

  broadcast(notification);
}

function detectIsUserActive(): boolean {
  return powerMonitor.getSystemIdleTime() < USER_IDLE_THRESHOLD_SECONDS;
}

function broadcastUserActivity(active: boolean): void {
  mainWindow?.webContents.send('agentpet:user-activity-changed', active);
}

function syncUserActivity(force = false): void {
  const nextIsUserActive = detectIsUserActive();
  if (!force && nextIsUserActive === isUserActive) {
    return;
  }

  isUserActive = nextIsUserActive;
  broadcastUserActivity(isUserActive);
}

function startUserActivityMonitor(): void {
  stopUserActivityMonitor();
  syncUserActivity(true);
  userActivityMonitorTimer = setInterval(() => {
    syncUserActivity();
  }, USER_IDLE_POLL_INTERVAL_MS);
}

function stopUserActivityMonitor(): void {
  if (!userActivityMonitorTimer) {
    return;
  }

  clearInterval(userActivityMonitorTimer);
  userActivityMonitorTimer = null;
}

function getAppIconPath(): string {
  return resolveAppAssetPath(
    'dist/renderer/agentpet.png',
    'public/agentpet.png',
    'dist/renderer/agentpet-tray.png',
    'public/agentpet-tray.png',
  );
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

function getLegacyInstructionsPath(): string {
  return join(getVSCodeUserDir(), 'prompts', 'agentpet.instructions.md');
}

function getInstructionsTargetPath(): string {
  return join(homedir(), '.copilot', 'instructions', 'agentpet.instructions.md');
}

function getManagedInstructionsSourcePath(): string {
  return join(app.getPath('userData'), 'agentpet.instructions.md');
}

function resolveInstructionsTemplatePath(): string | null {
  const candidates = [
    resolveAppAssetPath('dist/renderer/copilot-instructions.md', 'apps/companion/public/copilot-instructions.md'),
    join(getProjectRoot(), 'apps/companion/public/copilot-instructions.md'),
    join(app.getAppPath(), 'public', 'copilot-instructions.md'),
    join(resolve(app.getAppPath(), '..'), 'public', 'copilot-instructions.md'),
    join(resolve(app.getAppPath(), '../..'), 'public', 'copilot-instructions.md'),
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
  rmSync(getInstructionsTargetPath(), { force: true });
  rmSync(getLegacyInstructionsPath(), { force: true });
}

function enableCopilotInstructionsLink(): void {
  const sourcePath = ensureManagedInstructionsSourceFile();
  const targetPath = getInstructionsTargetPath();
  disableCopilotInstructionsLink();

  try {
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
    console.log('[agentpet] Global instructions copied:', targetPath, '<-', sourcePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`复制 VS Code 全局指令文件失败（${targetPath}）：${message}`);
  }
}

function getVSCodeSettingsPath(): string {
  return join(getVSCodeUserDir(), 'settings.json');
}

const VSCODE_INSTRUCTIONS_SETTING_KEY = 'github.copilot.chat.codeGeneration.instructions';

function syncVSCodeInstructionsSetting(enabled: boolean): void {
  const settingsPath = getVSCodeSettingsPath();
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {
    if (!enabled) return;
  }

  const instructionsEntry = { file: getInstructionsTargetPath() };
  const existing = Array.isArray(settings[VSCODE_INSTRUCTIONS_SETTING_KEY])
    ? (settings[VSCODE_INSTRUCTIONS_SETTING_KEY] as Array<{ file?: string }>)
    : [];

  const filtered = existing.filter(e => e?.file !== getInstructionsTargetPath());

  if (enabled) {
    settings[VSCODE_INSTRUCTIONS_SETTING_KEY] = [...filtered, instructionsEntry];
  } else if (filtered.length > 0) {
    settings[VSCODE_INSTRUCTIONS_SETTING_KEY] = filtered;
  } else {
    delete settings[VSCODE_INSTRUCTIONS_SETTING_KEY];
  }

  try {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    console.log(`[agentpet] VS Code instructions setting ${enabled ? 'registered' : 'removed'}:`, settingsPath);
  } catch (err) {
    console.error('[agentpet] Failed to update VS Code settings.json:', err);
  }
}

function syncCopilotInstructionsLink(enabled: boolean): void {
  if (enabled) {
    enableCopilotInstructionsLink();
    syncVSCodeInstructionsSetting(true);
    return;
  }

  disableCopilotInstructionsLink();
  syncVSCodeInstructionsSetting(false);
  console.log('[agentpet] Global instructions removed:', [getInstructionsTargetPath(), getLegacyInstructionsPath()].join(', '));
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
  mcpConfig.servers['agentpet'] = { type: 'stdio', command: 'node', args: [mcpServerPath], toolApprovalRequired: false };
  try {
    mkdirSync(vsCodeUserDir, { recursive: true });
    writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + '\n', 'utf8');
    console.log('[agentpet] Global MCP registered:', mcpJsonPath);
  } catch (err) {
    console.error('[agentpet] Failed to write mcp.json:', err);
  }
}

function unregisterGlobal(): void {
  const vsCodeUserDir = getVSCodeUserDir();
  const mcpJsonPath = join(vsCodeUserDir, 'mcp.json');
  try {
    const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf8')) as { servers?: Record<string, unknown> };
    if (mcpConfig.servers?.['agentpet']) {
      delete mcpConfig.servers['agentpet'];
      if (Object.keys(mcpConfig.servers).length === 0) {
        delete mcpConfig.servers;
      }
      writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + '\n', 'utf8');
      console.log('[agentpet] Global MCP unregistered:', mcpJsonPath);
    }
  } catch {
    // mcp.json doesn't exist or can't be parsed — nothing to clean up
  }
}

function createPetWindow(): BrowserWindowInstance {
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

function createTray(): TrayInstance {
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
        handleNotification(notification);
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
  if (!hasSingleInstanceLock) {
    return;
  }

  if (process.platform === 'darwin') {
    app.dock?.hide();
  }

  registerGlobal();
  const initialSettings = loadSettings();

  try {
    syncCopilotInstructionsLink(true);
  } catch (error) {
    console.error('[agentpet] Failed to sync Copilot instructions link on startup:', error);
  }

  // Settings IPC
  ipcMain.handle('agentpet:get-settings', () => loadSettings());
  ipcMain.handle('agentpet:get-user-activity', () => isUserActive);
  ipcMain.handle('agentpet:save-settings', (_e, settings: PetSettings) => {
    const nextSettings = normalizeSettings(settings);

    try {
      saveSettingsFile(nextSettings);
    } catch (error) {
      throw error;
    }

    mainWindow?.webContents.send('agentpet:settings-changed', nextSettings);
    settingsWindow?.webContents.send('agentpet:settings-changed', nextSettings);
  });
  ipcMain.on('agentpet:close-settings', () => closeSettingsMode());
  ipcMain.handle('agentpet:open-config-file', (_e, key: string) => {
    const paths: Record<string, string> = {
      'settings.json': join(getVSCodeUserDir(), 'settings.json'),
      'instructions': getInstructionsTargetPath(),
    };
    const target = paths[key];
    if (target && existsSync(target)) {
      return shell.openPath(target);
    }
    return Promise.resolve(`文件不存在: ${target ?? key}`);
  });

  mainWindow = createPetWindow();
  tray = createTray();
  createEventServer();
  startUserActivityMonitor();

  app.on('activate', () => {
    if (!mainWindow) mainWindow = createPetWindow();
    mainWindow.show();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.showInactive();
  }

  if (settingsWindow) {
    settingsWindow.focus();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopUserActivityMonitor();
  clearActiveTaskLease();

  try {
    syncCopilotInstructionsLink(false);
  } catch (error) {
    console.error('[agentpet] Failed to remove Copilot instructions link on quit:', error);
  }

  try {
    unregisterGlobal();
  } catch (error) {
    console.error('[agentpet] Failed to unregister global MCP on quit:', error);
  }
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

void tray;
