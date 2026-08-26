import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../src/worker/auth';
import { setSignedCookie } from 'hono/cookie';

const makeApp = () => {
  const a = new Hono<{ Bindings: { APP_PASSWORD: string } }>();
  a.use('/api/*', authMiddleware);
  a.get('/api/ping', (c) => c.json({ ok: true }));
  return a;
};

describe('auth', () => {
  it('401 without cookie', async () => {
    const res = await makeApp().request('/api/ping');
    expect(res.status).toBe(401);
  });

  it('200 with valid signed cookie (set via helper like the login route does)', async () => {
    const secret = 'pw';
    const c: any = { req: { url: 'http://x/', headers: new Headers() }, res: undefined };
    // simulate what POST /api/auth does:
    const app = new Hono<{ Bindings: { APP_PASSWORD: string } }>();
    app.post('/login', async (ctx) => {
      await setSignedCookie(ctx, 'sa_session', 'ok', ctx.env.APP_PASSWORD, { httpOnly: true, sameSite: 'Lax', path: '/' });
      return ctx.json({ ok: true });
    });
    const loginRes = await app.request('/login', { method: 'POST' }, { APP_PASSWORD: secret });
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0];
    const res = await makeApp().request('/api/ping', { headers: { cookie } }, { APP_PASSWORD: secret });
    expect(res.status).toBe(200);
  });

  it('401 with tampered cookie', async () => {
    const res = await makeApp().request('/api/ping', { headers: { cookie: 'sa_session=tampered.sig' } }, { APP_PASSWORD: 'pw' });
    expect(res.status).toBe(401);
  });
});
