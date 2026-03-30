CREATE TABLE IF NOT EXISTS attachments (
  id          TEXT PRIMARY KEY,
  email_id    TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size        INTEGER NOT NULL,
  r2_key      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);
