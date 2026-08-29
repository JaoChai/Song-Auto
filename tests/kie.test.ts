import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateGenerate, kieGenerate, kiePollTask, kieCreatePersona, type GenerateInput } from '../src/worker/kie';
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

  it('SUCCESS carries every sunoData item in order, with sunoId', async () => {
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
    if (res.kind !== 'PENDING') throw new Error(`expected PENDING, got ${JSON.stringify(res)}`);
    expect(res.complete).toBe(true);
    expect(res.tracks).toEqual([
      { sunoId: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano', imageUrl: null },
      { sunoId: 'a2', audioUrl: 'https://cdn/2.mp3', duration: 198.5, tags: 'other', imageUrl: null },
    ]);
  });

  it('FIRST_SUCCESS carries the tracks that arrived so far and complete=false', async () => {
    stubPoll({
      taskId: 't',
      status: 'FIRST_SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 100, tags: 'x' }] },
    });
    const res = await kiePollTask(env, 't');
    if (res.kind !== 'PENDING') throw new Error(`expected PENDING, got ${JSON.stringify(res)}`);
    expect(res.complete).toBe(false);
    expect(res.tracks).toHaveLength(1);
    expect(res.tracks[0].sunoId).toBe('a1');
  });

  it('an item without audioUrl becomes an empty audioUrl, keeping its position', async () => {
    stubPoll({
      taskId: 't',
      status: 'FIRST_SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3' }, { id: 'a2' }] },
    });
    const res = await kiePollTask(env, 't');
    if (res.kind !== 'PENDING') throw new Error(`expected PENDING, got ${JSON.stringify(res)}`);
    expect(res.tracks).toHaveLength(2);
    expect(res.tracks[1].audioUrl).toBe('');
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
    expect(res.kind === 'PENDING' && res.tracks[0].imageUrl).toBe('https://x/a.jpg');
  });

  it('yields null imageUrl when the field is absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        code: 200, msg: 'ok',
        data: { status: 'SUCCESS', response: { sunoData: [{ audioUrl: 'https://x/a.mp3' }] } },
      })),
    ));
    const res = await kiePollTask(env, 'task-1');
    expect(res.kind === 'PENDING' && res.tracks[0].imageUrl).toBeNull();
  });
});

describe('instrumental mode', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const base = { style: 'lo-fi', title: 'Rain', model: 'V5' };

  it('accepts an empty prompt when instrumental in custom mode', () => {
    expect(validateGenerate({ ...base, prompt: '', instrumental: true })).toBeNull();
  });

  it('still rejects an empty prompt when not instrumental', () => {
    expect(validateGenerate({ ...base, prompt: '', instrumental: false })).toBe('prompt is required');
  });

  it('still rejects an empty prompt in simple mode even when instrumental', () => {
    expect(validateGenerate({ prompt: '', instrumental: true, model: 'V5' })).toBe('prompt is required');
  });

  it('omits prompt from the request body for instrumental custom mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, msg: 'ok', data: { taskId: 'T1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await kieGenerate(env, { ...base, prompt: '', instrumental: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.prompt).toBeUndefined();
    expect(body.style).toBe('lo-fi');
    expect(body.instrumental).toBe(true);
  });
});

describe('persona in generate', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const custom: GenerateInput = {
    prompt: 'a calm piano song', style: 'lo-fi', title: 'Rain', instrumental: false, model: 'V5',
  };

  it('accepts personaId + personaModel together', () => {
    expect(validateGenerate({ ...custom, personaId: 'persona_1', personaModel: 'style_persona' })).toBeNull();
    expect(validateGenerate({ ...custom, personaId: 'persona_1', personaModel: 'voice_persona' })).toBeNull();
  });

  it('rejects personaId without personaModel and vice versa', () => {
    expect(validateGenerate({ ...custom, personaId: 'persona_1' })).toMatch(/persona/i);
    expect(validateGenerate({ ...custom, personaModel: 'style_persona' })).toMatch(/persona/i);
  });

  it('rejects an unknown personaModel', () => {
    expect(validateGenerate({ ...custom, personaId: 'p', personaModel: 'other' })).toMatch(/personaModel/i);
  });

  it('forwards both persona fields to kie when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { taskId: 't1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await kieGenerate(env, { ...custom, personaId: 'persona_1', personaModel: 'voice_persona' });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.personaId).toBe('persona_1');
    expect(body.personaModel).toBe('voice_persona');
  });

  it('omits both persona keys entirely when not given', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { taskId: 't1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await kieGenerate(env, custom);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect('personaId' in body).toBe(false);
    expect('personaModel' in body).toBe(false);
  });
});

describe('kieCreatePersona', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const input = { taskId: 'task-1', audioId: 'a1', name: 'ชื่อ', description: 'คำอธิบาย' };

  it('POSTs to generate-persona with the auth header and returns personaId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { personaId: 'persona_123' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const id = await kieCreatePersona(env, input);
    expect(id).toBe('persona_123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.kie.ai/api/v1/generate/generate-persona');
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(input);
  });

  it('throws when the envelope code is not 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 402, msg: 'insufficient credits', data: null }),
    }));
    await expect(kieCreatePersona(env, input)).rejects.toThrow(/insufficient credits/);
  });

  it('throws when personaId is missing from a 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: {} }),
    }));
    await expect(kieCreatePersona(env, input)).rejects.toThrow(/personaId/);
  });

  it('throws on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    await expect(kieCreatePersona(env, input)).rejects.toThrow(/ECONNRESET/);
  });
});
