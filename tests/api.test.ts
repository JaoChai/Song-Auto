import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { app } from '../src/worker/index';
import { issueSession } from '../src/worker/auth';
import type { SongRow } from '../src/worker/types';
import { makeEnv, lastSql, type Row } from './fakes';

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

const stubWavGenerate = (taskId = 'wavtask-1') =>
  vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ code: 200, msg: 'success', data: { taskId } }),
  });

const stubWavPoll = (data: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 200, msg: 'success', data }) });

/**
 * Routes the full generate→wav pipeline by URL: kie generate poll, wav kickoff, wav poll,
 * and everything else (mp3/jpg/wav bytes) to one download stub. Covers both getTask calls a
 * song needs to go PENDING → SUCCESS now (first kicks off WAV, second completes it).
 */
const stubFullFlow = (pollData: unknown, wavPollData: unknown, opts: { wavTaskId?: string } = {}) => {
  const dl = stubMp3Download();
  const mock = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('/api/v1/generate/record-info')) return stubKiePoll(pollData)() as unknown as Response;
    if (u.includes('/api/v1/wav/generate')) return stubWavGenerate(opts.wavTaskId)() as unknown as Response;
    if (u.includes('/api/v1/wav/record-info')) return stubWavPoll(wavPollData)() as unknown as Response;
    if (u.includes('/api/v1/generate')) return stubKieGenerate()() as unknown as Response;
    return dl() as unknown as Response;
  });
  vi.stubGlobal('fetch', mock);
  return { mock, dl };
};

const wavSuccess = (audioWavUrl = 'https://cdn/1.wav') => ({ successFlag: 'SUCCESS', response: { audioWavUrl } });

const baseInput = { prompt: 'a calm piano song', instrumental: true, model: 'V4_5' };

const rowFixture = (id: string, taskId: string, createdAt: string, variant = 1): Row => ({
  id, task_id: taskId, title: 't', prompt: 'p', style: 's', tags: '', model: 'V4_5',
  instrumental: 0, status: 'PENDING', error: null, r2_key: null, image_key: null,
  duration: null, created_at: createdAt, variant, suno_id: null, wav_task_id: null,
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

  it('POST /api/generate: 201 happy path — inserts two PENDING rows (variant 1 and 2) and returns both', async () => {
    const { env, data } = makeEnv();
    const cookie = await cookieFor('pw');
    const { mock } = stubKieAndMp3({ taskId: 't', status: 'PENDING', response: { sunoData: [] } });
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseInput }),
    }, env);
    expect(res.status).toBe(201);
    const body = await res.json() as { songs: SongRow[] };
    expect(body.songs).toHaveLength(2);
    expect(body.songs.map((s) => s.variant)).toEqual([1, 2]);
    expect(body.songs[0].status).toBe('PENDING');
    expect(body.songs[0].id).not.toBe(body.songs[1].id);
    // both rows share the one kie task
    expect(data).toHaveLength(2);
    expect(data.map((r) => r.task_id)).toEqual(['task-1', 'task-1']);
    // kie create hit exactly once — Suno makes both tracks from a single job
    expect(mock).toHaveBeenCalledTimes(1);
    expect(String(mock.mock.calls[0][0])).toBe('https://api.kie.ai/api/v1/generate');
    expect(lastSql.value).toMatch(/INSERT INTO songs/i);
  });

  it('POST /api/generate: instrumental custom-mode request with no prompt key at all still inserts rows (prompt defaults to empty string, not undefined)', async () => {
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
    expect(data).toHaveLength(2);
    expect(data[0].prompt).toBe('');
    expect(data[1].prompt).toBe('');
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

  it('GET /api/tasks/:id: track ready → kicks off WAV, stays PENDING with wav_task_id set (no mp3 downloaded)', async () => {
    const { env, data, store } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    const { mock } = stubFullFlow(
      {
        taskId: 'task-1', status: 'SUCCESS',
        response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano' }] },
      },
      wavSuccess(),
    );
    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'PENDING' });
    expect(data[0].status).toBe('PENDING');
    expect(data[0].wav_task_id).toBe('wavtask-1');
    expect(data[0].tags).toBe('calm, piano');
    expect(data[0].duration).toBe(198.4);
    expect(data[0].suno_id).toBe('a1');
    expect(data[0].r2_key).toBeNull();
    expect(store.size).toBe(0);
    expect(String(mock.mock.calls.find((c) => String(c[0]).includes('wav/generate'))?.[0])).toContain('wav/generate');
  });

  it('GET /api/tasks/:id: SUCCESS — second poll after WAV is ready downloads it, stores R2 {id}.wav, returns song', async () => {
    const { env, data, store } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    stubFullFlow(
      {
        taskId: 'task-1', status: 'SUCCESS',
        response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano' }] },
      },
      wavSuccess(),
    );
    await app.request('/api/tasks/s1', { headers: { cookie } }, env); // phase 1: kicks off WAV

    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env); // phase 2: WAV ready
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; song: SongRow };
    expect(body.status).toBe('SUCCESS');
    expect(body.song.id).toBe('s1');
    expect(body.song.r2Key).toBe('s1.wav');
    expect(body.song.tags).toBe('calm, piano');
    expect(body.song.duration).toBe(198.4);
    // row updated in D1
    expect(data[0].status).toBe('SUCCESS');
    expect(data[0].r2_key).toBe('s1.wav');
    // wav stored under {id}.wav
    expect(store.get('s1.wav')).toBeInstanceOf(Uint8Array);
    expect(store.get('s1.wav')).toHaveLength(3);
  });

  it('GET /api/tasks/:id: WAV kickoff hits a transient error (network) → stays PENDING for a retry, no mp3 fallback', async () => {
    const { env, data } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    const pollStub = stubKiePoll({
      taskId: 'task-1', status: 'SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'x' }] },
    });
    const dl = stubMp3Download();
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/v1/generate/record-info')) return pollStub() as unknown as Response;
      if (u.includes('/api/v1/wav/generate')) throw new Error('kie unreachable');
      return dl() as unknown as Response;
    }));
    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'PENDING' });
    // ไม่เขียนอะไรลง row เลย รอบ poll ถัดไปจะเรียก kieWavGenerate ซ้ำเอง (ไม่ใช่ mp3 fallback)
    expect(data[0].status).toBe('PENDING');
    expect(data[0].wav_task_id).toBeNull();
  });

  it('GET /api/tasks/:id: WAV kickoff hits a permanent error (402 insufficient credits) → falls back to mp3 immediately, still SUCCESS', async () => {
    const { env, data, store } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    const pollStub = stubKiePoll({
      taskId: 'task-1', status: 'SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'x' }] },
    });
    const dl = stubMp3Download();
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/v1/generate/record-info')) return pollStub() as unknown as Response;
      if (u.includes('/api/v1/wav/generate')) {
        return { ok: true, status: 200, json: async () => ({ code: 402, msg: 'Insufficient Credits' }) } as unknown as Response;
      }
      return dl() as unknown as Response;
    }));
    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect((await res.json() as { status: string }).status).toBe('SUCCESS');
    expect(data[0].status).toBe('SUCCESS');
    expect(data[0].r2_key).toBe('s1.mp3');
    expect(store.get('s1.mp3')).toBeInstanceOf(Uint8Array);
  });

  it('GET /api/tasks/:id: WAV poll still PENDING → stays PENDING without hitting kie generate poll again', async () => {
    const { env, data } = makeEnv([{
      ...rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z'),
      wav_task_id: 'wavtask-1', suno_id: 'a1', duration: 100, tags: 'calm',
    } as Row]);
    const cookie = await cookieFor('pw');
    const { mock } = stubFullFlow({ taskId: 'task-1', status: 'SUCCESS', response: { sunoData: [] } }, { successFlag: 'PENDING' });
    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'PENDING' });
    expect(data[0].status).toBe('PENDING');
    expect(mock.mock.calls.some((c) => String(c[0]).includes('generate/record-info'))).toBe(false);
  });

  it('GET /api/tasks/:id: WAV poll FAILED → falls back to mp3 via a fresh kie poll, still SUCCESS', async () => {
    const { env, data, store } = makeEnv([{
      ...rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z'),
      wav_task_id: 'wavtask-1', suno_id: 'a1', duration: 198.4, tags: 'calm, piano',
    } as Row]);
    const cookie = await cookieFor('pw');
    stubFullFlow(
      {
        taskId: 'task-1', status: 'SUCCESS',
        response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano' }] },
      },
      { successFlag: 'GENERATE_WAV_FAILED', errorMessage: 'wav engine died' },
    );
    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect((await res.json() as { status: string }).status).toBe('SUCCESS');
    expect(data[0].status).toBe('SUCCESS');
    expect(data[0].r2_key).toBe('s1.mp3');
    expect(store.get('s1.mp3')).toBeInstanceOf(Uint8Array);
  });

  it('GET /api/tasks/:id: WAV download fails 3x → row stays PENDING, transient response', async () => {
    const { env, data } = makeEnv([{
      ...rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z'),
      wav_task_id: 'wavtask-1', suno_id: 'a1', duration: 198.4, tags: 'x',
    } as Row]);
    const cookie = await cookieFor('pw');
    const wavPollStub = stubWavPoll(wavSuccess());
    const dlStub = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/v1/wav/record-info')) return wavPollStub() as unknown as Response;
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

  it('GET /api/tasks/:id: track ready — stores the cover as {id}.jpg and sets image_key even before WAV finishes', async () => {
    const { env, data, store } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    stubFullFlow(
      {
        taskId: 'task-1', status: 'SUCCESS',
        response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano', imageUrl: 'https://cdn/1.jpg' }] },
      },
      wavSuccess(),
    );

    const phase1 = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect((await phase1.json() as { status: string }).status).toBe('PENDING');
    expect(data[0].image_key).toBe('s1.jpg');
    expect(store.get('s1.jpg')).toBeInstanceOf(Uint8Array);

    const phase2 = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    const body = await phase2.json() as { status: string; song: SongRow };
    expect(body.status).toBe('SUCCESS');
    expect(body.song.imageKey).toBe('s1.jpg');
    expect(store.get('s1.wav')).toBeInstanceOf(Uint8Array);
  });

  it('GET /api/tasks/:id: cover fetch failure leaves image_key null but keeps the song going', async () => {
    const { env, data, store } = makeEnv([rowFixture('s2', 'task-2', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');

    // route record-info to kie, the .jpg to a throw, everything else to the mp3/wav bytes
    const poll = stubKiePoll({
      taskId: 'task-2', status: 'SUCCESS',
      response: { sunoData: [{ id: 'a2', audioUrl: 'https://cdn/2.mp3', duration: 90, tags: 'pop', imageUrl: 'https://cdn/2.jpg' }] },
    });
    const wavGen = stubWavGenerate('wavtask-2');
    const wavPoll = stubWavPoll(wavSuccess('https://cdn/2.wav'));
    const dl = stubMp3Download();
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/v1/generate/record-info')) return poll() as unknown as Response;
      if (u.includes('/api/v1/wav/generate')) return wavGen() as unknown as Response;
      if (u.includes('/api/v1/wav/record-info')) return wavPoll() as unknown as Response;
      if (u.endsWith('.jpg')) throw new Error('cover unreachable');
      return dl() as unknown as Response;
    }));

    await app.request('/api/tasks/s2', { headers: { cookie } }, env); // phase 1
    expect(data[0].image_key).toBeNull();
    expect(store.has('s2.jpg')).toBe(false);

    const res = await app.request('/api/tasks/s2', { headers: { cookie } }, env); // phase 2
    const body = await res.json() as { status: string; song: SongRow };
    expect(body.status).toBe('SUCCESS');
    expect(body.song.imageKey).toBeNull();
    expect(data[0].status).toBe('SUCCESS');
    expect(store.get('s2.wav')).toBeInstanceOf(Uint8Array);
    expect(store.has('s2.jpg')).toBe(false);
  });

  it('GET /api/tasks/:id: FIRST_SUCCESS — v1 finishes (WAV then completes), v2 keeps waiting', async () => {
    const { env, data, store } = makeEnv([
      rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      rowFixture('s2', 'task-1', '2026-08-26T00:00:00.000Z', 2),
    ]);
    const cookie = await cookieFor('pw');
    stubFullFlow(
      {
        taskId: 'task-1', status: 'FIRST_SUCCESS',
        response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 100, tags: 'calm' }] },
      },
      wavSuccess(),
    );

    const first = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect((await first.json() as { status: string }).status).toBe('PENDING');
    const firstDone = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect((await firstDone.json() as { status: string }).status).toBe('SUCCESS');
    expect(store.get('s1.wav')).toBeInstanceOf(Uint8Array);

    const second = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    expect(await second.json()).toEqual({ status: 'PENDING' });
    expect(data.find((r) => r.id === 's2')!.status).toBe('PENDING');
  });

  it('GET /api/tasks/:id: SUCCESS with two tracks — each row takes its own, storing distinct suno ids', async () => {
    const { env, data, store } = makeEnv([
      rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      rowFixture('s2', 'task-1', '2026-08-26T00:00:00.000Z', 2),
    ]);
    const cookie = await cookieFor('pw');
    stubFullFlow(
      {
        taskId: 'task-1', status: 'SUCCESS',
        response: {
          sunoData: [
            { id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 100, tags: 'calm' },
            { id: 'a2', audioUrl: 'https://cdn/2.mp3', duration: 101, tags: 'warm' },
          ],
        },
      },
      wavSuccess(),
    );

    await app.request('/api/tasks/s1', { headers: { cookie } }, env); // phase 1 each
    await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    const r1 = await app.request('/api/tasks/s1', { headers: { cookie } }, env); // phase 2 each
    const r2 = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    const b1 = await r1.json() as { status: string; song: SongRow };
    const b2 = await r2.json() as { status: string; song: SongRow };

    expect(b1.song.sunoId).toBe('a1');
    expect(b2.song.sunoId).toBe('a2');
    expect(b1.song.tags).toBe('calm');
    expect(b2.song.tags).toBe('warm');
    expect(store.get('s1.wav')).toBeInstanceOf(Uint8Array);
    expect(store.get('s2.wav')).toBeInstanceOf(Uint8Array);
    expect(data).toHaveLength(2);
  });

  it('GET /api/tasks/:id: SUCCESS with only one track — the spare row is deleted and reported GONE', async () => {
    const { env, data } = makeEnv([
      rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      rowFixture('s2', 'task-1', '2026-08-26T00:00:00.000Z', 2),
    ]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({
      taskId: 'task-1',
      status: 'SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 100, tags: 'calm' }] },
    });

    const res = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'GONE' });
    expect(data.map((r) => r.id)).toEqual(['s1']);
  });

  it('GET /api/tasks/:id: FAILED — v1 records the error, v2 is deleted', async () => {
    const { env, data } = makeEnv([
      rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      rowFixture('s2', 'task-1', '2026-08-26T00:00:00.000Z', 2),
    ]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({ taskId: 'task-1', status: 'GENERATE_AUDIO_FAILED', errorMessage: 'engine died' });

    const r2 = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    expect(await r2.json()).toEqual({ status: 'GONE' });

    const r1 = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(await r1.json()).toEqual({ status: 'FAILED', error: 'engine died' });

    expect(data.map((r) => r.id)).toEqual(['s1']);
    expect(data[0].status).toBe('FAILED');
  });

  it('GET /api/tasks/:id: SUCCESS with zero tracks — v1 records a FAILED error instead of vanishing', async () => {
    const { env, data } = makeEnv([
      rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      rowFixture('s2', 'task-1', '2026-08-26T00:00:00.000Z', 2),
    ]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({ taskId: 'task-1', status: 'SUCCESS', response: { sunoData: [] } });

    const r1 = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(await r1.json()).toEqual({ status: 'FAILED', error: expect.any(String) });

    const s1 = data.find((r) => r.id === 's1');
    expect(s1).toBeDefined();
    expect(s1?.status).toBe('FAILED');
  });

  it('GET /api/tasks/:id: SUCCESS with zero tracks — v2 is still deleted and reported GONE', async () => {
    const { env, data } = makeEnv([
      rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      rowFixture('s2', 'task-1', '2026-08-26T00:00:00.000Z', 2),
    ]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({ taskId: 'task-1', status: 'SUCCESS', response: { sunoData: [] } });

    const r2 = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    expect(await r2.json()).toEqual({ status: 'GONE' });
    expect(data.map((r) => r.id)).toEqual(['s1']);
  });

  it('GET /api/tasks/:id: polling an already-finished row downloads nothing and does not call kie', async () => {
    const { env } = makeEnv([{
      ...rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      status: 'SUCCESS', r2_key: 's1.mp3', suno_id: 'a1',
    } as Row]);
    const cookie = await cookieFor('pw');
    const { mock } = stubKieAndMp3({ taskId: 'task-1', status: 'SUCCESS', response: { sunoData: [] } });

    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    const body = await res.json() as { status: string; song: SongRow };
    expect(body.status).toBe('SUCCESS');
    expect(body.song.r2Key).toBe('s1.mp3');
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('GET /api/songs — ฟิลด์สายพันธุ์', () => {
  it('ส่ง parentSongId กับ continueAt ออกมาด้วย', async () => {
    const { env } = makeEnv([
      {
        id: 's2', task_id: 'task-2', title: 'ต่อจากสายฝน', prompt: '', style: '', tags: '',
        model: 'V5', instrumental: 0, status: 'SUCCESS', error: null, r2_key: 's2.mp3',
        image_key: null, duration: 60, created_at: '2026-09-10T00:00:00.000Z', variant: 1,
        suno_id: 'a2', parent_song_id: 's1', continue_at: 42.5,
      } as never,
    ]);
    const cookie = await cookieFor('pw');
    const res = await app.request('/api/songs', { headers: { cookie } }, env);
    const out = await res.json() as { songs: Array<Record<string, unknown>> };
    expect(out.songs[0].parentSongId).toBe('s1');
    expect(out.songs[0].continueAt).toBe(42.5);
  });

  it('เพลงที่ไม่ได้ต่อจากใคร ได้ null ทั้งสองฟิลด์', async () => {
    const { env } = makeEnv([
      {
        id: 's1', task_id: 'task-1', title: 'สายฝน', prompt: '', style: '', tags: '',
        model: 'V5', instrumental: 0, status: 'SUCCESS', error: null, r2_key: 's1.mp3',
        image_key: null, duration: 60, created_at: '2026-09-09T00:00:00.000Z', variant: 1,
        suno_id: 'a1',
      } as never,
    ]);
    const cookie = await cookieFor('pw');
    const res = await app.request('/api/songs', { headers: { cookie } }, env);
    const out = await res.json() as { songs: Array<Record<string, unknown>> };
    expect(out.songs[0].parentSongId).toBeNull();
    expect(out.songs[0].continueAt).toBeNull();
  });
});
