import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

interface CrowcodeConfig {
  controlPlaneHttpUrl: string;
  controlPlaneWsUrl: string;
}

const DEFAULT_CONFIG: CrowcodeConfig = {
  controlPlaneHttpUrl: process.env.CONTROL_PLANE_HTTP_URL ?? 'http://localhost:8787',
  controlPlaneWsUrl: process.env.CONTROL_PLANE_WS_URL ?? 'ws://localhost:8787/ws/electron',
};

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

/**
 * Packaged builds have no .env -- persisted userData settings (set via the
 * in-app settings screen) let a distributed executable point at any
 * control-plane, not just localhost. Falls back to env vars / defaults
 * (the dev-mode path) when nothing's been saved yet.
 */
function loadConfig(): CrowcodeConfig {
  if (!existsSync(settingsPath())) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(settingsPath(), 'utf8')) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: CrowcodeConfig): void {
  writeFileSync(settingsPath(), JSON.stringify(config, null, 2));
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

ipcMain.handle('crowcode:get-config', () => loadConfig());

ipcMain.handle('crowcode:set-config', (_event, config: CrowcodeConfig) => {
  saveConfig(config);
  return config;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
