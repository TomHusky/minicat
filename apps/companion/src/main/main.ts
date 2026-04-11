import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserWindow as BrowserWindowInstance, Tray as TrayInstance } from 'electron';
import type { PetNotification, PetSettings } from '@agentpet/protocol';

// Use createRequire to avoid the ESM cjsPreparseModuleExports crash in Node.js 22 / Electron 41
const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, powerMonitor } =
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
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

void tray;
