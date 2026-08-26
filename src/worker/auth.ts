import type { Context, Next } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { Env } from './types';

export const COOKIE_NAME = 'sa_session';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const secret = c.env?.APP_PASSWORD;
  if (!secret) return c.json({ error: 'unauthorized' }, 401);
  const ok = await getSignedCookie(c, secret, COOKIE_NAME);
  if (!ok) return c.json({ error: 'unauthorized' }, 401);
  await next();
}

export async function issueSession(c: Context<{ Bindings: Env }>) {
  await setSignedCookie(c, COOKIE_NAME, 'ok', c.env.APP_PASSWORD, {
    httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
}
