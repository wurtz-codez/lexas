import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from 'better-sqlite3';

type UpdateCall = { sql: string; params: unknown[] };
type RunResult = { changes: number };

function createMockDb(setup: {
  people?: { id: number; email: string }[];
  projects?: { id: number; name: string }[];
  items?: {
    id: number;
    source: string;
    sender_email: string | null;
    title: string | null;
    snippet: string | null;
    raw_json: string | null;
    person_id: number | null;
    project_id: number | null;
  }[];
}): { db: Database.Database; updates: UpdateCall[]; emitted: number[] } {
  const updates: UpdateCall[] = [];
  const emitted: number[] = [];

  const people = setup.people ?? [];
  const projects = setup.projects ?? [];
  const items = setup.items ?? [];

  const prepare = vi.fn().mockImplementation((sql: string) => {
    const trimmed = sql.trim();

    if (trimmed.startsWith('INSERT OR IGNORE INTO item_links')) {
      return {
        run: vi.fn(() => ({ changes: 2 } as RunResult)),
      };
    }

    if (trimmed.startsWith('UPDATE synced_items SET person_id')) {
      return {
        run: vi.fn((...params: unknown[]) => {
          updates.push({ sql, params });
          const pid = params[0];
          const iid = params[1];
          const item = items.find((i) => i.id === iid);
          if (item) {
            if (item.person_id !== pid) { item.person_id = pid as number | null; emitted.push(item.id as number); }
          }
          return {} as RunResult;
        }),
      };
    }

    if (trimmed.startsWith('UPDATE synced_items SET project_id')) {
      return {
        run: vi.fn((...params: unknown[]) => {
          updates.push({ sql, params });
          const prid = params[0];
          const iid = params[1];
          const item = items.find((i) => i.id === iid);
          if (item) {
            if (item.project_id !== prid) { item.project_id = prid as number | null; emitted.push(item.id as number); }
          }
          return {} as RunResult;
        }),
      };
    }

    if (trimmed.includes('FROM people')) {
      return { all: vi.fn(() => people) };
    }

    if (trimmed.includes('FROM projects')) {
      return { all: vi.fn(() => projects) };
    }

    if (trimmed.includes('FROM synced_items') && trimmed.includes('WHERE')) {
      return { all: vi.fn(() => items) };
    }

    return { all: vi.fn(() => []), get: vi.fn(() => undefined), run: vi.fn(() => ({ changes: 0 } as RunResult)) };
  });

  return {
    db: { prepare } as unknown as Database.Database,
    updates,
    emitted,
  };
}

describe('resolveItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches sender_email to people.email for email items', async () => {
    const { db, updates, emitted } = createMockDb({
      people: [{ id: 10, email: 'rahul@company.com' }],
      projects: [],
      items: [{
        id: 1, source: 'email', sender_email: 'rahul@company.com',
        title: 'Hello', snippet: null, raw_json: null,
        person_id: null, project_id: null,
      }],
    });

    const { resolveItems } = await import('../correlation-engine');
    const count = await resolveItems(db, null);

    expect(count).toBe(1);
    expect(emitted).toContain(1);
    expect(updates.some((u) => u.sql.includes('SET person_id') && u.params[0] === 10 && u.params[1] === 1)).toBe(true);
  });

  it('does not match when no person has that email', async () => {
    const { db, updates } = createMockDb({
      people: [{ id: 10, email: 'rahul@company.com' }],
      projects: [],
      items: [{
        id: 1, source: 'email', sender_email: 'unknown@other.com',
        title: 'Hello', snippet: null, raw_json: null,
        person_id: null, project_id: null,
      }],
    });

    const { resolveItems } = await import('../correlation-engine');
    const count = await resolveItems(db, null);

    expect(count).toBe(0);
    expect(updates.length).toBe(0);
  });

  it('matches calendar attendees excluding connected email', async () => {
    const { db, updates } = createMockDb({
      people: [{ id: 10, email: 'rahul@company.com' }],
      projects: [],
      items: [{
        id: 1, source: 'calendar', sender_email: null,
        title: 'Meeting', snippet: null,
        raw_json: JSON.stringify({
          attendees: [
            { email: 'koustubh@gmail.com' },
            { email: 'rahul@company.com' },
          ],
        }),
        person_id: null, project_id: null,
      }],
    });

    const { resolveItems } = await import('../correlation-engine');
    const count = await resolveItems(db, 'koustubh@gmail.com');

    expect(count).toBe(1);
    expect(updates.some((u) => u.sql.includes('SET person_id') && u.params[0] === 10)).toBe(true);
  });

  it('skips calendar attendee matching when attendee is connected email', async () => {
    const { db } = createMockDb({
      people: [{ id: 10, email: 'me@gmail.com' }],
      projects: [],
      items: [{
        id: 1, source: 'calendar', sender_email: null,
        title: 'My event', snippet: null,
        raw_json: JSON.stringify({
          attendees: [{ email: 'me@gmail.com' }, { email: 'other@company.com' }],
        }),
        person_id: null, project_id: null,
      }],
    });

    const { resolveItems } = await import('../correlation-engine');
    const count = await resolveItems(db, 'me@gmail.com');

    expect(count).toBe(0);
  });

  it('matches project by substring in title', async () => {
    const { db, updates } = createMockDb({
      people: [],
      projects: [{ id: 5, name: 'Budget Planning' }],
      items: [{
        id: 1, source: 'email', sender_email: null,
        title: 'Q3 Budget Planning Review', snippet: null, raw_json: null,
        person_id: null, project_id: null,
      }],
    });

    const { resolveItems } = await import('../correlation-engine');
    const count = await resolveItems(db, null);

    expect(count).toBe(1);
    expect(updates.some((u) => u.sql.includes('SET project_id') && u.params[0] === 5)).toBe(true);
  });

  it('matches project by substring in snippet', async () => {
    const { db, updates } = createMockDb({
      people: [],
      projects: [{ id: 7, name: 'Mobile App' }],
      items: [{
        id: 1, source: 'email', sender_email: null,
        title: 'Fwd: design review', snippet: 'Check the mobile app mockups', raw_json: null,
        person_id: null, project_id: null,
      }],
    });

    const { resolveItems } = await import('../correlation-engine');
    const count = await resolveItems(db, null);

    expect(count).toBe(1);
    expect(updates.some((u) => u.sql.includes('SET project_id') && u.params[0] === 7)).toBe(true);
  });

  it('matches first project when multiple match', async () => {
    const { db, updates } = createMockDb({
      people: [],
      projects: [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
      ],
      items: [{
        id: 1, source: 'email', sender_email: null,
        title: 'Alpha Beta project plan', snippet: null, raw_json: null,
        person_id: null, project_id: null,
      }],
    });

    const { resolveItems } = await import('../correlation-engine');
    const count = await resolveItems(db, null);

    expect(count).toBe(1);
    expect(updates.some((u) => u.sql.includes('SET project_id') && u.params[0] === 1)).toBe(true);
  });

  it('skips items with both fields already resolved', async () => {
    const { db } = createMockDb({
      people: [{ id: 10, email: 'rahul@company.com' }],
      projects: [{ id: 5, name: 'Budget' }],
      items: [{
        id: 1, source: 'email', sender_email: 'rahul@company.com',
        title: 'Budget review', snippet: null, raw_json: null,
        person_id: 10, project_id: 5,
      }],
    });

    const { resolveItems } = await import('../correlation-engine');
    const count = await resolveItems(db, null);

    expect(count).toBe(0);
  });

  it('handles malformed raw_json gracefully', async () => {
    const { db } = createMockDb({
      people: [{ id: 10, email: 'rahul@company.com' }],
      projects: [],
      items: [{
        id: 1, source: 'calendar', sender_email: null,
        title: 'Bad JSON', snippet: null, raw_json: '{invalid',
        person_id: null, project_id: null,
      }],
    });

    const { resolveItems } = await import('../correlation-engine');
    const count = await resolveItems(db, null);

    expect(count).toBe(0);
  });
});

describe('linkItems', () => {
  it('returns number of inserted links', async () => {
    const { db } = createMockDb({ people: [], projects: [], items: [] });

    const { linkItems } = await import('../correlation-engine');
    const count = await linkItems(db);

    expect(count).toBe(4);
  });
});

describe('runCorrelation', () => {
  it('returns combined result from both passes', async () => {
    const { db } = createMockDb({
      people: [{ id: 10, email: 'rahul@company.com' }],
      projects: [],
      items: [{
        id: 1, source: 'email', sender_email: 'rahul@company.com',
        title: 'Hello', snippet: null, raw_json: null,
        person_id: null, project_id: null,
      }],
    });

    const { runCorrelation } = await import('../correlation-engine');
    const result = await runCorrelation(db, null);

    expect(result.resolved).toBeGreaterThanOrEqual(1);
    expect(result.links).toBeGreaterThanOrEqual(0);
  });
});
