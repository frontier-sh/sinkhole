import { Hono } from 'hono';
import type { Bindings } from '../bindings';
import { sessionAuthApi } from '../middleware/auth';
import { createApiKey, listApiKeys, deleteApiKey } from '../services/api-keys';

const api = new Hono<{ Bindings: Bindings; Variables: { githubUser: string } }>();

api.use('*', sessionAuthApi);

// GET /api/channels — List distinct channels
api.get('/channels', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT DISTINCT channel FROM emails ORDER BY channel',
  ).all<{ channel: string }>();
  return c.json({ data: result.results.map((r) => r.channel) });
});

// GET /api/emails — List emails (paginated, with optional filters)
api.get('/emails', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
  const perPage = Math.min(200, Math.max(1, parseInt(c.req.query('per_page') ?? '50', 10) || 50));
  const offset = (page - 1) * perPage;

  const conditions: string[] = [];
  const binds: (string | number)[] = [];

  // Status filter: defaults to excluding archived, 'all' shows everything
  const status = c.req.query('status');
  if (status && status !== 'all') {
    conditions.push('status = ?'); binds.push(status);
  } else if (!status) {
    conditions.push('status != ?'); binds.push('archived');
  }

  const channel = c.req.query('channel');
  if (channel) { conditions.push('channel = ?'); binds.push(channel); }

  const search = c.req.query('search');
  if (search) {
    conditions.push('(subject LIKE ? OR "from" LIKE ? OR "to" LIKE ?)');
    const like = `%${search}%`;
    binds.push(like, like, like);
  }

  const fromFilter = c.req.query('from');
  if (fromFilter) { conditions.push('"from" LIKE ?'); binds.push(`%${fromFilter}%`); }

  const toFilter = c.req.query('to');
  if (toFilter) { conditions.push('"to" LIKE ?'); binds.push(`%${toFilter}%`); }

  const dateFrom = c.req.query('date_from');
  if (dateFrom) { conditions.push('created_at >= ?'); binds.push(dateFrom); }

  const dateTo = c.req.query('date_to');
  if (dateTo) { conditions.push('created_at <= ?'); binds.push(dateTo + ' 23:59:59'); }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const [countResult, emails] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM emails ${whereClause}`)
      .bind(...binds)
      .first<{ total: number }>(),
    c.env.DB.prepare(
      `SELECT id, "to", "from", subject, channel, status, created_at
       FROM emails ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...binds, perPage, offset)
      .all<{ id: string; to: string; from: string; subject: string; channel: string; status: string; created_at: string }>(),
  ]);

  return c.json({
    data: emails.results,
    total: countResult?.total ?? 0,
    page,
    per_page: perPage,
  });
});

// GET /api/emails/:id — Get full email record (marks as read)
api.get('/emails/:id', async (c) => {
  const id = c.req.param('id');
  const email = await c.env.DB.prepare('SELECT * FROM emails WHERE id = ?')
    .bind(id)
    .first();

  if (!email) {
    return c.json({ error: 'Email not found' }, 404);
  }

  if ((email as any).status === 'unread') {
    await c.env.DB.prepare('UPDATE emails SET status = ? WHERE id = ?').bind('read', id).run();
    (email as any).status = 'read';
  }

  return c.json(email);
});

// PATCH /api/emails/:id/status — Update email status (read, unread, archived)
api.patch('/emails/:id/status', async (c) => {
  const id = c.req.param('id');
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { status } = body;
  if (!['unread', 'read', 'archived'].includes(status)) {
    return c.json({ error: 'Status must be unread, read, or archived' }, 422);
  }

  await c.env.DB.prepare('UPDATE emails SET status = ? WHERE id = ?').bind(status, id).run();
  return c.json({ id, status });
});

// GET /api/emails/:id/html — Get raw HTML body for iframe
api.get('/emails/:id/html', async (c) => {
  const id = c.req.param('id');
  const email = await c.env.DB.prepare('SELECT html FROM emails WHERE id = ?')
    .bind(id)
    .first<{ html: string | null }>();

  if (!email || !email.html) {
    return c.html('<p style="color:#888;font-family:sans-serif;padding:1rem;">No HTML content</p>');
  }

  return c.html(email.html);
});

// GET /api/emails/:id/attachments — List attachments for an email
api.get('/emails/:id/attachments', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(
    'SELECT id, filename, content_type, size FROM attachments WHERE email_id = ? ORDER BY created_at',
  )
    .bind(id)
    .all<{ id: string; filename: string; content_type: string; size: number }>();
  return c.json({ data: result.results });
});

// GET /api/emails/:id/attachments/:aid — Download/view attachment
api.get('/emails/:id/attachments/:aid', async (c) => {
  const aid = c.req.param('aid');
  const att = await c.env.DB.prepare(
    'SELECT r2_key, filename, content_type FROM attachments WHERE id = ?',
  )
    .bind(aid)
    .first<{ r2_key: string; filename: string; content_type: string }>();

  if (!att) return c.json({ error: 'Attachment not found' }, 404);

  const object = await c.env.ATTACHMENTS.get(att.r2_key);
  if (!object) return c.json({ error: 'Attachment data not found' }, 404);

  const download = c.req.query('download') === '1';
  const disposition = download
    ? `attachment; filename="${att.filename}"`
    : `inline; filename="${att.filename}"`;

  return new Response(object.body, {
    headers: {
      'Content-Type': att.content_type,
      'Content-Disposition': disposition,
    },
  });
});

// DELETE /api/emails/:id — Delete single email and its attachments
api.delete('/emails/:id', async (c) => {
  const id = c.req.param('id');

  const atts = await c.env.DB.prepare('SELECT r2_key FROM attachments WHERE email_id = ?')
    .bind(id)
    .all<{ r2_key: string }>();
  await Promise.all(atts.results.map((a) => c.env.ATTACHMENTS.delete(a.r2_key)));

  await c.env.DB.prepare('DELETE FROM attachments WHERE email_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM emails WHERE id = ?').bind(id).run();
  return c.body(null, 204);
});

// DELETE /api/emails — Clear all emails and attachments
api.delete('/emails', async (c) => {
  const atts = await c.env.DB.prepare('SELECT r2_key FROM attachments').all<{ r2_key: string }>();
  await Promise.all(atts.results.map((a) => c.env.ATTACHMENTS.delete(a.r2_key)));

  await c.env.DB.prepare('DELETE FROM attachments').run();
  await c.env.DB.prepare('DELETE FROM emails').run();
  return c.body(null, 204);
});

// GET /api/keys — List API keys
api.get('/keys', async (c) => {
  const keys = await listApiKeys(c.env.DB);
  return c.json({ data: keys });
});

// POST /api/keys — Create API key
api.post('/keys', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const name = body.name?.trim();
  if (!name) {
    return c.json({ error: 'Name is required' }, 422);
  }

  const result = await createApiKey(c.env.DB, name);
  return c.json(result, 201);
});

// DELETE /api/keys/:id — Delete API key
api.delete('/keys/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) {
    return c.json({ error: 'Invalid key ID' }, 400);
  }

  const deleted = await deleteApiKey(c.env.DB, id);
  if (!deleted) {
    return c.json({ error: 'API key not found' }, 404);
  }

  return c.body(null, 204);
});

export default api;
