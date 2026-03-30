ALTER TABLE emails ADD COLUMN status TEXT NOT NULL DEFAULT 'unread';
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
