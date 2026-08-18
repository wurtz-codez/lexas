import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from 'better-sqlite3';

const mockGenerateContent = vi.fn();

vi.mock('@google/generative-ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/generative-ai')>();
  return {
    ...actual,
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return { generateContent: mockGenerateContent };
      }
    },
  };
});

vi.mock('@/features/brief/config', () => ({
  getGeminiApiKey: vi.fn(() => 'sk-test-key'),
}));

type MockRow = Record<string, unknown>;
type MockDbSetup = {
  userContext?: MockRow | null;
  vips?: MockRow[];
  items?: MockRow[];
  links?: MockRow[];
  existingBriefId?: number | null;
};

function createMockDb(setup: MockDbSetup): Database.Database {
  const prepare = vi.fn().mockImplementation((sql: string) => {
    const lower = sql.trim().toLowerCase();

    if (lower.startsWith('select') && lower.includes('from user_context')) {
      return { get: vi.fn(() => setup.userContext ?? null) };
    }
    if (lower.startsWith('select') && lower.includes('from people')) {
      return { all: vi.fn(() => setup.vips ?? []) };
    }
    if (lower.startsWith('select') && lower.includes('from synced_items')) {
      return { all: vi.fn(() => setup.items ?? []) };
    }
    if (lower.startsWith('select') && lower.includes('from item_links')) {
      return { all: vi.fn(() => setup.links ?? []) };
    }
    if (lower.startsWith('select') && lower.includes('from briefs')) {
      const val = setup.existingBriefId ?? undefined;
      return { get: vi.fn(() => (val ? { id: val } : undefined)) };
    }
    if (lower.startsWith('delete')) {
      return { run: vi.fn() };
    }
    if (lower.startsWith('insert into briefs')) {
      return { run: vi.fn(() => ({ lastInsertRowid: 42 })) };
    }
    if (lower.startsWith('insert into brief_items')) {
      return { run: vi.fn() };
    }

    return { get: vi.fn(), all: vi.fn(), run: vi.fn() };
  });

  return {
    prepare,
    transaction: vi.fn((fn: () => number) => fn),
  } as unknown as Database.Database;
}

const mockItem = {
  id: 1,
  source: 'email',
  title: 'Q3 Budget Review',
  sender_email: 'ceo@company.com',
  snippet: 'Please review the budget by Friday',
  occurred_at: '2026-07-21T09:00:00.000Z',
  person_name: 'Rahul',
  person_is_vip: 1,
  project_name: 'Budget Planning',
};

describe('generateBrief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockGeminiResponse(content: string, finishReason = 'STOP') {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => content,
        candidates: [{ finishReason }],
      },
    });
  }

  it('creates brief with ranked items from valid Gemini response', async () => {
    mockGeminiResponse(JSON.stringify([{ synced_item_id: 1, rank: 1, reason: 'Important budget item', score: 0.95 }]));

    const db = createMockDb({
      userContext: { role: '["engineer"]', focus_summary: 'Shipping Q3' },
      vips: [{ name: 'Rahul', email: 'rahul@company.com' }],
      items: [mockItem],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    const result = await generateBrief(db, '2026-07-21', 0);

    expect(result.brief_id).toBe(42);
    expect(result.items_ranked).toBe(1);

    const calls = (db.prepare as ReturnType<typeof vi.fn>).mock.calls;
    const hasBriefInsert = calls.some((c: [string]) => c[0].startsWith('INSERT INTO briefs'));
    const hasItemInsert = calls.some((c: [string]) => c[0].startsWith('INSERT INTO brief_items'));
    expect(hasBriefInsert).toBe(true);
    expect(hasItemInsert).toBe(true);

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        generationConfig: expect.objectContaining({ temperature: 0 }),
      }),
    );
  });

  it('creates empty brief when no items exist for the date', async () => {
    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    const result = await generateBrief(db, '2026-07-21', 0);

    expect(result.items_ranked).toBe(0);
    expect(result.brief_id).toBe(42);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('replaces existing brief on re-run for same date', async () => {
    mockGeminiResponse(JSON.stringify([{ synced_item_id: 1, rank: 1, reason: 'Updated analysis', score: 0.9 }]));

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [mockItem],
      links: [],
      existingBriefId: 7,
    });

    const { generateBrief } = await import('../context-engine');
    const result = await generateBrief(db, '2026-07-21', 0);

    expect(result.brief_id).toBe(42);
    expect(result.items_ranked).toBe(1);
  });

  it('throws descriptive error when finish_reason is MAX_TOKENS', async () => {
    mockGeminiResponse('[{"synced_item_id": 1}]', 'MAX_TOKENS');

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [mockItem, { ...mockItem, id: 2 }],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    await expect(generateBrief(db, '2026-07-21', 0)).rejects.toThrow(/truncated/);
  });

  it('throws descriptive error when Gemini returns invalid JSON', async () => {
    mockGeminiResponse('not valid json at all');

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [mockItem],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    await expect(generateBrief(db, '2026-07-21', 0)).rejects.toThrow(/JSON parse failed/);
  });

  it('parses clean JSON from structured output mode (no markdown fences)', async () => {
    mockGeminiResponse('[\n{"synced_item_id": 1, "rank": 1, "reason": "test", "score": 0.5}\n]');

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [mockItem],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    const result = await generateBrief(db, '2026-07-21', 0);
    expect(result.items_ranked).toBe(1);
  });

  it('skips unknown synced_item_ids from LLM response', async () => {
    mockGeminiResponse(JSON.stringify([
      { synced_item_id: 1, rank: 1, reason: 'real item', score: 0.9 },
      { synced_item_id: 999, rank: 2, reason: 'fake item', score: 0.1 },
    ]));

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [mockItem],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    const result = await generateBrief(db, '2026-07-21', 0);
    expect(result.items_ranked).toBe(1);
  });

  it('defaults missing score to null in stored data', async () => {
    mockGeminiResponse(JSON.stringify([{ synced_item_id: 1, rank: 1, reason: 'no score' }]));

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [mockItem],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    const result = await generateBrief(db, '2026-07-21', 0);
    expect(result.items_ranked).toBe(1);
  });

  it('persists suggested_action as JSON when present in the response', async () => {
    mockGeminiResponse(JSON.stringify([
      {
        synced_item_id: 1,
        rank: 1,
        reason: 'Budget item',
        score: 0.9,
        suggested_action: {
          proposed_title: 'Budget Review',
          proposed_start: '2026-07-21T15:00:00Z',
          proposed_end: '2026-07-21T16:00:00Z',
        },
      },
    ]));

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [mockItem],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    await generateBrief(db, '2026-07-21', 0);

    const prepare = db.prepare as ReturnType<typeof vi.fn>;
    const idx = prepare.mock.calls.findIndex(
      (c: [string]) => c[0].toLowerCase().startsWith('insert into brief_items'),
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    const run = prepare.mock.results[idx].value.run as ReturnType<typeof vi.fn>;
    expect(run).toHaveBeenCalledWith(
      42,
      1,
      1,
      'Budget item',
      0.9,
      JSON.stringify({
        proposed_title: 'Budget Review',
        proposed_start: '2026-07-21T15:00:00Z',
        proposed_end: '2026-07-21T16:00:00Z',
      }),
    );
  });

  it('stores null suggested_action when the response omits it', async () => {
    mockGeminiResponse(JSON.stringify([
      { synced_item_id: 1, rank: 1, reason: 'Budget item', score: 0.9 },
    ]));

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [mockItem],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    await generateBrief(db, '2026-07-21', 0);

    const prepare = db.prepare as ReturnType<typeof vi.fn>;
    const idx = prepare.mock.calls.findIndex(
      (c: [string]) => c[0].toLowerCase().startsWith('insert into brief_items'),
    );
    const run = prepare.mock.results[idx].value.run as ReturnType<typeof vi.fn>;
    expect(run).toHaveBeenCalledWith(42, 1, 1, 'Budget item', 0.9, null);
  });

  it('throws when API key is not configured', async () => {
    const { getGeminiApiKey } = await import('@/features/brief/config');
    vi.mocked(getGeminiApiKey).mockReturnValue('');

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [mockItem],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    await expect(generateBrief(db, '2026-07-21', 0)).rejects.toThrow(/GEMINI_API_KEY/);

    vi.mocked(getGeminiApiKey).mockReturnValue('sk-test-key');
  });

  it('passes correct maxOutputTokens based on item count', async () => {
    mockGeminiResponse('[]');

    const manyItems = Array.from({ length: 30 }, (_, i) => ({ ...mockItem, id: i + 1, title: `Item ${i + 1}` }));

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: manyItems,
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    await generateBrief(db, '2026-07-21', 0);

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        generationConfig: expect.objectContaining({ maxOutputTokens: 30 * 80 + 500 }),
      }),
    );
  });

  it('caps maxOutputTokens at 32000 ceiling', async () => {
    mockGeminiResponse('[]');

    const manyItems = Array.from({ length: 400 }, (_, i) => ({ ...mockItem, id: i + 1, title: `Item ${i + 1}` }));

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: manyItems,
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    await generateBrief(db, '2026-07-21', 0);

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        generationConfig: expect.objectContaining({ maxOutputTokens: 32000 }),
      }),
    );
  });

  it('queries the local-day UTC window, not the UTC date', async () => {
    mockGeminiResponse('[]');

    const db = createMockDb({
      userContext: { role: null, focus_summary: null },
      vips: [],
      items: [],
      links: [],
    });

    const { generateBrief } = await import('../context-engine');
    // IST (UTC+5:30) => getTimezoneOffset() = -330. Local Aug 19 spans
    // [Aug 18 18:30Z, Aug 19 18:30Z), which includes a mail sent 1:35am IST
    // (stored as 2026-08-18T20:05Z).
    await generateBrief(db, '2026-08-19', -330);

    const prepare = db.prepare as ReturnType<typeof vi.fn>;
    const syncedCall = prepare.mock.calls.find(
      (c: [string]) =>
        c[0].toLowerCase().includes('from synced_items') &&
        c[0].toLowerCase().includes('occurred_at'),
    );
    expect(syncedCall).toBeDefined();

    const idx = prepare.mock.calls.indexOf(syncedCall);
    const all = prepare.mock.results[idx].value.all as ReturnType<typeof vi.fn>;
    expect(all).toHaveBeenCalledWith('2026-08-18T18:30:00.000Z', '2026-08-19T18:30:00.000Z');
  });
});
