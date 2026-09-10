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

const row = (over: Record<string, unknown> = {}) => ({
  id: 's1', task_id: 'task-1', title: 't', prompt: '', style: '', tags: '',
  model: 'V4_5', instrumental: 0, status: 'SUCCESS' as const, error: null, r2_key: 's1.mp3',
  image_key: null, duration: 100, created_at: '2026-08-01T00:00:00.000Z', variant: 1,
  suno_id: null, parent_song_id: null, continue_at: null, ...over,
});

const recordInfo = (sunoIds: string[]) =>
  vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({
      code: 200, msg: 'success',
      data: {
        status: 'SUCCESS',
        response: { sunoData: sunoIds.map((id) => ({ id, audioUrl: `https://x/${id}.mp3` })) },
      },
    }),
  });

describe('POST /api/songs/backfill-suno-id', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('เติม suno_id ให้แถวที่ยังว่าง โดยใช้ตำแหน่งตาม variant', async () => {
    const { env, data } = makeEnv([
      row({ id: 's1', variant: 1 }) as never,
      row({ id: 's2', variant: 2 }) as never,
    ]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', recordInfo(['audio-A', 'audio-B']));

    const res = await app.request('/api/songs/backfill-suno-id',
      { method: 'POST', headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const out = await res.json() as { filled: number };
    expect(out.filled).toBe(2);
    expect(data.find((r) => r.id === 's1')!.suno_id).toBe('audio-A');
    expect(data.find((r) => r.id === 's2')!.suno_id).toBe('audio-B');
  });

  it('ยิง record-info ครั้งเดียวต่อหนึ่ง task แม้มีหลายแถว', async () => {
    const { env } = makeEnv([
      row({ id: 's1', variant: 1 }) as never,
      row({ id: 's2', variant: 2 }) as never,
    ]);
    const cookie = await cookieFor(env);
    const fetchMock = recordInfo(['audio-A', 'audio-B']);
    vi.stubGlobal('fetch', fetchMock);

    await app.request('/api/songs/backfill-suno-id', { method: 'POST', headers: { cookie } }, env);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ข้ามแถวที่มี suno_id อยู่แล้ว และไม่ยิง fetch เลยถ้าไม่มีอะไรต้องเติม', async () => {
    const { env } = makeEnv([row({ suno_id: 'มีแล้ว' }) as never]);
    const cookie = await cookieFor(env);
    const fetchMock = recordInfo(['audio-A']);
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/api/songs/backfill-suno-id',
      { method: 'POST', headers: { cookie } }, env);
    const out = await res.json() as { filled: number };
    expect(out.filled).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('รายงาน task ที่เติมไม่ได้พร้อมเหตุผล ไม่ล้มทั้งคำขอ', async () => {
    const { env, data } = makeEnv([row({ id: 's1', variant: 1 }) as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 404, msg: 'Not Found' }),
    }));

    const res = await app.request('/api/songs/backfill-suno-id',
      { method: 'POST', headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const out = await res.json() as { filled: number; skipped: Array<{ taskId: string; reason: string }> };
    expect(out.filled).toBe(0);
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0].taskId).toBe('task-1');
    expect(data[0].suno_id).toBeNull();
  });

  it('ข้ามแถวที่ยังไม่ SUCCESS', async () => {
    const { env } = makeEnv([row({ status: 'PENDING' }) as never]);
    const cookie = await cookieFor(env);
    const fetchMock = recordInfo(['audio-A']);
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request('/api/songs/backfill-suno-id',
      { method: 'POST', headers: { cookie } }, env);
    const out = await res.json() as { filled: number };
    expect(out.filled).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ตอบ 401 เมื่อไม่มี cookie', async () => {
    const { env } = makeEnv([row() as never]);
    const res = await app.request('/api/songs/backfill-suno-id', { method: 'POST' }, env);
    expect(res.status).toBe(401);
  });
});
