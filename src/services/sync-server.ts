import { ipcMain } from 'electron';
import { getDb } from './database';
import { getValidAccessToken } from './oauth-server';
import { syncGmail, AuthError } from './gmail-sync';
import { syncCalendar } from './calendar-sync';
import { runCorrelation } from './correlation-engine';
import type { SyncResult } from './gmail-sync';
import type { CorrelationResult } from './correlation-engine';
import type { RunAllSyncResult } from '@/types';

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

type StepResult<T> = { ok: true; value: T } | { ok: false; error: string };

async function runStep<T>(
  label: string,
  fn: (db: ReturnType<typeof getDb>) => Promise<T>,
): Promise<StepResult<T>> {
  try {
    return { ok: true, value: await withRetry(label, fn) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[sync:runAll] ${label} failed: ${message}\n`);
    return { ok: false, error: message };
  }
}

export async function runAllSync(): Promise<RunAllSyncResult> {
  process.stderr.write('[sync:runAll] Starting full sync (gmail + calendar + correlation)\n');

  const gmailStep = await runStep('gmail', (d) => syncGmail(d, getToken));
  const calendarStep = await runStep('calendar', (d) => syncCalendar(d, getToken));
  const correlationStep = await runStep('correlation', (d) => runCorrelation(d, getConnectedEmail()));

  return {
    gmail: gmailStep.ok ? gmailStep.value : null,
    calendar: calendarStep.ok ? calendarStep.value : null,
    correlation: correlationStep.ok ? correlationStep.value : null,
    errors: [gmailStep, calendarStep, correlationStep]
      .filter((s): s is { ok: false; error: string } => !s.ok)
      .map((s) => s.error),
  };
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

  ipcMain.handle('sync:runAll', async (): Promise<RunAllSyncResult> => {
    return runAllSync();
  });
}
