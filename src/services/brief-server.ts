import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import { getDb } from './database';
import { generateBrief } from './context-engine';
import type { BriefResult } from './context-engine';
import type { BriefDetail, BriefItemDetail } from '@/types';

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
};

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
    WHERE bi.brief_id = ?
    ORDER BY bi.rank ASC
  `).all(brief.id) as BriefItemRow[];

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
  }));

  return { ...brief, items };
}

export function registerBriefHandlers(): void {
  ipcMain.handle('brief:generate', async (_event, date: string): Promise<BriefResult> => {
    process.stderr.write(`[brief:generate] Generating brief for ${date}\n`);
    const db = getDb();
    return generateBrief(db, date);
  });

  ipcMain.handle('brief:getLatest', async (): Promise<BriefDetail | null> => {
    process.stderr.write('[brief:getLatest] Fetching most recent brief\n');
    return getLatestBrief(getDb());
  });
}
