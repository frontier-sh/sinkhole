/**
 * Automatic, incremental migration of email bodies out of the `emails` table
 * and into `email_bodies` (created by migration 0004).
 *
 * Runs itself in the background off normal request traffic — no operator commands
 * and no perpetual cron. It is self-hosted-safe at any data size: a single
 * table-wide backfill or covering-index build over a bloated table exceeds D1's
 * per-statement time limit, so the work is done in bounded batches across a few
 * requests and self-terminates once the table is lean and indexed. Completion is
 * recorded in app_meta and cached per-isolate, so once done it costs nothing:
 * warm isolates short-circuit on a boolean, and a fresh isolate does a single
 * cheap lookup before latching off for good.
 *
 * Meanwhile the read path (src/routes/api.ts fetchBodies) falls back to the
 * legacy inline columns, so reads stay correct for rows not yet migrated.
 */

const DONE_KEY = 'bodies_split_done';
const BATCH = 50; // rows per statement — stays under D1's 100 bound-param limit
const MAX_BATCHES_PER_RUN = 10; // ~500 rows per background pass

// Per-isolate latches: once this isolate has seen the split finish it never
// touches the DB for it again; `inFlight` prevents overlapping passes.
let completed = false;
let inFlight = false;

// Move one batch of legacy inline bodies into email_bodies, then NULL the source
// columns so those rows become lean. Reading `id` (column 0) is cheap even on a
// bloated table. Returns how many rows were moved (0 when nothing is left).
async function migrateBatch(db: D1Database): Promise<number> {
  const rows = await db
    .prepare(
      'SELECT id FROM emails WHERE id NOT IN (SELECT email_id FROM email_bodies) LIMIT ?',
    )
    .bind(BATCH)
    .all<{ id: string }>();

  const ids = rows.results.map((r) => r.id);
  if (ids.length === 0) return 0;

  const placeholders = ids.map(() => '?').join(',');
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO email_bodies (email_id, html, text, headers)
         SELECT id, html, text, headers FROM emails WHERE id IN (${placeholders})`,
      )
      .bind(...ids),
    db
      .prepare(`UPDATE emails SET html = NULL, text = NULL, headers = NULL WHERE id IN (${placeholders})`)
      .bind(...ids),
  ]);

  return ids.length;
}

// Create the covering index and drop the now-redundant ones. Only cheap once the
// table is lean, so this is called after the backlog is fully drained. Idempotent.
async function ensureIndexes(db: D1Database): Promise<void> {
  await db
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_emails_list ON emails(created_at DESC, status, channel, id, "to", "from", subject)',
    )
    .run();
  await db.prepare('DROP INDEX IF EXISTS idx_emails_created_at').run();
  await db.prepare('DROP INDEX IF EXISTS idx_emails_channel').run();
}

/**
 * Kick the split forward in the background, if it isn't already done or running
 * in this isolate. Call once per request — it's a couple of boolean checks in the
 * common (already-finished) case and otherwise advances the migration off the
 * request's waitUntil without adding latency to the response.
 */
export function kickBodySplit(db: D1Database, ctx: ExecutionContext): void {
  if (completed || inFlight) return;
  inFlight = true;
  ctx.waitUntil(
    runBodySplitPass(db)
      .then((done) => {
        if (done) completed = true;
      })
      .catch((err) => {
        // Transient D1 errors just mean the next request retries.
        console.error('body split failed:', err);
      })
      .finally(() => {
        inFlight = false;
      }),
  );
}

/**
 * One bounded pass: drain a slice of the backlog; if nothing remains, build the
 * covering index (safe now the table is lean) and mark the split complete.
 * Returns true when the split is fully finished.
 */
async function runBodySplitPass(db: D1Database): Promise<boolean> {
  const done = await db
    .prepare('SELECT 1 AS v FROM app_meta WHERE key = ?')
    .bind(DONE_KEY)
    .first<{ v: number }>();
  if (done) return true;

  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    if ((await migrateBatch(db)) === 0) break;
  }

  const pending = await db
    .prepare('SELECT 1 AS v FROM emails WHERE id NOT IN (SELECT email_id FROM email_bodies) LIMIT 1')
    .first<{ v: number }>();
  if (pending) return false; // more to do on a later request

  await ensureIndexes(db);
  await db
    .prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)')
    .bind(DONE_KEY, '1')
    .run();
  return true;
}
