import { Hono } from 'hono';
import type { Bindings } from '../bindings';
import { apiKeyAuth } from '../middleware/auth';

const ingest = new Hono<{ Bindings: Bindings }>();

ingest.use('*', apiKeyAuth);

const MAX_BODY_SIZE = 500 * 1024; // 500KB

ingest.post('/', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { to, from, subject, html, text, headers, message_id, channel, attachments } = body;

  // Validate required fields
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return c.json({ error: 'Invalid or missing "to" field' }, 422);
  }
  if (!from || typeof from !== 'string' || !from.includes('@')) {
    return c.json({ error: 'Invalid or missing "from" field' }, 422);
  }
  if (!subject || typeof subject !== 'string' || subject.trim() === '') {
    return c.json({ error: 'Invalid or missing "subject" field' }, 422);
  }
  if (!html && !text) {
    return c.json({ error: 'At least one of "html" or "text" must be provided' }, 422);
  }

  const id = crypto.randomUUID();
  const trimmedSubject = subject.trim();
  const channelValue = typeof channel === 'string' && channel.trim() ? channel.trim() : 'default';
  const truncatedHtml = typeof html === 'string' ? html.slice(0, MAX_BODY_SIZE) : null;
  const truncatedText = typeof text === 'string' ? text.slice(0, MAX_BODY_SIZE) : null;
  const headersJson = headers && typeof headers === 'object' ? JSON.stringify(headers) : null;
  const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

  await c.env.DB.prepare(
    `INSERT INTO emails (id, message_id, "to", "from", subject, html, text, headers, channel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, message_id ?? null, to, from, trimmedSubject, truncatedHtml, truncatedText, headersJson, channelValue)
    .run();

  // Store attachments in R2
  let attachmentCount = 0;
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (!att.filename || !att.content_type || !att.content) continue;
      const attId = crypto.randomUUID();
      const r2Key = `${id}/${attId}/${att.filename}`;
      const binary = Uint8Array.from(atob(att.content), (c) => c.charCodeAt(0));

      await c.env.ATTACHMENTS.put(r2Key, binary, {
        httpMetadata: { contentType: att.content_type },
      });

      await c.env.DB.prepare(
        `INSERT INTO attachments (id, email_id, filename, content_type, size, r2_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(attId, id, att.filename, att.content_type, binary.byteLength, r2Key)
        .run();

      attachmentCount++;
    }
  }

  // Notify connected clients via WebSocket
  const doId = c.env.REALTIME.idFromName('inbox');
  const stub = c.env.REALTIME.get(doId);
  await stub.fetch('http://realtime/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-partykit-namespace': 'realtime',
      'x-partykit-room': 'inbox',
    },
    body: JSON.stringify({ id, message_id: message_id ?? null, to, from, subject: trimmedSubject, channel: channelValue, created_at: createdAt, attachment_count: attachmentCount }),
  });

  return c.json({ id }, 201);
});

export default ingest;
