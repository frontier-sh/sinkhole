import { Hono } from 'hono';
import type { Bindings } from './bindings';
import auth from './routes/auth';
import ingest from './routes/ingest';
import api from './routes/api';
import pages from './routes/pages';
export { RealtimeServer } from './realtime';

const app = new Hono<{ Bindings: Bindings }>();

// WebSocket upgrade — forward to RealtimeServer DO
app.get('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426);
  }
  const doId = c.env.REALTIME.idFromName('inbox');
  const stub = c.env.REALTIME.get(doId);
  const req = new Request(c.req.raw);
  req.headers.set('x-partykit-namespace', 'realtime');
  req.headers.set('x-partykit-room', 'inbox');
  return stub.fetch(req);
});

// Mount route groups
app.route('/auth', auth);
app.route('/ingest', ingest);
app.route('/api', api);
app.route('/', pages);

export default app;
