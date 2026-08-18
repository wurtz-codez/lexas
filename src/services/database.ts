import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

let db: Database.Database | null = null;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_context (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    display_name        TEXT,
    role                TEXT,
    focus_summary       TEXT,
    onboarding_completed INTEGER NOT NULL DEFAULT 0,
    updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS people (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    email        TEXT UNIQUE,
    company      TEXT,
    relationship TEXT,
    is_vip       INTEGER NOT NULL DEFAULT 0,
    notes        TEXT,
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_people (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, person_id)
);

CREATE TABLE IF NOT EXISTS synced_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source       TEXT NOT NULL,
    external_id  TEXT NOT NULL,
    title        TEXT,
    snippet      TEXT,
    sender_email TEXT,
    person_id    INTEGER REFERENCES people(id),
    project_id   INTEGER REFERENCES projects(id),
    occurred_at  TEXT,
    ends_at      TEXT,
    raw_json     TEXT,
    synced_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_synced_items_occurred_at ON synced_items(occurred_at);
CREATE INDEX IF NOT EXISTS idx_synced_items_person ON synced_items(person_id);
CREATE INDEX IF NOT EXISTS idx_synced_items_project ON synced_items(project_id);

CREATE TABLE IF NOT EXISTS item_links (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id         INTEGER NOT NULL REFERENCES synced_items(id) ON DELETE CASCADE,
    related_item_id INTEGER NOT NULL REFERENCES synced_items(id) ON DELETE CASCADE,
    link_type       TEXT NOT NULL,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (item_id, related_item_id, link_type)
);

CREATE TABLE IF NOT EXISTS briefs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    brief_date    TEXT NOT NULL,
    generated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brief_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    brief_id        INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
    synced_item_id  INTEGER NOT NULL REFERENCES synced_items(id) ON DELETE CASCADE,
    rank            INTEGER NOT NULL,
    reason          TEXT,
    score           REAL,
    suggested_action TEXT
);

CREATE INDEX IF NOT EXISTS idx_brief_items_brief ON brief_items(brief_id);

CREATE TABLE IF NOT EXISTS feedback (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_item_id INTEGER NOT NULL REFERENCES synced_items(id) ON DELETE CASCADE,
    feedback_type  TEXT NOT NULL,
    created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calendar_actions (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_item_id           INTEGER NOT NULL REFERENCES synced_items(id),
    created_event_external_id TEXT,
    created_at               TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    provider                TEXT PRIMARY KEY,
    encrypted_refresh_token BLOB NOT NULL,
    access_token            TEXT,
    access_token_expiry     TEXT,
    email                   TEXT,
    updated_at              TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

function runMigrations(database: Database.Database): void {
  const existing = database.prepare(
    "SELECT name FROM pragma_table_info('user_context') WHERE name = ?",
  );

  if (!existing.get('display_name')) {
    database.exec("ALTER TABLE user_context ADD COLUMN display_name TEXT");
  }
  if (!existing.get('onboarding_completed')) {
    database.exec("ALTER TABLE user_context ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0");
  }

  const briefItemsCols = database.prepare(
    "SELECT name FROM pragma_table_info('brief_items')",
  ).all() as { name: string }[];

  if (!briefItemsCols.some((c) => c.name === 'suggested_action')) {
    database.exec("ALTER TABLE brief_items ADD COLUMN suggested_action TEXT");
  }

  // Feedback used to reference brief_items(id), which are destroyed on every brief
  // regeneration (cascade delete) — that wiped user votes on refresh. Re-key to
  // synced_items(id) so "already reviewed" survives regenerate. Feedback is keyed
  // to the MAIL, not the transient brief row.
  const feedbackCols = database.prepare(
    "SELECT name FROM pragma_table_info('feedback')",
  ).all() as { name: string }[];

  if (feedbackCols.some((c) => c.name === 'brief_item_id')) {
    database.exec(`
      CREATE TABLE feedback_new (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        synced_item_id INTEGER NOT NULL REFERENCES synced_items(id) ON DELETE CASCADE,
        feedback_type  TEXT NOT NULL,
        created_at     TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    database.exec(`
      INSERT INTO feedback_new (synced_item_id, feedback_type, created_at)
      SELECT bi.synced_item_id, f.feedback_type, f.created_at
      FROM feedback f
      JOIN brief_items bi ON bi.id = f.brief_item_id
    `);
    database.exec('DROP TABLE feedback');
    database.exec('ALTER TABLE feedback_new RENAME TO feedback');
  }

  const itemLinksTable = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='item_links'",
  ).get() as { sql: string } | undefined;

  if (itemLinksTable && !itemLinksTable.sql.includes('UNIQUE')) {
    database.exec('DROP TABLE IF EXISTS item_links');
    database.exec(`
      CREATE TABLE item_links (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id         INTEGER NOT NULL REFERENCES synced_items(id) ON DELETE CASCADE,
        related_item_id INTEGER NOT NULL REFERENCES synced_items(id) ON DELETE CASCADE,
        link_type       TEXT NOT NULL,
        created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (item_id, related_item_id, link_type)
      )
    `);
  }
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): Database.Database {
  if (db) return db;

  try {
    const dbDir = path.join(app.getPath('userData'), 'data');
    fs.mkdirSync(dbDir, { recursive: true });

    const dbPath = path.join(dbDir, 'lexas.db');
    process.stderr.write(`[DB] Opening ${dbPath}\n`);
    db = new Database(dbPath);

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(SCHEMA);

    runMigrations(db);

    process.stderr.write(`[DB] Initialized at ${dbPath}\n`);
  } catch (err) {
    process.stderr.write(`[DB] FATAL: ${err}\n`);
    throw err;
  }

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Closed');
  }
}
