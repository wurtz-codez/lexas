import { ipcMain } from 'electron';
import { getDb } from './database';
import { getValidAccessToken } from './oauth-server';
import { syncGmail, AuthError } from './gmail-sync';
import { syncCalendar } from './calendar-sync';
import { runCorrelation } from './correlation-engine';
import type { SyncResult } from './gmail-sync';
import type { CorrelationResult } from './correlation-engine';

function getToken() {
  return getValidAccessToken('google');
}

function getConnectedEmail(): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT email FROM auth_tokens WHERE provider = ?',
  ).get('google') as { email: string | null } | undefined;
  return row?.email ?? null;
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

async function runSyncThenCorrelate<T>(syncFn: () => Promise<T>): Promise<T> {
  const db = getDb();
  const result = await syncFn();
  await runCorrelation(db, getConnectedEmail());
  return result;
}

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:gmail', async (): Promise<SyncResult> => {
    process.stderr.write('[sync:gmail] Starting Gmail sync\n');
    return withRetry('sync:gmail', (db) => runSyncThenCorrelate(() => syncGmail(db, getToken)));
  });

  ipcMain.handle('sync:calendar', async (): Promise<SyncResult> => {
    process.stderr.write('[sync:calendar] Starting Calendar sync\n');
    return withRetry('sync:calendar', (db) => runSyncThenCorrelate(() => syncCalendar(db, getToken)));
  });

  ipcMain.handle('sync:correlate', async (): Promise<CorrelationResult> => {
    process.stderr.write('[sync:correlate] Manual correlation triggered\n');
    const db = getDb();
    return runCorrelation(db, getConnectedEmail());
  });
}
