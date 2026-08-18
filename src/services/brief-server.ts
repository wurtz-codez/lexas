import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import { getDb } from './database';
import { generateBrief } from './context-engine';
import type { BriefResult } from './context-engine';
import type { BriefDetail, BriefItemDetail, FeedbackType, SuggestedAction } from '@/types';

type BriefItemRow = {
  brief_item_id: number;
  rank: number;
  reason: string | null;
  score: number | null;
  synced_item_id: number;
  source: string;
  title: string | null;
  snippet: string | null;
  sender_email: string | null;
  occurred_at: string | null;
  ends_at: string | null;
  person_id: number | null;
  person_name: string | null;
  person_email: string | null;
  person_is_vip: number | null;
  project_id: number | null;
  project_name: string | null;
  suggested_action: string | null;
};

type FeedbackRow = {
  synced_item_id: number;
  feedback_type: string;
  created_at: string;
};

function parseSuggestedAction(raw: string | null): SuggestedAction | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SuggestedAction;
    if (
      typeof parsed.proposed_title !== 'string' ||
      typeof parsed.proposed_start !== 'string' ||
      typeof parsed.proposed_end !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getLatestBrief(db: Database.Database): BriefDetail | null {
  const brief = db.prepare(
    'SELECT id, brief_date, generated_at FROM briefs ORDER BY brief_date DESC, id DESC LIMIT 1',
  ).get() as { id: number; brief_date: string; generated_at: string } | undefined;

  if (!brief) return null;

  const rows = db.prepare(`
    SELECT
      bi.id AS brief_item_id,
      bi.rank,
      bi.reason,
      bi.score,
      bi.suggested_action,
      si.id AS synced_item_id,
      si.source,
      si.title,
      si.snippet,
      si.sender_email,
      si.occurred_at,
      si.ends_at,
      p.id AS person_id,
      p.name AS person_name,
      p.email AS person_email,
      p.is_vip AS person_is_vip,
      pr.id AS project_id,
      pr.name AS project_name
    FROM brief_items bi
    JOIN synced_items si ON si.id = bi.synced_item_id
    LEFT JOIN people p ON p.id = si.person_id
    LEFT JOIN projects pr ON pr.id = si.project_id
    WHERE bi.brief_id = ? AND si.source = 'email'
    ORDER BY bi.rank ASC
  `).all(brief.id) as BriefItemRow[];

  const itemIds = rows.map((r) => r.synced_item_id);
  const feedbackByItem = new Map<number, { type: FeedbackType; created_at: string }>();
  if (itemIds.length > 0) {
    // Append-only log keyed to the mail (synced_item_id), so it survives brief
    // regeneration. Fetch all feedback for these items ordered newest-first and
    // keep the FIRST row per synced_item_id (= the latest). Avoids GROUP BY
    // bare-column selection, which SQLite does not guarantee. Deliberately not
    // MAX(id) in SQL so the pick-latest logic is unit-testable with a mock db.
    const feedbackRows = db.prepare(`
      SELECT synced_item_id, feedback_type, created_at
      FROM feedback
      WHERE synced_item_id IN (${itemIds.map(() => '?').join(',')})
      ORDER BY id DESC
    `).all(...itemIds) as FeedbackRow[];

    for (const f of feedbackRows) {
      if (!feedbackByItem.has(f.synced_item_id)) {
        feedbackByItem.set(f.synced_item_id, {
          type: f.feedback_type as FeedbackType,
          created_at: f.created_at,
        });
      }
    }
  }

  const items: BriefItemDetail[] = rows.map((r) => ({
    id: r.brief_item_id,
    synced_item_id: r.synced_item_id,
    rank: r.rank,
    reason: r.reason,
    score: r.score,
    item: {
      source: r.source as 'email' | 'calendar',
      title: r.title,
      snippet: r.snippet,
      sender_email: r.sender_email,
      occurred_at: r.occurred_at,
      ends_at: r.ends_at,
    },
    person:
      r.person_id !== null && r.person_name !== null
        ? {
            id: r.person_id,
            name: r.person_name,
            email: r.person_email,
            is_vip: r.person_is_vip === 1,
          }
        : null,
    project:
      r.project_id !== null && r.project_name !== null
        ? { id: r.project_id, name: r.project_name }
        : null,
    feedback: feedbackByItem.get(r.synced_item_id) ?? null,
    suggested_action: parseSuggestedAction(r.suggested_action),
  }));

  return { ...brief, items };
}

export function registerBriefHandlers(): void {
  ipcMain.handle('brief:generate', async (_event, date: string, tzOffsetMinutes: number): Promise<BriefResult> => {
    process.stderr.write(`[brief:generate] Generating brief for ${date} (tz offset ${tzOffsetMinutes})\n`);
    const db = getDb();
    return generateBrief(db, date, tzOffsetMinutes);
  });

  ipcMain.handle('brief:getLatest', async (): Promise<BriefDetail | null> => {
    process.stderr.write('[brief:getLatest] Fetching most recent brief\n');
    return getLatestBrief(getDb());
  });
}
