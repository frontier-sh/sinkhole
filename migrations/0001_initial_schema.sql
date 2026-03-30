CREATE TABLE IF NOT EXISTS emails (
  id          TEXT PRIMARY KEY,
  message_id  TEXT,
  "to"        TEXT NOT NULL,
  "from"      TEXT NOT NULL,
  subject     TEXT NOT NULL,
  html        TEXT,
  text        TEXT,
  headers     TEXT,
  channel     TEXT NOT NULL DEFAULT 'default',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_channel ON emails(channel);

CREATE TABLE IF NOT EXISTS api_keys (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);
