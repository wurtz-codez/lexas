import { describe, it, expect, vi } from 'vitest';
import type Database from 'better-sqlite3';

type Row = {
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

function createMockDb(setup: {
  brief?: { id: number; brief_date: string; generated_at: string } | null;
  rows?: Row[];
}): Database.Database {
  const prepare = vi.fn().mockImplementation((sql: string) => {
    const trimmed = sql.trim();

    if (trimmed.includes('FROM briefs')) {
      return { get: vi.fn(() => setup.brief ?? undefined) };
    }

    if (trimmed.includes('FROM brief_items bi')) {
      return { all: vi.fn(() => setup.rows ?? []) };
    }

    return { get: vi.fn(() => undefined), all: vi.fn(() => []), run: vi.fn() };
  });

  return { prepare } as unknown as Database.Database;
}

describe('getLatestBrief', () => {
  it('returns null when no brief exists', async () => {
    const db = createMockDb({ brief: null });

    const { getLatestBrief } = await import('../brief-server');
    expect(getLatestBrief(db)).toBeNull();
  });

  it('returns nested brief detail with joined person/project', async () => {
    const db = createMockDb({
      brief: { id: 9, brief_date: '2026-07-21', generated_at: '2026-07-21T08:00:00Z' },
      rows: [
        {
          brief_item_id: 11, rank: 1, reason: 'Budget deadline', score: 0.95,
          synced_item_id: 1, source: 'email', title: 'Q3 Budget Review',
          snippet: 'Review by Friday', sender_email: 'ceo@company.com',
          occurred_at: '2026-07-21T09:00:00Z', ends_at: null,
          person_id: 3, person_name: 'Rahul', person_email: 'rahul@company.com', person_is_vip: 1,
          project_id: 5, project_name: 'Budget Planning',
        },
        {
          brief_item_id: 12, rank: 2, reason: 'Standup', score: 0.6,
          synced_item_id: 2, source: 'calendar', title: 'Team Standup',
          snippet: null, sender_email: null,
          occurred_at: '2026-07-21T10:00:00Z', ends_at: '2026-07-21T10:30:00Z',
          person_id: null, person_name: null, person_email: null, person_is_vip: null,
          project_id: null, project_name: null,
        },
      ],
    });

    const { getLatestBrief } = await import('../brief-server');
    const result = getLatestBrief(db);

    expect(result?.id).toBe(9);
    expect(result?.brief_date).toBe('2026-07-21');
    expect(result?.items).toHaveLength(2);

    const first = result?.items[0];
    expect(first?.id).toBe(11);
    expect(first?.rank).toBe(1);
    expect(first?.item.source).toBe('email');
    expect(first?.person).toEqual({ id: 3, name: 'Rahul', email: 'rahul@company.com', is_vip: true });
    expect(first?.project).toEqual({ id: 5, name: 'Budget Planning' });

    const second = result?.items[1];
    expect(second?.person).toBeNull();
    expect(second?.project).toBeNull();
    expect(second?.item.ends_at).toBe('2026-07-21T10:30:00Z');
  });
});
