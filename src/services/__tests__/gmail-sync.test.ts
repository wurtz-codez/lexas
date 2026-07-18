import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from 'better-sqlite3';
import {
  listRecentMessageIds,
  fetchMessage,
  parseMessage,
  syncGmail,
  AuthError,
} from '../gmail-sync';
import type { SyncResult } from '../gmail-sync';

function mockListResponse(ids: string[], nextPageToken?: string): Response {
  const body: Record<string, unknown> = {
    messages: ids.map((id) => ({ id })),
    resultSizeEstimate: ids.length,
  };
  if (nextPageToken) body.nextPageToken = nextPageToken;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockMessageResponse(id: string): Response {
  const body = {
    id,
    snippet: `Snippet for ${id}`,
    internalDate: '1718000000000',
    payload: {
      headers: [
        { name: 'Subject', value: `Subject ${id}` },
        { name: 'From', value: 'Alice <alice@example.com>' },
        { name: 'Date', value: 'Mon, 10 Jun 2024 10:00:00 +0000' },
      ],
    },
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface MockStmt {
  _runs: { source: string; external_id: string; title: string; snippet: string | null; sender_email: string; occurred_at: string; raw_json: string }[];
  run: (...args: unknown[]) => void;
}

function createMockDb(): { db: Database.Database; stmt: MockStmt; rows: MockStmt['_runs'] } {
  const stmt: MockStmt = {
    _runs: [],
    run(...args: unknown[]) {
      this._runs.push({
        source: 'email',
        external_id: args[0] as string,
        title: args[1] as string,
        snippet: args[2] as string | null,
        sender_email: args[3] as string,
        occurred_at: args[4] as string,
        raw_json: args[5] as string,
      });
    },
  };
  const db = {
    prepare: vi.fn().mockReturnValue(stmt),
  } as unknown as Database.Database;
  return { db, stmt, rows: stmt._runs };
}

describe('listRecentMessageIds', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockReset();
  });

  it('fetches message IDs from Gmail list endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockListResponse(['msg1', 'msg2']),
    );

    const ids = await listRecentMessageIds('fake-token');

    expect(ids).toEqual(['msg1', 'msg2']);
    expect(fetch).toHaveBeenCalledTimes(1);

    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
    expect(url.href).toContain('gmail.googleapis.com/gmail/v1/users/me/messages');
    expect(url.searchParams.get('q')).toBe('newer_than:2d');
    expect(url.searchParams.get('maxResults')).toBe('50');
  });

  it('uses Bearer token in Authorization header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockListResponse(['msg1']),
    );

    await listRecentMessageIds('my-access-token');

    const opts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(opts.headers).toEqual({ Authorization: 'Bearer my-access-token' });
  });

  it('handles pagination via nextPageToken', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 50 }, (_, i) => `page1-${i}`),
        'token-2',
      ))
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 20 }, (_, i) => `page2-${i}`),
      ));

    const ids = await listRecentMessageIds('fake-token');

    expect(ids.length).toBe(70);
    expect(fetch).toHaveBeenCalledTimes(2);

    const secondUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[1][0] as URL;
    expect(secondUrl.searchParams.get('pageToken')).toBe('token-2');
  });

  it('stops at MAX_MESSAGES (100) cap to prevent runaway sync', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 50 }, (_, i) => `msg-${i}`),
        'more',
      ))
      .mockResolvedValueOnce(mockListResponse(
        Array.from({ length: 50 }, (_, i) => `msg-${50 + i}`),
        'more',
      ));

    const ids = await listRecentMessageIds('fake-token');

    expect(ids.length).toBe(100);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws AuthError on 401 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(listRecentMessageIds('expired-token')).rejects.toThrow(AuthError);
  });

  it('throws generic error on non-401 failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Rate limited', { status: 429 }),
    );

    await expect(listRecentMessageIds('fake-token')).rejects.toThrow('Gmail list failed: 429');
  });

  it('returns empty array when no messages match query', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ resultSizeEstimate: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const ids = await listRecentMessageIds('fake-token');
    expect(ids).toEqual([]);
  });
});

describe('fetchMessage', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockReset();
  });

  it('fetches a single message with metadata format', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockMessageResponse('msg1'));

    const msg = await fetchMessage('fake-token', 'msg1');

    expect(msg.id).toBe('msg1');
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('format=metadata');
    expect(url).toContain('metadataHeaders=Subject');
    expect(url).toContain('metadataHeaders=From');
    expect(url).toContain('metadataHeaders=Date');
  });

  it('throws AuthError on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(fetchMessage('expired-token', 'msg1')).rejects.toThrow(AuthError);
  });
});

describe('parseMessage', () => {
  it('extracts subject, sender, and date from headers', () => {
    const parsed = parseMessage({
      id: 'msg1',
      snippet: 'Hello world',
      payload: {
        headers: [
          { name: 'Subject', value: 'Meeting tomorrow' },
          { name: 'From', value: 'Bob Smith <bob@example.com>' },
          { name: 'Date', value: 'Tue, 11 Jun 2024 14:30:00 +0000' },
        ],
      },
    });

    expect(parsed.subject).toBe('Meeting tomorrow');
    expect(parsed.senderEmail).toBe('bob@example.com');
    expect(parsed.occurredAt).toBe('2024-06-11T14:30:00.000Z');
  });

  it('extracts email from name+angle bracket format', () => {
    const parsed = parseMessage({
      id: 'msg2',
      payload: {
        headers: [
          { name: 'From', value: 'Alice <alice@example.com>' },
          { name: 'Date', value: 'Mon, 10 Jun 2024 10:00:00 +0000' },
        ],
      },
    });

    expect(parsed.senderEmail).toBe('alice@example.com');
  });

  it('uses raw from value when no angle bracket email', () => {
    const parsed = parseMessage({
      id: 'msg3',
      payload: {
        headers: [
          { name: 'From', value: 'noreply@example.com' },
          { name: 'Date', value: 'Mon, 10 Jun 2024 10:00:00 +0000' },
        ],
      },
    });

    expect(parsed.senderEmail).toBe('noreply@example.com');
  });

  it('falls back to internalDate when Date header is missing', () => {
    const parsed = parseMessage({
      id: 'msg4',
      internalDate: '1718000000000',
      payload: {
        headers: [{ name: 'Subject', value: 'No date header' }],
      },
    });

    expect(parsed.subject).toBe('No date header');
    expect(new Date(parsed.occurredAt).getTime()).toBe(1718000000000);
  });

  it('defaults subject to "(no subject)" when missing and uses current date as fallback', () => {
    const before = Date.now();
    const parsed = parseMessage({ id: 'msg5' });
    const after = Date.now();

    expect(parsed.subject).toBe('(no subject)');
    expect(parsed.senderEmail).toBe('');
    const ts = new Date(parsed.occurredAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe('syncGmail', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockReset();
  });

  it('writes fetched messages into synced_items via INSERT OR IGNORE', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockListResponse(['msg1', 'msg2']))
      .mockResolvedValueOnce(mockMessageResponse('msg1'))
      .mockResolvedValueOnce(mockMessageResponse('msg2'));

    const { db, stmt } = createMockDb();

    const result = await syncGmail(db, async () => 'test-token');

    expect(result.synced).toBe(2);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE INTO synced_items'));
    expect(stmt._runs).toHaveLength(2);

    expect(stmt._runs[0].external_id).toBe('msg1');
    expect(stmt._runs[0].title).toBe('Subject msg1');
    expect(stmt._runs[0].snippet).toBe('Snippet for msg1');
    expect(stmt._runs[0].sender_email).toBe('alice@example.com');
    expect(stmt._runs[0].source).toBe('email');

    expect(stmt._runs[1].external_id).toBe('msg2');
    expect(stmt._runs[1].title).toBe('Subject msg2');
  });

  it('does not fail on duplicate external_id (INSERT OR IGNORE semantics)', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockListResponse(['msg1']))
      .mockResolvedValueOnce(mockMessageResponse('msg1'));

    const { db } = createMockDb();
    const result = await syncGmail(db, async () => 'test-token');

    expect(result.synced).toBe(1);
  });

  it('calls getValidAccessToken to obtain the access token', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockListResponse(['msg1']))
      .mockResolvedValueOnce(mockMessageResponse('msg1'));

    const { db } = createMockDb();
    const getToken = vi.fn().mockResolvedValue('fresh-token');

    await syncGmail(db, getToken);

    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it('re-throws AuthError for token refresh handling upstream', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(mockListResponse(['msg1']))
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const { db } = createMockDb();
    await expect(syncGmail(db, async () => 'expired-token')).rejects.toThrow(AuthError);
  });

  it('skips individual message on non-auth errors and continues', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(mockListResponse(['msg1', 'msg2']))
      .mockResolvedValueOnce(new Response('Not found', { status: 404 }))
      .mockResolvedValueOnce(mockMessageResponse('msg2'));

    const { db, stmt } = createMockDb();
    const result = await syncGmail(db, async () => 'test-token');

    expect(result.synced).toBe(2);
    expect(stmt._runs).toHaveLength(1);
    expect(stmt._runs[0].external_id).toBe('msg2');
  });

  it('recovers from mid-sync AuthError via retry with fresh token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const tokenCalls: string[] = [];
    const getToken = vi.fn().mockImplementation(async () => {
      const t = tokenCalls.length === 0 ? 'expired-token' : 'refreshed-token';
      tokenCalls.push(t);
      return t;
    });

    fetchMock
      .mockResolvedValueOnce(mockListResponse(['msg1', 'msg2']))
      .mockResolvedValueOnce(mockMessageResponse('msg1'))
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    fetchMock
      .mockResolvedValueOnce(mockListResponse(['msg2']))
      .mockResolvedValueOnce(mockMessageResponse('msg2'));

    const { db, stmt } = createMockDb();

    let result: SyncResult;
    try {
      result = await syncGmail(db, getToken);
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
      result = await syncGmail(db, getToken);
    }

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(tokenCalls).toEqual(['expired-token', 'refreshed-token']);
    expect(result.synced).toBe(1);
    expect(stmt._runs).toHaveLength(2);
    expect(stmt._runs[0].external_id).toBe('msg1');
    expect(stmt._runs[1].external_id).toBe('msg2');
  });
});

describe('AuthError', () => {
  it('has the correct name', () => {
    const err = new AuthError('test');
    expect(err.name).toBe('AuthError');
    expect(err.message).toBe('test');
  });
});
