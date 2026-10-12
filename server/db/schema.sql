-- Database structure. Every statement uses "IF NOT EXISTS", so this file can be
-- run safely each time the server starts.

-- Dashboard accounts. Passwords are stored only as salted scrypt hashes.
CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Server-side login sessions (the browser only receives a random session id).
CREATE TABLE IF NOT EXISTS sessions (
  sid        TEXT    PRIMARY KEY,
  data       TEXT    NOT NULL,
  expires_at INTEGER NOT NULL
);

-- All editable page text, labels and theme colours, stored as key/value pairs.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- One row per uploaded file. The file itself lives in DATA_DIR/uploads/<stored_name>.
CREATE TABLE IF NOT EXISTS media (
  id            INTEGER PRIMARY KEY,
  stored_name   TEXT    NOT NULL UNIQUE,
  original_name TEXT    NOT NULL,
  mime_type     TEXT    NOT NULL,
  size_bytes    INTEGER NOT NULL,
  kind          TEXT    NOT NULL CHECK (kind IN ('image', 'pdf', 'icon')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id             INTEGER PRIMARY KEY,
  title          TEXT    NOT NULL,
  description    TEXT    NOT NULL DEFAULT '',
  project_type   TEXT    NOT NULL CHECK (project_type IN ('github', 'website', 'other')),
  url            TEXT    NOT NULL DEFAULT '',
  cover_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  cover_alt      TEXT    NOT NULL DEFAULT '',
  tags           TEXT    NOT NULL DEFAULT '[]',  -- JSON array of strings
  project_date   TEXT    NOT NULL DEFAULT '',    -- YYYY-MM-DD or empty
  is_featured    INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS research (
  id             INTEGER PRIMARY KEY,
  title          TEXT    NOT NULL,
  abstract       TEXT    NOT NULL DEFAULT '',
  authors        TEXT    NOT NULL DEFAULT '',
  published_date TEXT    NOT NULL DEFAULT '',    -- YYYY-MM-DD or empty
  tags           TEXT    NOT NULL DEFAULT '[]',  -- JSON array of strings
  doc_type       TEXT    NOT NULL DEFAULT '',
  pdf_media_id   INTEGER REFERENCES media(id) ON DELETE SET NULL,
  external_url   TEXT    NOT NULL DEFAULT '',
  cover_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  cover_alt      TEXT    NOT NULL DEFAULT '',
  is_featured    INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Optional structured CV shown below the PDF. These rows never modify the PDF itself.
CREATE TABLE IF NOT EXISTS cv_entries (
  id           INTEGER PRIMARY KEY,
  section      TEXT    NOT NULL CHECK (section IN ('education', 'experience', 'volunteering', 'skills', 'languages')),
  title        TEXT    NOT NULL,
  organization TEXT    NOT NULL DEFAULT '',
  location     TEXT    NOT NULL DEFAULT '',
  period       TEXT    NOT NULL DEFAULT '',
  description  TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_order   ON projects (sort_order, id);
CREATE INDEX IF NOT EXISTS idx_research_order   ON research (sort_order, id);
CREATE INDEX IF NOT EXISTS idx_cv_entries_order ON cv_entries (section, sort_order, id);
