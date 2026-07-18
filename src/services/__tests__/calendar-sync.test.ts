import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from 'better-sqlite3';
import {
  listCalendarEvents,
  parseCalendarEvent,
  syncCalendar,
} from '../calendar-sync';
import { AuthError } from '../gmail-sync';
import type { SyncResult } from '../gmail-sync';

const TIMED_EVENT = {
  id: 'evt1',
  summary: 'Team Standup',
  description: 'Daily standup meeting',
  organizer: { email: 'rahul@example.com', displayName: 'Rahul' },
  start: { dateTime: '2024-06-10T09:00:00-07:00', timeZone: 'America/Los_Angeles' },
  end: { dateTime: '2024-06-10T09:30:00-07:00', timeZone: 'America/Los_Angeles' },
  attendees: [
    { email: 'alice@example.com', responseStatus: 'accepted' },
    { email: 'bob@example.com', responseStatus: 'needsAction' },
  ],
};

function mockListResponse(events: Record<string, unknown>[], nextPageToken?: string): Response {
  const body: Record<string, unknown> = { items: events };
  if (nextPageToken) body.nextPageToken = nextPageToken;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface CalendarMockStmt {
  _runs: {
    source: string;
    external_id: string;
    title: string;
    snippet: string | null;
    sender_email: string | null;
    occurred_at: string;
    ends_at: string | null;
    raw_json: string;
  }[];
  run: (...args: unknown[]) => void;
}

function createMockDb(): { db: Database.Database; stmt: CalendarMockStmt } {
  const stmt: CalendarMockStmt = {
    _runs: [],
    run(...args: unknown[]) {
      this._runs.push({
        source: 'calendar',
        external_id: args[0] as string,
        title: args[1] as string,
        snippet: args[2] as string | null,
        sender_email: args[3] as string | null,
        occurred_at: args[4] as string,
        ends_at: args[5] as string | null,
        raw_json: args[6] as string,
      });
    },
  };
  const db = {
    prepare: vi.fn().mockReturnValue(stmt),
  } as unknown as Database.Database;
  return { db, stmt };
}

describe('listCalendarEvents', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockReset();
  });

  it('calls the correct Calendar API endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockListResponse([]));

    await listCalendarEvents('fake-token');

    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
    expect(url.href).toContain('www.googleapis.com/calendar/v3/calendars/primary/events');
  });

  it('passes timeMin, timeMax, singleEvents, and orderBy params', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockListResponse([]));

    await listCalendarEvents('fake-token');

    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
    expect(url.searchParams.get('singleEvents')).toBe('true');
    expect(url.searchParams.get('orderBy')).toBe('startTime');
    expect(url.searchParams.get('maxResults')).toBe('50');
    expect(url.searchParams.get('timeMin')).toBeTruthy();
    expect(url.searchParams.get('timeMax')).toBeTruthy();
    expect(new Date(url.searchParams.get('timeMin')!).getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it('uses Bearer token in Authorization header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockListResponse([]));

    await listCalendarEvents('my-access-token');

    const opts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(opts.headers).toEqual({ Authorization: 'Bearer my-access-token' });
  });

  it('handles pagination via nextPageToken', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 50 }, (_, i) => ({ id: `page1-${i}`, summary: `Event ${i}` })),
        'token-2',
      ))
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 20 }, (_, i) => ({ id: `page2-${i}`, summary: `Event ${i}` })),
      ));

    const events = await listCalendarEvents('fake-token');

    expect(events.length).toBe(70);
    expect(fetch).toHaveBeenCalledTimes(2);

    const secondUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[1][0] as URL;
    expect(secondUrl.searchParams.get('pageToken')).toBe('token-2');
  });

  it('stops at MAX_EVENTS (200) cap', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 50 }, (_, i) => ({ id: `msg-${i}` })),
        'more',
      ))
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 50 }, (_, i) => ({ id: `msg-${50 + i}` })),
        'more',
      ))
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 50 }, (_, i) => ({ id: `msg-${100 + i}` })),
        'more',
      ))
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 50 }, (_, i) => ({ id: `msg-${150 + i}` })),
        'more',
      ));

    const events = await listCalendarEvents('fake-token');

    expect(events.length).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('throws AuthError on 401 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(listCalendarEvents('expired-token')).rejects.toThrow(AuthError);
  });

  it('throws generic error on non-401 failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Rate limited', { status: 429 }),
    );

    await expect(listCalendarEvents('fake-token')).rejects.toThrow('Calendar list failed: 429');
  });

  it('returns empty array when no events match time range', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const events = await listCalendarEvents('fake-token');
    expect(events).toEqual([]);
  });
});

describe('parseCalendarEvent', () => {
  it('extracts title, organizer, start, and end from a timed event', () => {
    const parsed = parseCalendarEvent(TIMED_EVENT);

    expect(parsed.title).toBe('Team Standup');
    expect(parsed.organizerEmail).toBe('rahul@example.com');
    expect(parsed.occurredAt).toBe('2024-06-10T16:00:00.000Z');
    expect(parsed.endsAt).toBe('2024-06-10T16:30:00.000Z');
    expect(parsed.snippet).toBe('Daily standup meeting');
  });

  it('handles all-day events with date-only start/end', () => {
    const parsed = parseCalendarEvent({
      id: 'evt2',
      summary: 'All-day conference',
      start: { date: '2024-06-10' },
      end: { date: '2024-06-11' },
    });

    expect(parsed.title).toBe('All-day conference');
    expect(parsed.occurredAt).toBe('2024-06-10T00:00:00.000Z');
    expect(parsed.endsAt).toBe('2024-06-11T00:00:00.000Z');
  });

  it('defaults missing end time to start + 1 hour', () => {
    const parsed = parseCalendarEvent({
      id: 'evt3',
      summary: 'No end time',
      start: { dateTime: '2024-06-10T14:00:00Z' },
    });

    expect(parsed.endsAt).toBe('2024-06-10T15:00:00.000Z');
  });

  it('defaults missing summary to (no title)', () => {
    const parsed = parseCalendarEvent({ id: 'evt4' });
    expect(parsed.title).toBe('(no title)');
  });

  it('sets organizerEmail to null when no organizer', () => {
    const parsed = parseCalendarEvent({ id: 'evt5', summary: 'No organizer' });
    expect(parsed.organizerEmail).toBeNull();
  });

  it('truncates description beyond 500 chars', () => {
    const longDesc = 'x'.repeat(1000);
    const parsed = parseCalendarEvent({
      id: 'evt6',
      summary: 'Long description',
      description: longDesc,
    });
    expect(parsed.snippet?.length).toBe(500);
  });

  it('sets snippet to null when no description', () => {
    const parsed = parseCalendarEvent({ id: 'evt7', summary: 'No description' });
    expect(parsed.snippet).toBeNull();
  });

  it('falls back to current time when start is missing', () => {
    const before = Date.now();
    const parsed = parseCalendarEvent({ id: 'evt8', summary: 'No start' });
    const after = Date.now();

    const ts = new Date(parsed.occurredAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe('syncCalendar', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockReset();
  });

  it('writes events into synced_items with source=calendar and ends_at populated', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockListResponse([TIMED_EVENT]),
    );

    const { db, stmt } = createMockDb();
    const result = await syncCalendar(db, async () => 'test-token');

    expect(result.synced).toBe(1);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE INTO synced_items'));

    expect(stmt._runs[0].source).toBe('calendar');
    expect(stmt._runs[0].external_id).toBe('evt1');
    expect(stmt._runs[0].title).toBe('Team Standup');
    expect(stmt._runs[0].sender_email).toBe('rahul@example.com');
    expect(stmt._runs[0].occurred_at).toBe('2024-06-10T16:00:00.000Z');
    expect(stmt._runs[0].ends_at).toBe('2024-06-10T16:30:00.000Z');
  });

  it('does not duplicate rows on re-sync (INSERT OR IGNORE)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(mockListResponse([TIMED_EVENT]))
      .mockResolvedValueOnce(mockListResponse([TIMED_EVENT]));

    const { db } = createMockDb();
    await syncCalendar(db, async () => 'test-token');
    const result = await syncCalendar(db, async () => 'test-token');

    expect(result.synced).toBe(1);
  });

  it('calls getValidAccessToken to obtain the access token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockListResponse([]));

    const { db } = createMockDb();
    const getToken = vi.fn().mockResolvedValue('fresh-token');

    await syncCalendar(db, getToken);

    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it('re-throws AuthError for token refresh handling upstream', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );

    const { db } = createMockDb();
    await expect(syncCalendar(db, async () => 'expired-token')).rejects.toThrow(AuthError);
  });

  it('recovers from AuthError via retry with fresh token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const tokenCalls: string[] = [];
    const getToken = vi.fn().mockImplementation(async () => {
      const t = tokenCalls.length === 0 ? 'expired-token' : 'refreshed-token';
      tokenCalls.push(t);
      return t;
    });

    fetchMock
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    fetchMock
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 30 }, (_, i) => ({ id: `evt-${i}`, summary: `Event ${i}` })),
      ));

    const { db, stmt } = createMockDb();

    let result: SyncResult;
    try {
      result = await syncCalendar(db, getToken);
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
      result = await syncCalendar(db, getToken);
    }

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(tokenCalls).toEqual(['expired-token', 'refreshed-token']);
    expect(result.synced).toBe(30);
    expect(stmt._runs).toHaveLength(30);
  });
});
