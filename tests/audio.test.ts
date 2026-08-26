import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { app } from '../src/worker/index';
import { issueSession } from '../src/worker/auth';
import type { Env } from '../src/worker/types';

/** Fake R2ObjectBody */
const makeObj = (bytes: Uint8Array, opts?: { range?: { offset?: number; length?: number; suffix?: number } }) => ({
  body: new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(bytes);
      ctrl.close();
    },
  }),
  size: bytes.byteLength,
  httpMetadata: { contentType: 'audio/mpeg' },
  ...(opts?.range ? { range: opts.range } : {}),
});

const TOTAL = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]); // 8 bytes

/** Fake R2Bucket honoring range options like real R2: returns slice + satisfied-range info. */
const makeR2 = () => {
  const store = new Map<string, Uint8Array>();
  store.set('song.mp3', TOTAL);
  let getSpy: ReturnType<typeof vi.fn>;
  const bucket = {
    put: async (key: string, v: Uint8Array) => void store.set(key, v),
    head: async (key: string) =>
      store.has(key) ? { key, size: store.get(key)!.byteLength } : null,
    get: (getSpy = vi.fn(async (key: string, opts?: { range?: { offset?: number; length?: number; suffix?: number } }) => {
      const full = store.get(key);
      if (!full) return null;
      if (!opts?.range) return makeObj(full);
      const r = opts.range;
      if (r.suffix !== undefined) {
        const start = Math.max(0, full.byteLength - r.suffix);
        return makeObj(full.slice(start), { range: { suffix: r.suffix } });
      }
      const start = r.offset ?? 0;
      const length = Math.min(r.length ?? full.byteLength - start, full.byteLength - start);
      return makeObj(full.slice(start, start + length), { range: { offset: start, length } });
    })),
    spy: () => getSpy,
  } as unknown as Env['AUDIO'] & { spy: () => ReturnType<typeof vi.fn> };
  return bucket;
};

const makeEnv = () => ({ DB: {} as Env['DB'], AUDIO: makeR2(), KIE_API_KEY: 'k', APP_PASSWORD: 'pw' }) as Env;

const cookieFor = async (): Promise<string> => {
  const probe = new Hono<{ Bindings: { APP_PASSWORD: string } }>();
  probe.get('/login', async (c) => {
    await issueSession(c as never);
    return c.json({ ok: true });
  });
  const res = await probe.request('/login', {}, { APP_PASSWORD: 'pw' });
  return res.headers.get('set-cookie')!.split(';')[0];
};

describe('GET /audio/:key', () => {
  it('401 without auth cookie', async () => {
    const res = await app.request('/audio/song.mp3', {}, makeEnv());
    expect(res.status).toBe(401);
  });

  it('200 full object with correct headers', async () => {
    const env = makeEnv();
    const cookie = await cookieFor();
    const res = await app.request('/audio/song.mp3', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('content-length')).toBe('8');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(TOTAL);
  });

  it('206 for Range: bytes=2-4 with Content-Range and sliced body', async () => {
    const env = makeEnv();
    const cookie = await cookieFor();
    const res = await app.request('/audio/song.mp3', { headers: { cookie, range: 'bytes=2-4' } }, env);
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 2-4/8');
    expect(res.headers.get('content-length')).toBe('3');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([30, 40, 50]);
  });

  it('206 for open-ended Range: bytes=5-', async () => {
    const env = makeEnv();
    const cookie = await cookieFor();
    const res = await app.request('/audio/song.mp3', { headers: { cookie, range: 'bytes=5-' } }, env);
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 5-7/8');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([60, 70, 80]);
  });

  it('206 for suffix Range: bytes=-3 (last N bytes)', async () => {
    const env = makeEnv();
    const cookie = await cookieFor();
    const res = await app.request('/audio/song.mp3', { headers: { cookie, range: 'bytes=-3' } }, env);
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 5-7/8');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([60, 70, 80]);
  });

  it('416 on malformed range', async () => {
    const env = makeEnv();
    const cookie = await cookieFor();
    const res = await app.request('/audio/song.mp3', { headers: { cookie, range: 'bytes=abc' } }, env);
    expect(res.status).toBe(416);
  });

  it('404 for missing object', async () => {
    const env = makeEnv();
    const cookie = await cookieFor();
    const res = await app.request('/audio/nope.mp3', { headers: { cookie } }, env);
    expect(res.status).toBe(404);
  });
});
