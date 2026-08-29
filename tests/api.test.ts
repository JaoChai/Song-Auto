import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { app } from '../src/worker/index';
import { issueSession } from '../src/worker/auth';
import type { Env, SongRow } from '../src/worker/types';

// --- fakes ---------------------------------------------------------------

interface Row extends Record<string, unknown> {
  id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export const lastSql = { value: '' };

/**
 * Fake D1 that actually parses the SQL the routes use:
 * - INSERT INTO songs (...) VALUES (?, ..., ?)   → 13 binds, id first
 * - SELECT * FROM songs WHERE id = ?             → 1 bind
 * - UPDATE songs SET status='FAILED', error=?    → 2 binds (error, id)
 * - UPDATE songs SET status='SUCCESS', ...       → 5 binds (r2Key, imageKey, tags, duration, id)
 * - SELECT * FROM songs ORDER BY created_at DESC → 0 binds, all()
 */
const makeDb = (rows: Row[] = []) => {
  const data: Row[] = [...rows];
  const find = (id: string) => data.find((r) => r.id === id);

  const db = {
    prepare(sql: string) {
      lastSql.value = sql;
      const S = sql.toUpperCase();
      const isInsert = S.includes('INSERT INTO');
      const isDelete = S.startsWith('DELETE');
      const isSelectById = S.startsWith('SELECT') && S.includes('WHERE ID = ?');
      const isList = S.startsWith('SELECT') && !S.includes('WHERE');
      const isFailedUpdate = S.includes("SET STATUS = 'FAILED'");

      return {
        bind(...args: unknown[]) {
          return {
            all: async () => ({ results: data.slice() }),
            first: async () => find(args[0] as string) ?? null,
            run: async () => {
              if (isInsert) {
                // (id, task_id, title, prompt, style, tags, model, instrumental, created_at, variant)
                const [id, task_id, title, prompt, style, tags, model, instrumental, created_at, variant] = args as never[];
                data.push({
                  id, task_id, title, prompt, style, tags, model,
                  instrumental: Number(instrumental), status: 'PENDING',
                  error: null, r2_key: null, image_key: null, duration: null,
                  created_at, variant: Number(variant), suno_id: null,
                } as unknown as Row);
                return { success: true };
              }
              if (isDelete) {
                const [id] = args as [string];
                const i = data.findIndex((r) => r.id === id);
                if (i >= 0) data.splice(i, 1);
                return { success: true };
              }
              if (isFailedUpdate) {
                const [error, id] = args as [string, string];
                Object.assign(find(id)!, { status: 'FAILED', error });
                return { success: true };
              }
              // SUCCESS update: (r2Key, imageKey, tags, duration, [sunoId,] id)
              // suno_id เข้ามาใน UPDATE ตอน Task 4 — อ่านจาก SQL ไม่ใช่จำนวน args
              const hasSunoId = S.includes('SUNO_ID = ?');
              const [r2_key, image_key, tags, duration] =
                args as [string, string | null, string | null, number | null];
              const rowId = args[hasSunoId ? 5 : 4] as string;
              Object.assign(find(rowId)!, {
                status: 'SUCCESS', r2_key, image_key, tags, duration, error: null,
                ...(hasSunoId ? { suno_id: args[4] as string } : {}),
              });
              return { success: true };
            },
          };
        },
        all: async () => ({ results: data.slice() }),
        first: async () => null,
        run: async () => {
          void isInsert; void isDelete; void isSelectById; void isList;
          return { success: true };
        },
      };
    },
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  } as unknown as Env['DB'];
  return { db, data };
};

const makeR2 = () => {
  const store = new Map<string, Uint8Array>();
  const bucket = {
    put: vi.fn(async (key: string, body: unknown) => {
      store.set(key, body as Uint8Array);
      return { key };
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    keys: () => [...store.keys()],
  } as unknown as Env['AUDIO'];
  return { bucket, store };
};

export const makeEnv = (rows: Row[] = []) => {
  const { db, data } = makeDb(rows);
  const { bucket, store } = makeR2();
  const env: Env = { DB: db, AUDIO: bucket, KIE_API_KEY: 'test-key', APP_PASSWORD: 'pw' };
  return { env, data, bucket, store };
};

/** Signed session cookie for APP_PASSWORD via the real issueSession (same as POST /api/auth). */
const cookieFor = async (password: string): Promise<string> => {
  const probe = new Hono<{ Bindings: { APP_PASSWORD: string } }>();
  probe.get('/login', async (c) => {
    await issueSession(c as never);
    return c.json({ ok: true });
  });
  const res = await probe.request('/login', { method: 'GET' }, { APP_PASSWORD: password });
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('issueSession did not set a cookie');
  return setCookie.split(';')[0];
};

// fetch stubs --------------------------------------------------------------

const stubKieGenerate = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ code: 200, msg: 'success', data: { taskId: 'task-1' } }),
  });

const stubKiePoll = (data: unknown) =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ code: 200, msg: 'success', data }),
  });

const stubMp3Download = () =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });

/** Routes both the kie calls and the mp3 download to one mock, by URL. */
const stubKieAndMp3 = (pollData: unknown) => {
  const mp3 = stubMp3Download();
  const mock = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('/api/v1/generate/record-info')) return stubKiePoll(pollData)() as unknown as Response;
    if (u.includes('/api/v1/generate')) return stubKieGenerate()() as unknown as Response;
    return mp3() as unknown as Response;
  });
  vi.stubGlobal('fetch', mock);
  return { mock, mp3 };
};

const baseInput = { prompt: 'a calm piano song', instrumental: true, model: 'V4_5' };

const rowFixture = (id: string, taskId: string, createdAt: string, variant = 1): Row => ({
  id, task_id: taskId, title: 't', prompt: 'p', style: 's', tags: '', model: 'V4_5',
  instrumental: 0, status: 'PENDING', error: null, r2_key: null, image_key: null,
  duration: null, created_at: createdAt, variant, suno_id: null,
});

// --------------------------------------------------------------------------

describe('API routes', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('401 on protected routes without a session cookie (all three)', async () => {
    const { env } = makeEnv();
    for (const path of ['/api/generate', '/api/tasks/abc', '/api/songs']) {
      const res = await app.request(path, { method: path === '/api/generate' ? 'POST' : 'GET' }, env);
      expect(res.status, path).toBe(401);
    }
  });

  it('/api/health is exempt from auth (no cookie needed)', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('POST /api/generate: 201 happy path — inserts PENDING row and returns {id, status}', async () => {
    const { env, data } = makeEnv();
    const cookie = await cookieFor('pw');
    const { mock } = stubKieAndMp3({ taskId: 't', status: 'PENDING', response: { sunoData: [] } });
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseInput }),
    }, env);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; status: string };
    expect(body.status).toBe('PENDING');
    expect(body.id).toBeTruthy();
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe('PENDING');
    expect(data[0].task_id).toBe('task-1');
    // kie create hit, nothing else
    expect(mock).toHaveBeenCalledTimes(1);
    expect(String(mock.mock.calls[0][0])).toBe('https://api.kie.ai/api/v1/generate');
    expect(lastSql.value).toMatch(/INSERT INTO songs/i);
  });

  it('POST /api/generate: instrumental custom-mode request with no prompt key at all still inserts a row (prompt defaults to empty string, not undefined)', async () => {
    const { env, data } = makeEnv();
    const cookie = await cookieFor('pw');
    stubKieAndMp3({ taskId: 't', status: 'PENDING', response: { sunoData: [] } });
    const { prompt: _omit, ...noPrompt } = { ...baseInput, style: 'lo-fi', title: 'Rain' };
    void _omit;
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(noPrompt),
    }, env);
    expect(res.status).toBe(201);
    expect(data).toHaveLength(1);
    expect(data[0].prompt).toBe('');
  });

  it('POST /api/generate: validation error → 400 {error}, nothing inserted, no kie call', async () => {
    const { env, data } = makeEnv();
    const cookie = await cookieFor('pw');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseInput, model: 'V9' }),
    }, env);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toMatch(/model/i);
    expect(data).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /api/generate: kie create failure (envelope 402) → 502 {error}, nothing inserted', async () => {
    const { env, data } = makeEnv();
    const cookie = await cookieFor('pw');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 402, msg: 'insufficient credits', data: null }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(baseInput),
    }, env);
    expect(res.status).toBe(502);
    expect((await res.json() as { error: string }).error).toMatch(/insufficient credits/);
    expect(data).toHaveLength(0);
  });

  it('GET /api/tasks/:id: PENDING passthrough — row untouched, no download', async () => {
    const { env, data, store } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    const { mock, mp3 } = stubKieAndMp3({ taskId: 'task-1', status: 'PENDING', response: { sunoData: [] } });
    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'PENDING' });
    expect(data[0].status).toBe('PENDING');
    expect(data[0].r2_key).toBeNull();
    expect(mp3).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
    expect(String(mock.mock.calls[0][0])).toContain('taskId=task-1');
  });

  it('GET /api/tasks/:id: SUCCESS — downloads mp3, stores R2 {id}.mp3, updates row, returns song', async () => {
    const { env, data, store } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({
      taskId: 'task-1',
      status: 'SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano' }] },
    });
    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; song: SongRow };
    expect(body.status).toBe('SUCCESS');
    expect(body.song.id).toBe('s1');
    expect(body.song.r2Key).toBe('s1.mp3');
    expect(body.song.tags).toBe('calm, piano');
    expect(body.song.duration).toBe(198.4);
    // row updated in D1
    expect(data[0].status).toBe('SUCCESS');
    expect(data[0].r2_key).toBe('s1.mp3');
    expect(data[0].tags).toBe('calm, piano');
    expect(data[0].duration).toBe(198.4);
    // mp3 stored under {id}.mp3
    expect(store.get('s1.mp3')).toBeInstanceOf(Uint8Array);
    expect(store.get('s1.mp3')).toHaveLength(3);
    expect(lastSql.value).toMatch(/UPDATE songs SET status = 'SUCCESS'/i);
  });

  it('GET /api/tasks/:id: SUCCESS download fails 3x → row stays PENDING, transient response', async () => {
    const { env, data } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    const pollStub = stubKiePoll({
      taskId: 'task-1',
      status: 'SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'x' }] },
    });
    const dlStub = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/v1/generate/record-info')) return pollStub() as unknown as Response;
      return dlStub() as unknown as Response;
    }));
    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'PENDING', transient: true });
    expect(data[0].status).toBe('PENDING');
    expect(data[0].r2_key).toBeNull();
    // 3 download attempts then give up
    expect(dlStub).toHaveBeenCalledTimes(3);
  });

  it('GET /api/tasks/:id: FAILED — writes error to row, returns {status: FAILED, error}', async () => {
    const { env, data } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({ taskId: 'task-1', status: 'SENSITIVE_WORD_ERROR', errorMessage: 'nope: bad word' });
    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'FAILED', error: 'nope: bad word' });
    expect(data[0].status).toBe('FAILED');
    expect(data[0].error).toBe('nope: bad word');
    expect(lastSql.value).toMatch(/UPDATE songs SET status = 'FAILED'/i);
  });

  it('GET /api/tasks/:id: kie poll transient → 200 {status: PENDING, transient: true}, row untouched', async () => {
    const { env, data } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 429, msg: 'rate limited', data: null }),
    }));
    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'PENDING', transient: true });
    expect(data[0].status).toBe('PENDING');
  });

  it('GET /api/tasks/:id: unknown id → 404', async () => {
    const { env } = makeEnv();
    const cookie = await cookieFor('pw');
    vi.stubGlobal('fetch', vi.fn());
    const res = await app.request('/api/tasks/nope', { headers: { cookie } }, env);
    expect(res.status).toBe(404);
    expect((await res.json() as { error: string }).error).toMatch(/not found/i);
  });

  it('GET /api/songs: returns rows newest-first (fake returns in insertion order; route maps camelCase)', async () => {
    const { env } = makeEnv([
      rowFixture('a', 't1', '2026-08-25T00:00:00.000Z'),
      rowFixture('b', 't2', '2026-08-26T00:00:00.000Z'),
    ]);
    const cookie = await cookieFor('pw');
    const res = await app.request('/api/songs', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { songs: SongRow[] };
    expect(lastSql.value).toMatch(/ORDER BY created_at DESC/i);
    expect(body.songs.map((s) => s.id)).toEqual(['a', 'b']);
    expect(body.songs[0].createdAt).toBe('2026-08-25T00:00:00.000Z');
    expect(body.songs[0].taskId).toBe('t1'); // camelCase mapping verified
  });

  it('GET /api/tasks/:id: SUCCESS — stores the cover as {id}.jpg and sets image_key', async () => {
    const { env, data, store } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({
      taskId: 'task-1',
      status: 'SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano', imageUrl: 'https://cdn/1.jpg' }] },
    });

    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    const body = await res.json() as { status: string; song: SongRow };

    expect(body.status).toBe('SUCCESS');
    expect(body.song.imageKey).toBe('s1.jpg');
    expect(data[0].image_key).toBe('s1.jpg');
    expect(store.get('s1.jpg')).toBeInstanceOf(Uint8Array);
    expect(store.get('s1.mp3')).toBeInstanceOf(Uint8Array);
  });

  it('GET /api/tasks/:id: SUCCESS — cover fetch failure leaves image_key null but keeps the song', async () => {
    const { env, data, store } = makeEnv([rowFixture('s2', 'task-2', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');

    // route record-info to kie, the .jpg to a throw, everything else to the mp3 bytes
    const poll = stubKiePoll({
      taskId: 'task-2', status: 'SUCCESS',
      response: { sunoData: [{ id: 'a2', audioUrl: 'https://cdn/2.mp3', duration: 90, tags: 'pop', imageUrl: 'https://cdn/2.jpg' }] },
    });
    const dl = stubMp3Download();
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/v1/generate/record-info')) return poll() as unknown as Response;
      if (u.endsWith('.jpg')) throw new Error('cover unreachable');
      return dl() as unknown as Response;
    }));

    const res = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    const body = await res.json() as { status: string; song: SongRow };

    expect(body.status).toBe('SUCCESS');
    expect(body.song.imageKey).toBeNull();
    expect(data[0].status).toBe('SUCCESS');
    expect(store.get('s2.mp3')).toBeInstanceOf(Uint8Array);
    expect(store.has('s2.jpg')).toBe(false);
  });
});
