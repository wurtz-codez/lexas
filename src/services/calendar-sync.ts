import type Database from 'better-sqlite3';
import { AuthError } from './gmail-sync';
import type { SyncResult } from './gmail-sync';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const MAX_EVENTS = 200;
const MAX_DESCRIPTION_LENGTH = 500;

type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  organizer?: { email?: string; displayName?: string };
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; responseStatus: string }[];
};

type CalendarListResponse = {
  items?: CalendarEvent[];
  nextPageToken?: string;
};

export type ParsedEvent = {
  title: string;
  organizerEmail: string | null;
  occurredAt: string;
  endsAt: string | null;
  snippet: string | null;
};

export async function listCalendarEvents(accessToken: string): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | null = null;
  const now = new Date();
  const max = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const timeMin = now.toISOString();
  const timeMax = max.toISOString();

  do {
    const url = new URL(CALENDAR_API);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) {
      throw new AuthError('Access token expired');
    }
    if (!res.ok) {
      throw new Error(`Calendar list failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as CalendarListResponse;
    if (data.items) events.push(...data.items);
    pageToken = data.nextPageToken ?? null;
  } while (pageToken && events.length < MAX_EVENTS);

  return events.slice(0, MAX_EVENTS);
}

export function parseCalendarEvent(event: CalendarEvent): ParsedEvent {
  const startVal = event.start?.dateTime ?? event.start?.date;
  const endVal = event.end?.dateTime ?? event.end?.date;

  const occurredAt = startVal
    ? new Date(startVal).toISOString()
    : new Date().toISOString();

  let endsAt: string | null;
  if (endVal) {
    endsAt = new Date(endVal).toISOString();
  } else if (startVal) {
    endsAt = new Date(new Date(startVal).getTime() + 60 * 60 * 1000).toISOString();
  } else {
    endsAt = null;
  }

  const snippet = event.description
    ? event.description.slice(0, MAX_DESCRIPTION_LENGTH)
    : null;

  return {
    title: event.summary || '(no title)',
    organizerEmail: event.organizer?.email ?? null,
    occurredAt,
    endsAt,
    snippet,
  };
}

export async function syncCalendar(
  db: Database.Database,
  getValidAccessToken: () => Promise<string>,
): Promise<SyncResult> {
  const accessToken = await getValidAccessToken();
  const events = await listCalendarEvents(accessToken);

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO synced_items
      (source, external_id, title, snippet, sender_email, occurred_at, ends_at, raw_json)
    VALUES ('calendar', ?, ?, ?, ?, ?, ?, ?)
  `);

  let synced = 0;
  for (const event of events) {
    try {
      const parsed = parseCalendarEvent(event);
      insertStmt.run(
        event.id,
        parsed.title,
        parsed.snippet,
        parsed.organizerEmail,
        parsed.occurredAt,
        parsed.endsAt,
        JSON.stringify(event),
      );
      synced++;
    } catch (err) {
      if (err instanceof AuthError) {
        throw err;
      }
      process.stderr.write(`[calendar-sync] Skipping event ${event.id}: ${err}\n`);
    }
  }

  return { synced };
}
