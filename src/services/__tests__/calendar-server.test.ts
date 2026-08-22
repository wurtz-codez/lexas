import { describe, it, expect, vi, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import type { CalendarEventDetail } from '@/types';
import { getValidAccessToken } from '../oauth-server';
import { AuthError } from '../gmail-sync';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('../database', () => ({
  getDb: vi.fn(),
}));

vi.mock('../oauth-server', () => ({
  getValidAccessToken: vi.fn(),
}));

vi.mock('../gmail-sync', () => {
  class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  }
  return { AuthError, syncGmail: vi.fn() };
});

const mockFetch = vi.fn();

const VALID_DETAILS = {
  title: 'Budget Review',
  start: '2026-07-21T15:00:00Z',
  end: '2026-07-21T16:00:00Z',
  synced_item_id: 7,
};

function mockDb(): { db: Database.Database; inserts: unknown[][] } {
  const inserts: unknown[][] = [];
  const db = {
    prepare: vi.fn(() => ({
      run: vi.fn((...params: unknown[]) => {
        inserts.push(params);
        return { changes: 1 };
      }),
    })),
  } as unknown as Database.Database;
  return { db, inserts };
}

describe('createCalendarEvent', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates the event via the Calendar API and records the action', async () => {
    vi.stubGlobal('fetch', mockFetch);
    vi.mocked(getValidAccessToken).mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'evt_123' }) });

    const { db, inserts } = mockDb();
    const { createCalendarEvent } = await import('../calendar-server');
    const result = await createCalendarEvent(db, VALID_DETAILS);

    expect(result).toEqual({ event_id: 'evt_123' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      summary: 'Budget Review',
      start: { dateTime: VALID_DETAILS.start },
      end: { dateTime: VALID_DETAILS.end },
    });

    expect(inserts).toEqual([[7, 'evt_123']]);
  });

  it('throws AuthError on 401 so the caller can refresh the token', async () => {
    vi.stubGlobal('fetch', mockFetch);
    vi.mocked(getValidAccessToken).mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const { db } = mockDb();
    const { createCalendarEvent } = await import('../calendar-server');
    await expect(createCalendarEvent(db, VALID_DETAILS)).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects invalid input before hitting the API', async () => {
    const { db } = mockDb();
    const { createCalendarEvent } = await import('../calendar-server');

    await expect(
      createCalendarEvent(db, { ...VALID_DETAILS, title: '  ' }),
    ).rejects.toThrow(/title/);
    await expect(
      createCalendarEvent(db, { ...VALID_DETAILS, start: 'not-a-date' }),
    ).rejects.toThrow(/valid start\/end/);
    expect(getValidAccessToken).not.toHaveBeenCalled();
  });
});

describe('listDayCalendarEvents', () => {
  it('returns calendar events within the local-day UTC window', async () => {
    const rows: CalendarEventDetail[] = [
      {
        id: 1, title: 'Meet', snippet: null, organizer_email: 'a@b.com',
        occurred_at: '2026-08-18T19:00:00.000Z', ends_at: '2026-08-18T20:00:00.000Z',
      },
    ];
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (String(sql).includes('FROM synced_items')) {
          return { all: vi.fn(() => rows) };
        }
        return { all: vi.fn(() => []) };
      }),
    } as unknown as Database.Database;

    const { listDayCalendarEvents } = await import('../calendar-server');
    const result = listDayCalendarEvents(db, '2026-08-19', -330);

    expect(result).toEqual(rows);

    const prepare = db.prepare as ReturnType<typeof vi.fn>;
    const all = prepare.mock.results[0].value.all as ReturnType<typeof vi.fn>;
    expect(all).toHaveBeenCalledWith('2026-08-18T18:30:00.000Z', '2026-08-19T18:30:00.000Z');
  });
});
