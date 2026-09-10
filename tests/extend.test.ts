import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../src/worker/index';
import { makeEnv } from './fakes';
import type { SongRow } from '../src/worker/types';

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
  model: 'V6', instrumental: 0, status: 'SUCCESS' as const, error: null, r2_key: 's1.mp3',
  image_key: null, duration: 100, created_at: '2026-09-09T00:00:00.000Z', variant: 1,
  suno_id: 'a1', parent_song_id: null, continue_at: null, ...over,
});

const okExtend = () =>
  vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({ code: 200, msg: 'success', data: { taskId: 'ext-1' } }),
  });

describe('POST /api/songs/:id/extend', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('สร้างสองแถวใหม่ที่ชี้กลับไปเพลงต้นทาง', async () => {
    const { env, data } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', okExtend());

    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);

    expect(res.status).toBe(201);
    const out = await res.json() as { songs: SongRow[] };
    expect(out.songs).toHaveLength(2);
    expect(out.songs.map((s) => s.variant)).toEqual([1, 2]);
    expect(out.songs.every((s) => s.parentSongId === 's1')).toBe(true);
    expect(out.songs.every((s) => s.taskId === 'ext-1')).toBe(true);
    expect(out.songs.every((s) => s.status === 'PENDING')).toBe(true);
    // ต้นทาง 1 + ใหม่ 2
    expect(data).toHaveLength(3);
  });

  it('ใช้ model ของเพลงต้นทางเสมอ แม้ผู้เรียกจะส่งค่าอื่นมา', async () => {
    const { env } = makeEnv([songRow({ model: 'V6_MINI' }) as never]);
    const cookie = await cookieFor(env);
    const fetchMock = okExtend();
    vi.stubGlobal('fetch', fetchMock);

    await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false, model: 'V5', audioId: 'ปลอม' }),
    }, env);

    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.model).toBe('V6_MINI');
    expect(sent.audioId).toBe('a1');
  });

  it('ส่ง continueAt และเก็บลงแถวใหม่ในโหมดปรับเอง', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    const fetchMock = okExtend();
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        defaultParamFlag: true, continueAt: 42.5,
        prompt: 'ต่อให้เบาลง', style: 'dream pop', title: 'ต่อจากสายฝน',
      }),
    }, env);

    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.continueAt).toBe(42.5);
    const out = await res.json() as { songs: SongRow[] };
    expect(out.songs.every((s) => s.continueAt === 42.5)).toBe(true);
    expect(out.songs.every((s) => s.title === 'ต่อจากสายฝน')).toBe(true);
  });

  it('โหมดใช้ค่าเดิมยืมชื่อเพลงต้นทางมาตั้งเป็นชื่อตั้งต้น', async () => {
    const { env } = makeEnv([songRow({ title: 'สายฝน' }) as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', okExtend());

    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);

    const out = await res.json() as { songs: SongRow[] };
    expect(out.songs.every((s) => s.title === 'สายฝน')).toBe(true);
  });

  it('ตอบ 404 เมื่อไม่มีเพลงนั้น', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/songs/ไม่มี/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);
    expect(res.status).toBe(404);
  });

  it('ตอบ 400 พร้อมข้อความไทยเมื่อเพลงยังไม่มี suno_id', async () => {
    const { env } = makeEnv([songRow({ suno_id: null }) as never]);
    const cookie = await cookieFor(env);
    const fetchMock = okExtend();
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);

    expect(res.status).toBe(400);
    const out = await res.json() as { error: string };
    expect(out.error).toContain('รหัสแทร็ก');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ตอบ 400 เมื่อเพลงต้นทางยังไม่สำเร็จ', async () => {
    const { env } = makeEnv([songRow({ status: 'PENDING' }) as never]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);
    expect(res.status).toBe(400);
  });

  it('ตอบ 400 เมื่อ continueAt เกินความยาวเพลงต้นทาง', async () => {
    const { env } = makeEnv([songRow({ duration: 100 }) as never]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        defaultParamFlag: true, continueAt: 150, prompt: 'p', style: 's', title: 't',
      }),
    }, env);
    expect(res.status).toBe(400);
  });

  it('ตอบ 502 เมื่อ kie ปฏิเสธ', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 402, msg: 'Insufficient Credits' }),
    }));
    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);
    expect(res.status).toBe(502);
  });

  it('ตอบ 401 เมื่อไม่มี cookie', async () => {
    const { env } = makeEnv([songRow() as never]);
    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);
    expect(res.status).toBe(401);
  });
});
