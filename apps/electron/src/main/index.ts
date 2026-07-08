import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';

const CONTROL_PLANE_HTTP_URL = process.env.CONTROL_PLANE_HTTP_URL ?? 'http://localhost:8787';
const CONTROL_PLANE_WS_URL = process.env.CONTROL_PLANE_WS_URL ?? 'ws://localhost:8787/ws/electron';

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

ipcMain.handle('crowcode:get-config', () => ({
  controlPlaneHttpUrl: CONTROL_PLANE_HTTP_URL,
  controlPlaneWsUrl: CONTROL_PLANE_WS_URL,
}));

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
