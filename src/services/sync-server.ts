import { ipcMain } from 'electron';
import { getDb } from './database';
import { getValidAccessToken } from './oauth-server';
import { syncGmail, AuthError } from './gmail-sync';
import { syncCalendar } from './calendar-sync';
import type { SyncResult } from './gmail-sync';

function getToken() {
  return getValidAccessToken('google');
}

async function withRetry<T>(label: string, fn: (db: ReturnType<typeof getDb>) => Promise<T>): Promise<T> {
  const db = getDb();
  try {
    return await fn(db);
  } catch (err) {
    if (err instanceof AuthError) {
      process.stderr.write(`[${label}] Token expired mid-sync, refreshing and retrying once\n`);
      return await fn(db);
    }
    throw err;
  }
}

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:gmail', async (): Promise<SyncResult> => {
    process.stderr.write('[sync:gmail] Starting Gmail sync\n');
    return withRetry('sync:gmail', (db) => syncGmail(db, getToken));
  });

  ipcMain.handle('sync:calendar', async (): Promise<SyncResult> => {
    process.stderr.write('[sync:calendar] Starting Calendar sync\n');
    return withRetry('sync:calendar', (db) => syncCalendar(db, getToken));
  });
}
