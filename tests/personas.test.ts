import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../src/worker/index';
import { makeEnv } from './fakes';
import type { PersonaRow } from '../src/worker/types';

/** Signed session cookie — POST /api/auth issues one for APP_PASSWORD 'pw'. */
const cookieFor = async (env: Parameters<typeof app.request>[2]): Promise<string> => {
  const res = await app.request('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'pw' }),
  }, env);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('no session cookie issued');
  return setCookie.split(';')[0];
};

const songRow = (over: Record<string, unknown> = {}) => ({
  id: 's1', task_id: 'task-1', title: 'สายฝน', prompt: 'p', style: 'dream pop', tags: 'calm',
  model: 'V5', instrumental: 0, status: 'SUCCESS' as const, error: null, r2_key: 's1.mp3',
  image_key: null, duration: 100, created_at: '2026-08-29T00:00:00.000Z', variant: 1,
  suno_id: 'a1', ...over,
});

const stubPersonaOk = () =>
  vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({ code: 200, msg: 'success', data: { personaId: 'persona_123' } }),
  });

const body = { songId: 's1', name: 'เสียงฝน', description: 'dream pop นุ่มๆ เสียงร้องบางเบา' };

describe('POST /api/personas', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('creates a persona from a finished song and stores kie personaId', async () => {
    const { env, personas } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    const fetchMock = stubPersonaOk();
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env);

    expect(res.status).toBe(201);
    const out = await res.json() as { persona: PersonaRow };
    expect(out.persona.personaId).toBe('persona_123');
    expect(out.persona.name).toBe('เสียงฝน');
    expect(out.persona.songId).toBe('s1');
    expect(personas).toHaveLength(1);
    expect(personas[0].persona_id).toBe('persona_123');
    // kie got the song's own ids
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.taskId).toBe('task-1');
    expect(sent.audioId).toBe('a1');
  });

  it('rejects a song with no suno_id without calling kie', async () => {
    const { env, personas } = makeEnv([songRow({ suno_id: null }) as never]);
    const cookie = await cookieFor(env);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env);

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(personas).toHaveLength(0);
  });

  it('404s an unknown songId', async () => {
    const { env } = makeEnv();
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn());
    const res = await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env);
    expect(res.status).toBe(404);
  });

  it('400s an empty name or description without calling kie', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const bad of [{ ...body, name: '  ' }, { ...body, description: '' }]) {
      const res = await app.request('/api/personas', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify(bad),
      }, env);
      expect(res.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('502s when kie refuses, leaving no row behind', async () => {
    const { env, personas } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 402, msg: 'insufficient credits', data: null }),
    }));

    const res = await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env);

    expect(res.status).toBe(502);
    expect(personas).toHaveLength(0);
  });

  it('401s without a session cookie', async () => {
    const { env } = makeEnv([songRow() as never]);
    const res = await app.request('/api/personas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/personas', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('lists personas newest first', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', stubPersonaOk());

    await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env);

    const res = await app.request('/api/personas', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    const out = await res.json() as { personas: PersonaRow[] };
    expect(out.personas).toHaveLength(1);
    expect(out.personas[0].personaId).toBe('persona_123');
    expect(out.personas[0].description).toBe(body.description);
  });
});
