import type Database from 'better-sqlite3';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_MESSAGES = 100;

export type SyncResult = {
  synced: number;
};

type GmailMessage = {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
  };
};

type GmailListResponse = {
  messages?: { id: string }[];
  nextPageToken?: string;
};

export async function listRecentMessageIds(
  accessToken: string,
  query = 'newer_than:2d',
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | null = null;

  do {
    const url = new URL(`${GMAIL_API}/messages`);
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) {
      throw new AuthError('Access token expired');
    }
    if (!res.ok) {
      throw new Error(`Gmail list failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as GmailListResponse;
    if (data.messages) ids.push(...data.messages.map((m) => m.id));
    pageToken = data.nextPageToken ?? null;
  } while (pageToken && ids.length < MAX_MESSAGES);

  return ids.slice(0, MAX_MESSAGES);
}

export async function fetchMessage(
  accessToken: string,
  id: string,
): Promise<GmailMessage> {
  const res = await fetch(
    `${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (res.status === 401) {
    throw new AuthError('Access token expired');
  }
  if (!res.ok) {
    throw new Error(`Gmail get failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<GmailMessage>;
}

export type ParsedMessage = {
  subject: string;
  senderEmail: string;
  occurredAt: string;
};

export function parseMessage(message: GmailMessage): ParsedMessage {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string): string | null =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

  const fromHeader = getHeader('From') || '';
  const senderEmailMatch = fromHeader.match(/<(.+)>/);
  const senderEmail = senderEmailMatch ? senderEmailMatch[1] : fromHeader;

  const dateHeader = getHeader('Date');
  const occurredAt = dateHeader
    ? new Date(dateHeader).toISOString()
    : message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : new Date().toISOString();

  return {
    subject: getHeader('Subject') || '(no subject)',
    senderEmail,
    occurredAt,
  };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function syncGmail(
  db: Database.Database,
  getValidAccessToken: () => Promise<string>,
  query = 'newer_than:2d',
): Promise<SyncResult> {
  const accessToken = await getValidAccessToken();
  const messageIds = await listRecentMessageIds(accessToken, query);

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO synced_items
      (source, external_id, title, snippet, sender_email, occurred_at, raw_json)
    VALUES ('email', ?, ?, ?, ?, ?, ?)
  `);

  for (const id of messageIds) {
    try {
      const message = await fetchMessage(accessToken, id);
      const parsed = parseMessage(message);
      insertStmt.run(
        message.id,
        parsed.subject,
        message.snippet ?? null,
        parsed.senderEmail,
        parsed.occurredAt,
        JSON.stringify(message),
      );
    } catch (err) {
      if (err instanceof AuthError) {
        throw err;
      }
      process.stderr.write(`[gmail-sync] Skipping message ${id}: ${err}\n`);
    }
  }

  return { synced: messageIds.length };
}
