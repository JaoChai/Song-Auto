import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../src/worker/index';
import { makeEnv } from './fakes';

const cookieFor = async (env: Parameters<typeof app.request>[2]): Promise<string> => {
  const res = await app.request('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'pw' }),
  }, env);
  return res.headers.get('set-cookie')!.split(';')[0];
};

const post = (cookie: string, body: unknown) => ({
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('POST /api/lyrics', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('คืน taskId เมื่อสำเร็จ', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { taskId: 'lyr-1' } }),
    }));
    const res = await app.request('/api/lyrics', post(cookie, { prompt: 'เพลงเศร้า' }), env);
    expect(res.status).toBe(201);
    expect((await res.json() as { taskId: string }).taskId).toBe('lyr-1');
  });

  it('ตอบ 400 เมื่อคำอธิบายว่าง', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/lyrics', post(cookie, { prompt: '   ' }), env);
    expect(res.status).toBe(400);
  });

  it('ตอบ 400 เมื่อคำอธิบายยาวเกิน 200 ตัวอักษร', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/lyrics', post(cookie, { prompt: 'x'.repeat(201) }), env);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toContain('200');
  });

  it('แปลงกรณีมีชื่อศิลปินเป็นข้อความไทยที่บอกวิธีแก้', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 400, msg: 'Song Description contained artist name' }),
    }));
    const res = await app.request('/api/lyrics', post(cookie, { prompt: 'แบบ Bodyslam' }), env);
    expect(res.status).toBe(502);
    expect((await res.json() as { error: string }).error).toContain('ชื่อศิลปิน');
  });

  it('แปลงกรณีถูกกรองเนื้อหาเป็นข้อความไทย', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 400, msg: 'Song Description flagged for moderation' }),
    }));
    const res = await app.request('/api/lyrics', post(cookie, { prompt: 'อะไรสักอย่าง' }), env);
    expect((await res.json() as { error: string }).error).toContain('กรอง');
  });

  it('ตอบ 401 เมื่อไม่มี cookie', async () => {
    const { env } = makeEnv([]);
    const res = await app.request('/api/lyrics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x' }),
    }, env);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/lyrics/:taskId', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('คืน variants เมื่องานเสร็จ', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        code: 200, msg: 'success',
        data: {
          status: 'SUCCESS',
          response: { data: [{ title: 'ฝน', text: '[Verse]\nเนื้อ' }] },
        },
      }),
    }));
    const res = await app.request('/api/lyrics/lyr-1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    const out = await res.json() as { status: string; variants: Array<{ title: string }> };
    expect(out.status).toBe('SUCCESS');
    expect(out.variants[0].title).toBe('ฝน');
  });

  it('คืน PENDING ระหว่างรอ', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { status: 'PENDING' } }),
    }));
    const res = await app.request('/api/lyrics/lyr-1', { headers: { cookie } }, env);
    expect((await res.json() as { status: string }).status).toBe('PENDING');
  });

  it('คืน FAILED พร้อมข้อความไทยเมื่อโดนกรองคำ', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { status: 'SENSITIVE_WORD_ERROR' } }),
    }));
    const res = await app.request('/api/lyrics/lyr-1', { headers: { cookie } }, env);
    const out = await res.json() as { status: string; error: string };
    expect(out.status).toBe('FAILED');
    expect(out.error).toContain('กรอง');
  });

  it('คืน PENDING พร้อม transient เมื่อ kie ล่มชั่วคราว', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const res = await app.request('/api/lyrics/lyr-1', { headers: { cookie } }, env);
    const out = await res.json() as { status: string; transient?: boolean };
    expect(out.status).toBe('PENDING');
    expect(out.transient).toBe(true);
  });
});
