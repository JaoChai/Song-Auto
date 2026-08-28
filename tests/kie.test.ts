import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateGenerate, kieGenerate, kiePollTask, type GenerateInput } from '../src/worker/kie';
import type { Env } from '../src/worker/types';

const env: Env = { DB: {} as any, AUDIO: {} as any, KIE_API_KEY: 'test-key', APP_PASSWORD: 'pw' };

const baseInput: GenerateInput = { prompt: 'a calm piano song', instrumental: true, model: 'V4_5' };

// --- validateGenerate ---
describe('validateGenerate', () => {
  it('accepts a valid simple-mode input', () => {
    expect(validateGenerate(baseInput)).toBeNull();
  });

  it('accepts custom mode with style+title at limits (5000 prompt, 1000 style, 80 title)', () => {
    const custom: GenerateInput = {
      prompt: 'x'.repeat(5000),
      style: 'y'.repeat(1000),
      title: 't'.repeat(80),
      instrumental: false,
      model: 'V4_5',
    };
    expect(validateGenerate(custom)).toBeNull();
  });

  it('rejects empty prompt', () => {
    expect(validateGenerate({ ...baseInput, prompt: '' })).toMatch(/prompt/i);
  });

  it('rejects simple prompt over 3000 chars', () => {
    expect(validateGenerate({ ...baseInput, prompt: 'x'.repeat(3001) })).toMatch(/3000/);
  });

  it('rejects simple prompt exactly at 3001 but accepts 3000', () => {
    expect(validateGenerate({ ...baseInput, prompt: 'x'.repeat(3001) })).not.toBeNull();
    expect(validateGenerate({ ...baseInput, prompt: 'x'.repeat(3000) })).toBeNull();
  });

  it('rejects custom prompt over 5000 chars', () => {
    expect(validateGenerate({ ...baseInput, style: 's', title: 't', prompt: 'x'.repeat(5001) })).toMatch(/5000/);
  });

  it('rejects title over 80 chars', () => {
    expect(validateGenerate({ ...baseInput, title: 't'.repeat(81) })).toMatch(/80/);
  });

  it('rejects style over 1000 chars', () => {
    expect(validateGenerate({ ...baseInput, style: 's'.repeat(1001) })).toMatch(/1000/);
  });

  it('rejects unknown model', () => {
    expect(validateGenerate({ ...baseInput, model: 'V9' })).toMatch(/model/i);
  });
});

// --- kieGenerate ---
describe('kieGenerate', () => {
  const okFetch = () =>
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { taskId: 'task-123' } }),
    });

  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns taskId from data.taskId and sends Bearer auth + customMode', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const taskId = await kieGenerate(env, { ...baseInput, style: 'Folk', title: 'Hi' });
    expect(taskId).toBe('task-123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.kie.ai/api/v1/generate');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.customMode).toBe(true);
    expect(body.style).toBe('Folk');
    expect(body.title).toBe('Hi');
    expect(body.model).toBe('V4_5');
  });

  it('sends customMode false for simple input and no style/title', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    await kieGenerate(env, baseInput);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.customMode).toBe(false);
    expect(body.prompt).toBe(baseInput.prompt);
    expect(body.instrumental).toBe(true);
    expect(body.style).toBeUndefined();
    expect(body.title).toBeUndefined();
  });

  it('throws on envelope code !== 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 402, msg: 'insufficient credits', data: null }),
    }));
    await expect(kieGenerate(env, baseInput)).rejects.toThrow(/insufficient credits/);
  });

  it('throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    await expect(kieGenerate(env, baseInput)).rejects.toThrow();
  });
});

// --- kiePollTask ---
describe('kiePollTask', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const stubPoll = (data: unknown) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, msg: 'success', data }),
    }));

  it('maps PENDING / TEXT_SUCCESS / FIRST_SUCCESS → PENDING', async () => {
    for (const status of ['PENDING', 'TEXT_SUCCESS', 'FIRST_SUCCESS']) {
      stubPoll({ taskId: 't', status, response: { sunoData: [] } });
      const res = await kiePollTask(env, 't');
      expect(res.kind).toBe('PENDING');
    }
  });

  it('maps each FAILED status to FAILED with errorMessage', async () => {
    for (const status of ['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR']) {
      stubPoll({ taskId: 't', status, errorMessage: `boom-${status}` });
      const res = await kiePollTask(env, 't');
      if (res.kind !== 'FAILED') throw new Error(`expected FAILED, got ${JSON.stringify(res)}`);
      expect(res.kind).toBe('FAILED');
      expect(res.error).toBe(`boom-${status}`);
    }
  });

  it('SUCCESS extracts first sunoData track (camelCase audioUrl, duration, tags)', async () => {
    stubPoll({
      taskId: 't',
      status: 'SUCCESS',
      response: {
        sunoData: [
          { id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano' },
          { id: 'a2', audioUrl: 'https://cdn/2.mp3', duration: 198.5, tags: 'other' },
        ],
      },
    });
    const res = await kiePollTask(env, 't');
    expect(res.track?.audioUrl).toBe('https://cdn/1.mp3');
  });

  it('SUCCESS result carries track from sunoData[0]', async () => {
    stubPoll({
      taskId: 't',
      status: 'SUCCESS',
      response: {
        sunoData: [
          { id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano' },
          { id: 'a2', audioUrl: 'https://cdn/2.mp3', duration: 198.5, tags: 'other' },
        ],
      },
    });
    const res = await kiePollTask(env, 't');
    expect(res.track).toEqual({ audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano', imageUrl: null });
  });

  it('envelope code !== 200 → TRANSIENT with msg in note', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 429, msg: 'rate limited', data: null }),
    }));
    const res = await kiePollTask(env, 't');
    if (res.kind !== 'TRANSIENT') throw new Error(`expected TRANSIENT, got ${JSON.stringify(res)}`);
    expect(res.note).toMatch(/rate limited/);
  });

  it('network throw → TRANSIENT', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    const res = await kiePollTask(env, 't');
    if (res.kind !== 'TRANSIENT') throw new Error(`expected TRANSIENT, got ${JSON.stringify(res)}`);
    expect(res.note).toMatch(/ECONNRESET/);
  });

  it('GETs record-info with the taskId query param and Bearer header', async () => {
    stubPoll({ taskId: 'abc', status: 'PENDING', response: { sunoData: [] } });
    const fetchMock = vi.mocked(fetch);
    await kiePollTask(env, 'abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.kie.ai/api/v1/generate/record-info?taskId=abc');
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  });
});

describe('kiePollTask cover art', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('extracts imageUrl from the first sunoData item', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        code: 200, msg: 'ok',
        data: {
          status: 'SUCCESS',
          response: { sunoData: [{ audioUrl: 'https://x/a.mp3', duration: 120, tags: 'pop', imageUrl: 'https://x/a.jpg' }] },
        },
      })),
    ));
    const res = await kiePollTask(env, 'task-1');
    expect(res.track?.imageUrl).toBe('https://x/a.jpg');
  });

  it('yields null imageUrl when the field is absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        code: 200, msg: 'ok',
        data: { status: 'SUCCESS', response: { sunoData: [{ audioUrl: 'https://x/a.mp3' }] } },
      })),
    ));
    const res = await kiePollTask(env, 'task-1');
    expect(res.track?.imageUrl).toBeNull();
  });
});
