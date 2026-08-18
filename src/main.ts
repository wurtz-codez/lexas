import 'dotenv/config';
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { initDatabase, closeDatabase } from './services/database';
import { registerAuthHandlers } from './services/oauth-server';
import { registerOnboardingHandlers } from './services/onboarding-server';
import { registerSyncHandlers } from './services/sync-server';
import { registerBriefHandlers } from './services/brief-server';
import { registerFeedbackHandlers } from './services/feedback-server';
import { registerCalendarHandlers } from './services/calendar-server';

if (started) {
  app.quit();
}

app.on('ready', () => {
  initDatabase();
  registerAuthHandlers();
  registerOnboardingHandlers();
  registerSyncHandlers();
  registerBriefHandlers();
  registerFeedbackHandlers();
  registerCalendarHandlers();
  createWindow();
});

app.on('will-quit', () => {
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.openDevTools();
}
