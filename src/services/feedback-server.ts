import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import { getDb } from './database';
import type { FeedbackType } from '@/types';

const FEEDBACK_TYPES: FeedbackType[] = ['important', 'not_important', 'dismissed'];

// Feedback is an APPEND-ONLY LOG keyed to the MAIL (synced_item_id), NOT the
// transient brief row — so "already reviewed" survives brief regeneration.
// thumbs-up -> thumbs-down keeps both rows; only a row identical to the latest
// one is suppressed (no consecutive duplicates).
// IMPORTANT: any future code that reads feedback to answer "what is the current
// signal on this item?" MUST take the latest row per synced_item_id
// (ORDER BY created_at DESC / id DESC LIMIT 1), never treat the table as a set
// of independent rows, and never count all rows as separate votes.

function isValidFeedbackType(type: unknown): type is FeedbackType {
  return typeof type === 'string' && (FEEDBACK_TYPES as string[]).includes(type);
}

export function submitFeedback(
  db: Database.Database,
  syncedItemId: number,
  type: unknown,
): void {
  if (!Number.isInteger(syncedItemId)) {
    throw new Error('feedback:submit requires an integer syncedItemId');
  }

  if (!isValidFeedbackType(type)) {
    throw new Error(
      `feedback:submit invalid type "${String(type)}". Expected one of: ${FEEDBACK_TYPES.join(', ')}`,
    );
  }

  const exists = db.prepare('SELECT id FROM synced_items WHERE id = ?').get(syncedItemId) as
    | { id: number }
    | undefined;

  if (!exists) {
    throw new Error(`feedback:submit synced_item_id ${syncedItemId} does not exist`);
  }

  const latest = db.prepare(
    'SELECT feedback_type FROM feedback WHERE synced_item_id = ? ORDER BY id DESC LIMIT 1',
  ).get(syncedItemId) as { feedback_type: string } | undefined;

  if (latest && latest.feedback_type === type) {
    process.stderr.write(
      `[feedback:submit] Duplicate consecutive feedback ignored for synced_item_id=${syncedItemId}\n`,
    );
    return;
  }

  db.prepare('INSERT INTO feedback (synced_item_id, feedback_type) VALUES (?, ?)').run(
    syncedItemId,
    type,
  );
}

export function registerFeedbackHandlers(): void {
  ipcMain.handle('feedback:submit', (_event, syncedItemId: number, type: unknown): void => {
    process.stderr.write(
      `[feedback:submit] synced_item_id=${syncedItemId} type=${JSON.stringify(type)}\n`,
    );
    submitFeedback(getDb(), syncedItemId, type);
  });
}
