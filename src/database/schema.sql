-- Lexas: Personal Brief App — SQLite schema (v1)
-- Initialized automatically by src/services/database.ts on app start.

PRAGMA foreign_keys = ON;

-- ============================================================
-- CONTEXT: who you are, what you're working on, who matters
-- ============================================================

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

-- ============================================================
-- SYNCED DATA: emails + calendar events, unified
-- ============================================================

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

-- ============================================================
-- BRIEFS: the daily ranked output
-- ============================================================

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

-- ============================================================
-- FEEDBACK: closes the personalization loop
-- Append-only log keyed to the MAIL (synced_item_id) so "already
-- reviewed" survives brief regeneration.
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_item_id INTEGER NOT NULL REFERENCES synced_items(id) ON DELETE CASCADE,
    feedback_type  TEXT NOT NULL,
    created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ACTIONS: e.g. "add to calendar" from an email
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_actions (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_item_id           INTEGER NOT NULL REFERENCES synced_items(id),
    created_event_external_id TEXT,
    created_at               TEXT DEFAULT CURRENT_TIMESTAMP
);
