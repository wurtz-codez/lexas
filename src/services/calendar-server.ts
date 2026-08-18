import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import { getDb } from './database';
import { getValidAccessToken } from './oauth-server';
import { AuthError } from './gmail-sync';
import type { CreateEventRequest, CreateEventResult } from '@/types';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export async function createCalendarEvent(
  db: Database.Database,
  details: CreateEventRequest,
): Promise<CreateEventResult> {
  if (!Number.isInteger(details.synced_item_id)) {
    throw new Error('calendar:createEvent requires an integer synced_item_id');
  }
  if (!details.title || !details.title.trim()) {
    throw new Error('calendar:createEvent requires a non-empty title');
  }
  if (Number.isNaN(Date.parse(details.start)) || Number.isNaN(Date.parse(details.end))) {
    throw new Error('calendar:createEvent requires valid start/end datetimes');
  }

  const accessToken = await getValidAccessToken('google');

  const res = await fetch(CALENDAR_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: details.title.trim(),
      start: { dateTime: details.start },
      end: { dateTime: details.end },
    }),
  });

  if (res.status === 401) {
    throw new AuthError('Access token expired');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar create failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error('Calendar create succeeded but returned no event id');
  }

  db.prepare(
    'INSERT INTO calendar_actions (synced_item_id, created_event_external_id) VALUES (?, ?)',
  ).run(details.synced_item_id, data.id);

  process.stderr.write(
    `[calendar:createEvent] Created event ${data.id} for synced_item ${details.synced_item_id}\n`,
  );

  return { event_id: data.id };
}

export function registerCalendarHandlers(): void {
  ipcMain.handle(
    'calendar:createEvent',
    async (_event, details: CreateEventRequest): Promise<CreateEventResult> => {
      return createCalendarEvent(getDb(), details);
    },
  );
}
