-- Split large email bodies out of the hot `emails` table (see src/services/bodies.ts).
--
-- `emails` stores html/text/headers (up to 500KB each) inline, physically before
-- the metadata columns. SQLite/D1 reads a row's columns in order via its
-- overflow-page chain, so ANY read touching a post-blob column drags the whole
-- body out of storage — which is why list, count, and single-row reads were all
-- slow. Bodies move into their own table so metadata reads never touch them.
--
-- This migration only CREATES TABLES — it never scans or rewrites `emails`, so it
-- is instant and safe on a database of any size. The actual data move (copying
-- existing bodies into email_bodies, NULLing the legacy columns) and the covering
-- index are done incrementally by the scheduled handler in src/services/bodies.ts,
-- because a table-wide copy/index-build over a bloated table exceeds D1's
-- per-statement time limit (verified: a full-body scan returns error 7009).
CREATE TABLE IF NOT EXISTS email_bodies (
  email_id TEXT PRIMARY KEY REFERENCES emails(id) ON DELETE CASCADE,
  html     TEXT,
  text     TEXT,
  headers  TEXT
);

-- Small key/value table for one-off app state — used here to record that the
-- body split has fully completed so the scheduled handler can become a no-op.
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
