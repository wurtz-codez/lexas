import type Database from 'better-sqlite3';

const PERSON_WINDOW_SECONDS = 24 * 60 * 60;
const PROJECT_WINDOW_SECONDS = 72 * 60 * 60;

export type CorrelationResult = {
  resolved: number;
  links: number;
};

type UnresolvedItem = {
  id: number;
  source: string;
  sender_email: string | null;
  title: string | null;
  snippet: string | null;
  raw_json: string | null;
  person_id: number | null;
  project_id: number | null;
};

export async function resolveItems(
  db: Database.Database,
  connectedEmail: string | null,
): Promise<number> {
  const people = db.prepare(
    'SELECT id, email FROM people WHERE email IS NOT NULL AND email != ?',
  ).all('') as { id: number; email: string }[];

  const emailToPerson = new Map<string, number>();
  for (const p of people) {
    emailToPerson.set(p.email.toLowerCase(), p.id);
  }

  const projects = db.prepare(
    'SELECT id, name FROM projects WHERE status = ?',
  ).all('active') as { id: number; name: string }[];

  const items = db.prepare(`
    SELECT id, source, sender_email, title, snippet, raw_json, person_id, project_id
    FROM synced_items
    WHERE person_id IS NULL OR project_id IS NULL
  `).all() as UnresolvedItem[];

  if (items.length === 0) return 0;

  const updatePerson = db.prepare('UPDATE synced_items SET person_id = ? WHERE id = ? AND person_id IS NULL');
  const updateProject = db.prepare('UPDATE synced_items SET project_id = ? WHERE id = ? AND project_id IS NULL');
  const resolvedIds: number[] = [];

  for (const item of items) {
    let personId: number | null = null;
    let projectId: number | null = null;

    if (item.source === 'email' && item.sender_email && !item.person_id) {
      personId = emailToPerson.get(item.sender_email.toLowerCase()) ?? null;
    }

    if (item.source === 'calendar' && item.raw_json && !item.person_id) {
      try {
        const parsed = JSON.parse(item.raw_json);
        const attendees: { email?: string }[] = parsed.attendees ?? [];
        for (const attendee of attendees) {
          if (!attendee.email) continue;
          const normalized = attendee.email.toLowerCase();
          if (connectedEmail && normalized === connectedEmail.toLowerCase()) continue;
          const match = emailToPerson.get(normalized);
          if (match) {
            personId = match;
            break;
          }
        }
      } catch {
        // malformed raw_json — skip attendee parsing
      }
    }

    if (!item.project_id) {
      const haystack = ((item.title ?? '') + ' ' + (item.snippet ?? '')).toLowerCase();
      for (const project of projects) {
        if (haystack.includes(project.name.toLowerCase())) {
          projectId = project.id;
          break;
        }
      }
    }

    const origPersonId = item.person_id;
    const origProjectId = item.project_id;

    if (personId !== null && personId !== origPersonId) {
      updatePerson.run(personId, item.id);
    }
    if (projectId !== null && projectId !== origProjectId) {
      updateProject.run(projectId, item.id);
    }
    if ((personId !== null && personId !== origPersonId) || (projectId !== null && projectId !== origProjectId)) {
      resolvedIds.push(item.id);
    }
  }

  return resolvedIds.length;
}

export async function linkItems(
  db: Database.Database,
): Promise<number> {
  let inserted = 0;

  const personLinks = db.prepare(`
    INSERT OR IGNORE INTO item_links (item_id, related_item_id, link_type)
    SELECT
      MIN(a.id, b.id),
      MAX(a.id, b.id),
      'same_person'
    FROM synced_items a
    JOIN synced_items b ON a.person_id = b.person_id AND a.id != b.id
    WHERE a.person_id IS NOT NULL
      AND a.occurred_at IS NOT NULL
      AND b.occurred_at IS NOT NULL
      AND abs(
        strftime('%s', a.occurred_at) - strftime('%s', b.occurred_at)
      ) <= ?
  `).run(PERSON_WINDOW_SECONDS);
  inserted += personLinks.changes;

  const projectLinks = db.prepare(`
    INSERT OR IGNORE INTO item_links (item_id, related_item_id, link_type)
    SELECT
      MIN(a.id, b.id),
      MAX(a.id, b.id),
      'same_project'
    FROM synced_items a
    JOIN synced_items b ON a.project_id = b.project_id AND a.id != b.id
    WHERE a.project_id IS NOT NULL
      AND a.occurred_at IS NOT NULL
      AND b.occurred_at IS NOT NULL
      AND abs(
        strftime('%s', a.occurred_at) - strftime('%s', b.occurred_at)
      ) <= ?
  `).run(PROJECT_WINDOW_SECONDS);
  inserted += projectLinks.changes;

  return inserted;
}

export async function runCorrelation(
  db: Database.Database,
  connectedEmail: string | null,
): Promise<CorrelationResult> {
  process.stderr.write('[correlation] Starting correlation pass\n');

  const resolved = await resolveItems(db, connectedEmail);
  process.stderr.write(`[correlation] Resolved ${resolved} items (person_id/project_id)\n`);

  const links = await linkItems(db);
  process.stderr.write(`[correlation] Created ${links} item_links\n`);

  return { resolved, links };
}
