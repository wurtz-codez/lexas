import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

let db: Database.Database | null = null;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_context (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    role          TEXT,
    focus_summary TEXT,
    updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
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
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
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
    score           REAL
);

CREATE INDEX IF NOT EXISTS idx_brief_items_brief ON brief_items(brief_id);

CREATE TABLE IF NOT EXISTS feedback (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    brief_item_id  INTEGER NOT NULL REFERENCES brief_items(id) ON DELETE CASCADE,
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
