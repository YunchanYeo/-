import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let backendProc = null;

function tryStartBackend() {
  // dev 모드(electron + vite)에서는 보통 백엔드를 사용자가 별도 실행
  if (process.env.ELECTRON_START_URL) return;
  if (backendProc && !backendProc.killed) return;

  const backendDir = path.resolve(__dirname, '..', '..', 'backend');
  const backendPkg = path.join(backendDir, 'package.json');
  if (!fs.existsSync(backendPkg)) return;

  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  backendProc = spawn(cmd, ['run', 'start'], {
    cwd: backendDir,
    stdio: 'ignore',
    detached: false,
  });
  backendProc.on('exit', () => {
    backendProc = null;
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.ELECTRON_START_URL || '';
  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // vite build 输出到 ../dist
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

app.whenReady().then(() => {
  tryStartBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      tryStartBackend();
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProc && !backendProc.killed) {
    try {
      backendProc.kill();
    } catch {
      /* ignore */
    }
  }
});

