import type Database from 'better-sqlite3';
import { AuthError } from './gmail-sync';
import type { SyncResult } from './gmail-sync';

const CALENDAR_LIST_API = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
const MAX_EVENTS = 200;
const MAX_DESCRIPTION_LENGTH = 500;
const WINDOW_PAST_HOURS = 24;
const WINDOW_FUTURE_HOURS = 48;

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

export type CalendarRef = { id: string };

export type ParsedEvent = {
  title: string;
  organizerEmail: string | null;
  occurredAt: string;
  endsAt: string | null;
  snippet: string | null;
};

// Events can live in any of the user's calendars (e.g. a separate "Formula 1"
// calendar), not just the primary one. Fetch the list first and only keep
// calendars the user actually owns/writes to (excludes shared read-only lists
// like holiday calendars).
export async function listCalendars(accessToken: string): Promise<CalendarRef[]> {
  const url = new URL(CALENDAR_LIST_API);
  url.searchParams.set('maxResults', '100');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new AuthError('Access token expired');
  }
  if (!res.ok) {
    throw new Error(`Calendar list failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    items?: { id?: string; accessRole?: string }[];
  };

  const refs: CalendarRef[] = [];
  for (const c of data.items ?? []) {
    if (c.id && (c.accessRole === 'owner' || c.accessRole === 'writer')) {
      refs.push({ id: c.id });
    }
  }
  return refs;
}

export async function listCalendarEvents(
  accessToken: string,
  calendars: CalendarRef[],
): Promise<{ event: CalendarEvent; calendarId: string }[]> {
  const events: { event: CalendarEvent; calendarId: string }[] = [];
  const now = new Date();
  // timeMin is intentionally in the PAST so events earlier today (in any
  // timezone) are still fetched; the local-day window filtering happens in the
  // popup/query layer.
  const timeMin = new Date(now.getTime() - WINDOW_PAST_HOURS * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + WINDOW_FUTURE_HOURS * 60 * 60 * 1000).toISOString();

  for (const cal of calendars) {
    let pageToken: string | null = null;
    do {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`,
      );
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
      if (data.items) {
        for (const ev of data.items) {
          events.push({ event: ev, calendarId: cal.id });
        }
      }
      pageToken = data.nextPageToken ?? null;
    } while (pageToken && events.length < MAX_EVENTS);
  }

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
  const calendars = await listCalendars(accessToken);
  const syncedEvents = await listCalendarEvents(accessToken, calendars);

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO synced_items
      (source, external_id, title, snippet, sender_email, occurred_at, ends_at, raw_json)
    VALUES ('calendar', ?, ?, ?, ?, ?, ?, ?)
  `);

  let synced = 0;
  for (const { event, calendarId } of syncedEvents) {
    try {
      const parsed = parseCalendarEvent(event);
      // Prefix with the calendar id so events with the same id in different
      // calendars don't collide (UNIQUE(source, external_id)).
      insertStmt.run(
        `${calendarId}/${event.id}`,
        parsed.title,
        parsed.snippet,
        parsed.organizerEmail,
        parsed.occurredAt,
        parsed.endsAt,
        JSON.stringify({ calendarId, event }),
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
