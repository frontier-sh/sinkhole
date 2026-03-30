import { createMiddleware } from 'hono/factory';
import { getCookie, deleteCookie } from 'hono/cookie';
import type { Bindings } from '../bindings';
import { validateApiKey } from '../services/api-keys';

export async function deriveCookieSecret(
  clientSecret: string,
): Promise<string> {
  return signValue('sinkhole-cookie-signing', clientSecret);
}

export async function signValue(
  value: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(value),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySignature(
  value: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await signValue(value, secret);
  return expected === signature;
}

/**
 * API key authentication middleware for the ingest endpoint.
 * Validates X-API-Key header against stored API keys.
 */
export const apiKeyAuth = createMiddleware<{ Bindings: Bindings }>(
  async (c, next) => {
    const apiKey = c.req.header('X-API-Key');
    if (!apiKey) {
      return c.json({ error: 'Missing X-API-Key header' }, 401);
    }

    const valid = await validateApiKey(c.env.DB, apiKey);
    if (!valid) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    await next();
  },
);

type SessionAuthEnv = {
  Bindings: Bindings;
  Variables: { githubUser: string };
};

/**
 * Session authentication middleware factory.
 * Validates signed session cookie.
 * Cookie format: "github:{username}:{expiry_ms}.{hmac_signature}"
 */
function createSessionAuth(onError: (c: any) => Response, onExpired?: (c: any) => Response) {
  return createMiddleware<SessionAuthEnv>(async (c, next) => {
    if (c.env.DISABLE_AUTH === 'true') {
      c.set('githubUser', 'local');
      return next();
    }

    const sessionCookie = getCookie(c, 'sinkhole_session');
    if (!sessionCookie) return onError(c);

    const dotIndex = sessionCookie.lastIndexOf('.');
    if (dotIndex === -1) return onError(c);

    const value = sessionCookie.slice(0, dotIndex);
    const signature = sessionCookie.slice(dotIndex + 1);

    const cookieSecret = await deriveCookieSecret(c.env.GITHUB_CLIENT_SECRET);
    const valid = await verifySignature(value, signature, cookieSecret);
    if (!valid) return onError(c);

    const parts = value.split(':');
    if (parts.length !== 3 || parts[0] !== 'github') return onError(c);

    const [, username, expiryStr] = parts;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) {
      deleteCookie(c, 'sinkhole_session', { path: '/' });
      return (onExpired ?? onError)(c);
    }

    c.set('githubUser', username);
    await next();
  });
}

export const sessionAuth = createSessionAuth(
  (c) => c.redirect('/login'),
);

export const sessionAuthApi = createSessionAuth(
  (c) => c.json({ error: 'Not authenticated' }, 401),
  (c) => c.json({ error: 'Session expired' }, 401),
);
