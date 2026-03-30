import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Bindings } from '../bindings';
import { signValue, verifySignature, deriveCookieSecret } from '../middleware/auth';
import {
  getGitHubAuthUrl,
  exchangeCodeForToken,
  getGitHubUser,
  checkOrgMembership,
  checkTeamMembership,
} from '../services/github';

const auth = new Hono<{ Bindings: Bindings }>();

/**
 * GET /auth/github — Initiate GitHub OAuth flow.
 */
auth.get('/github', async (c) => {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = c.env;
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return c.text('GitHub OAuth is not configured.', 500);
  }

  const state = crypto.randomUUID();
  const signedState = `${state}.${await signValue(state, GITHUB_CLIENT_SECRET)}`;

  setCookie(c, 'sinkhole_oauth_state', signedState, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/auth',
    maxAge: 300,
  });

  const url = new URL(c.req.url);
  const redirectUri = `${url.protocol}//${url.host}/auth/github/callback`;
  const authUrl = getGitHubAuthUrl(GITHUB_CLIENT_ID, redirectUri, state);

  return c.redirect(authUrl);
});

/**
 * GET /auth/github/callback — Handle GitHub OAuth callback.
 */
auth.get('/github/callback', async (c) => {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_ALLOWED_ORG, GITHUB_ALLOWED_TEAM } = c.env;

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect('/login?error=oauth_denied');
  }

  if (!code || !state) {
    return c.redirect('/login?error=oauth_failed');
  }

  // Verify CSRF state
  const stateCookie = getCookie(c, 'sinkhole_oauth_state');
  deleteCookie(c, 'sinkhole_oauth_state', { path: '/auth' });

  if (!stateCookie) {
    return c.redirect('/login?error=csrf_failed');
  }

  const dotIndex = stateCookie.lastIndexOf('.');
  if (dotIndex === -1) {
    return c.redirect('/login?error=csrf_failed');
  }

  const cookieState = stateCookie.slice(0, dotIndex);
  const cookieSignature = stateCookie.slice(dotIndex + 1);

  const stateValid = await verifySignature(
    cookieState,
    cookieSignature,
    GITHUB_CLIENT_SECRET,
  );
  if (!stateValid || cookieState !== state) {
    return c.redirect('/login?error=csrf_failed');
  }

  // Exchange code for access token
  const url = new URL(c.req.url);
  const redirectUri = `${url.protocol}//${url.host}/auth/github/callback`;

  const accessToken = await exchangeCodeForToken(
    code,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    redirectUri,
  );
  if (!accessToken) {
    return c.redirect('/login?error=oauth_failed');
  }

  // Fetch GitHub user
  const user = await getGitHubUser(accessToken);
  if (!user) {
    return c.redirect('/login?error=oauth_failed');
  }

  // Check org/team membership
  let hasAccess: boolean;
  if (GITHUB_ALLOWED_TEAM) {
    hasAccess = await checkTeamMembership(accessToken, GITHUB_ALLOWED_TEAM, user.login);
  } else {
    hasAccess = await checkOrgMembership(accessToken, GITHUB_ALLOWED_ORG);
  }
  if (!hasAccess) {
    const target = GITHUB_ALLOWED_TEAM ?? GITHUB_ALLOWED_ORG;
    return c.redirect(
      `/login?error=no_access&org=${encodeURIComponent(target)}`,
    );
  }

  // Create signed session cookie
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const sessionValue = `github:${user.login}:${expiry}`;
  const cookieSecret = await deriveCookieSecret(GITHUB_CLIENT_SECRET);
  const signature = await signValue(sessionValue, cookieSecret);

  setCookie(c, 'sinkhole_session', `${sessionValue}.${signature}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.redirect('/');
});

/**
 * POST /auth/logout — Destroy session and redirect to login.
 */
auth.post('/logout', (c) => {
  deleteCookie(c, 'sinkhole_session', { path: '/' });
  return c.redirect('/login');
});

export default auth;
