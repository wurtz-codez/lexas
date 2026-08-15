import { describe, it, expect, vi } from 'vitest';
import type Database from 'better-sqlite3';

type InsertCall = { sql: string; params: unknown[] };
type FeedbackRow = { id: number; brief_item_id: number; feedback_type: string };

function createMockDb(setup: {
  exists?: boolean;
  seed?: FeedbackRow[];
}): { db: Database.Database; inserts: InsertCall[]; log: FeedbackRow[] } {
  const inserts: InsertCall[] = [];
  const log: FeedbackRow[] = setup.seed ?? [];
  let nextId = 1;

  const prepare = vi.fn().mockImplementation((sql: string) => {
    const trimmed = sql.trim();

    if (trimmed.includes('FROM brief_items')) {
      return { get: vi.fn(() => (setup.exists ? { id: 5 } : undefined)) };
    }

    if (trimmed.includes('FROM feedback') && trimmed.includes('LIMIT 1')) {
      return { get: vi.fn(() => log[log.length - 1] ?? undefined) };
    }

    if (trimmed.startsWith('INSERT INTO feedback')) {
      return {
        run: vi.fn((...params: unknown[]) => {
          inserts.push({ sql, params });
          log.push({
            id: nextId++,
            brief_item_id: params[0] as number,
            feedback_type: params[1] as string,
          });
          return { changes: 1 };
        }),
      };
    }

    return { get: vi.fn(() => undefined), all: vi.fn(() => []), run: vi.fn() };
  });

  return { db: { prepare } as unknown as Database.Database, inserts, log };
}

describe('submitFeedback', () => {
  it('inserts a valid feedback row', async () => {
    const { db, inserts } = createMockDb({ exists: true });

    const { submitFeedback } = await import('../feedback-server');
    submitFeedback(db, 5, 'important');

    expect(inserts).toHaveLength(1);
    expect(inserts[0].params).toEqual([5, 'important']);
  });

  it('throws on invalid feedback type', async () => {
    const { db } = createMockDb({ exists: true });

    const { submitFeedback } = await import('../feedback-server');
    expect(() => submitFeedback(db, 5, 'bogus')).toThrow(/invalid type/);
  });

  it('throws when brief_item_id does not exist', async () => {
    const { db } = createMockDb({ exists: false });

    const { submitFeedback } = await import('../feedback-server');
    expect(() => submitFeedback(db, 999, 'important')).toThrow(/does not exist/);
  });

  it('throws on non-integer brief_item_id', async () => {
    const { db } = createMockDb({ exists: true });

    const { submitFeedback } = await import('../feedback-server');
    expect(() => submitFeedback(db, 1.5, 'important')).toThrow(/integer/);
  });

  it('suppresses consecutive duplicate feedback', async () => {
    const { db, inserts } = createMockDb({ exists: true, seed: [{ id: 1, brief_item_id: 5, feedback_type: 'important' }] });

    const { submitFeedback } = await import('../feedback-server');
    submitFeedback(db, 5, 'important');

    expect(inserts).toHaveLength(0);
  });

  it('keeps both rows on opposite feedback (thumbs-up then thumbs-down)', async () => {
    const { db, log } = createMockDb({ exists: true });

    const { submitFeedback } = await import('../feedback-server');
    submitFeedback(db, 5, 'important');
    submitFeedback(db, 5, 'not_important');

    expect(log).toEqual([
      { id: 1, brief_item_id: 5, feedback_type: 'important' },
      { id: 2, brief_item_id: 5, feedback_type: 'not_important' },
    ]);
  });

  it('records a type change even if the same type was used earlier in the log', async () => {
    const { db, log } = createMockDb({ exists: true });

    const { submitFeedback } = await import('../feedback-server');
    submitFeedback(db, 5, 'important');
    submitFeedback(db, 5, 'not_important');
    submitFeedback(db, 5, 'important');

    expect(log).toEqual([
      { id: 1, brief_item_id: 5, feedback_type: 'important' },
      { id: 2, brief_item_id: 5, feedback_type: 'not_important' },
      { id: 3, brief_item_id: 5, feedback_type: 'important' },
    ]);
  });
});
