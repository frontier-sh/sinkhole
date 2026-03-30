import { Hono } from 'hono';
import type { Bindings } from '../bindings';
import { sessionAuth } from '../middleware/auth';
import { LoginPage } from '../views/login';
import { InboxPage } from '../views/inbox';

const pages = new Hono<{ Bindings: Bindings; Variables: { githubUser: string } }>();

// Login page — public (redirect to inbox if auth is disabled)
pages.get('/login', (c) => {
  if (c.env.DISABLE_AUTH === 'true') return c.redirect('/');
  const error = c.req.query('error');
  const org = c.req.query('org');
  return c.html(<LoginPage error={error} org={org} />);
});

// Inbox — requires session
pages.get('/', sessionAuth, (c) => {
  const githubUser = c.get('githubUser');
  const authDisabled = c.env.DISABLE_AUTH === 'true';
  return c.html(<InboxPage githubUser={githubUser} authDisabled={authDisabled} />);
});

export default pages;
