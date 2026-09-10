import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateGenerate, kieGenerate, kiePollTask, kieCreatePersona,
  validateExtend, kieExtend, type GenerateInput, type ExtendInput,
  validateLyricsPrompt, kieGenerateLyrics, kiePollLyrics, LYRICS_PROMPT_LIMIT,
  validatePersonaSegment,
} from '../src/worker/kie';
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

describe('validatePersonaSegment', () => {
  it('รับช่วงมาตรฐาน 0 ถึง 30', () => {
    expect(validatePersonaSegment(0, 30, 100)).toBeNull();
  });

  it('รับช่วงสั้นสุดที่อนุญาต คือ 10 วินาที', () => {
    expect(validatePersonaSegment(12, 22, 100)).toBeNull();
  });

  it('ปฏิเสธช่วงที่สั้นกว่า 10 วินาที', () => {
    expect(validatePersonaSegment(10, 19, 100)).toMatch(/10/);
  });

  it('ปฏิเสธช่วงที่ยาวกว่า 30 วินาที', () => {
    expect(validatePersonaSegment(0, 31, 100)).toMatch(/30/);
  });

  it('ปฏิเสธเมื่อจุดจบมาก่อนจุดเริ่ม', () => {
    expect(validatePersonaSegment(40, 20, 100)).toMatch(/vocalEnd|vocalStart/i);
  });

  it('ปฏิเสธจุดเริ่มติดลบ', () => {
    expect(validatePersonaSegment(-1, 20, 100)).toMatch(/vocalStart/i);
  });

  it('ปฏิเสธเมื่อจุดจบเลยความยาวเพลง', () => {
    expect(validatePersonaSegment(0, 30, 25)).toMatch(/duration|ความยาว/i);
  });

  it('ยอมให้ผ่านเมื่อไม่รู้ความยาวเพลง', () => {
    expect(validatePersonaSegment(0, 30, null)).toBeNull();
  });
});

const baseExtend: ExtendInput = {
  audioId: 'a1', model: 'V5', defaultParamFlag: false,
};

describe('validateExtend', () => {
  it('โหมดใช้ค่าเดิมต้องการแค่ audioId กับ model', () => {
    expect(validateExtend(baseExtend)).toBeNull();
  });

  it('ปฏิเสธเมื่อไม่มี audioId', () => {
    expect(validateExtend({ ...baseExtend, audioId: '' })).toMatch(/audioId/i);
  });

  it('ปฏิเสธโมเดลที่ไม่รู้จัก', () => {
    expect(validateExtend({ ...baseExtend, model: 'V9' })).toMatch(/model/i);
  });

  it('โหมดปรับเองต้องมี continueAt, style, title ครบ', () => {
    const custom: ExtendInput = {
      ...baseExtend, defaultParamFlag: true, prompt: 'ต่อให้เบาลง', style: 'dream pop', title: 'ต่อ',
    };
    expect(validateExtend(custom)).toMatch(/continueAt/i);
    expect(validateExtend({ ...custom, continueAt: 30, style: '' })).toMatch(/style/i);
    expect(validateExtend({ ...custom, continueAt: 30, title: '' })).toMatch(/title/i);
    expect(validateExtend({ ...custom, continueAt: 30 })).toBeNull();
  });

  it('โหมดปรับเองที่ไม่ใช่ instrumental ต้องมี prompt', () => {
    const custom: ExtendInput = {
      ...baseExtend, defaultParamFlag: true, continueAt: 30, style: 's', title: 't',
    };
    expect(validateExtend(custom)).toMatch(/prompt/i);
    expect(validateExtend({ ...custom, instrumental: true })).toBeNull();
  });

  it('ปฏิเสธ continueAt ที่เป็น 0 หรือติดลบ', () => {
    const custom: ExtendInput = {
      ...baseExtend, defaultParamFlag: true, prompt: 'p', style: 's', title: 't',
    };
    expect(validateExtend({ ...custom, continueAt: 0 })).toMatch(/continueAt/i);
    expect(validateExtend({ ...custom, continueAt: -5 })).toMatch(/continueAt/i);
  });

  it('ปฏิเสธ continueAt ที่เกินความยาวเพลงต้นทาง', () => {
    const custom: ExtendInput = {
      ...baseExtend, defaultParamFlag: true, prompt: 'p', style: 's', title: 't',
      sourceDuration: 60,
    };
    expect(validateExtend({ ...custom, continueAt: 60 })).toMatch(/continueAt/i);
    expect(validateExtend({ ...custom, continueAt: 59.9 })).toBeNull();
  });

  it('ปฏิเสธ prompt ที่ยาวเกินขีดจำกัดของโมเดล', () => {
    const custom: ExtendInput = {
      ...baseExtend, defaultParamFlag: true, continueAt: 10, style: 's', title: 't',
      prompt: 'x'.repeat(5001),
    };
    expect(validateExtend(custom)).toMatch(/5000/);
  });

  it('ปฏิเสธ personaId ที่มาไม่ครบคู่กับ personaModel', () => {
    expect(validateExtend({ ...baseExtend, personaId: 'p1' })).toMatch(/personaModel/i);
    expect(validateExtend({ ...baseExtend, personaModel: 'style_persona' })).toMatch(/personaModel/i);
  });

  it('ปฏิเสธ persona กับโมเดลที่ต่ำกว่า V5', () => {
    const withPersona = { ...baseExtend, personaId: 'p1', personaModel: 'style_persona' };
    expect(validateExtend({ ...withPersona, model: 'V4_5' })).toMatch(/V5/);
    expect(validateExtend({ ...withPersona, model: 'V5' })).toBeNull();
  });
});

describe('kieExtend', () => {
  const okFetch = () =>
    vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { taskId: 'ext-1' } }),
    });

  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('ยิงไป /api/v1/generate/extend พร้อม Bearer และคืน taskId', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const taskId = await kieExtend(env, baseExtend);
    expect(taskId).toBe('ext-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.kie.ai/api/v1/generate/extend');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');
  });

  it('โหมดใช้ค่าเดิมส่งแค่ audioId, model, defaultParamFlag, callBackUrl', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    await kieExtend(env, baseExtend);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.audioId).toBe('a1');
    expect(body.model).toBe('V5');
    expect(body.defaultParamFlag).toBe(false);
    expect(body.callBackUrl).toBeTruthy();
    expect(body.continueAt).toBeUndefined();
    expect(body.prompt).toBeUndefined();
    expect(body.style).toBeUndefined();
    expect(body.title).toBeUndefined();
  });

  it('โหมดปรับเองส่ง continueAt, prompt, style, title', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    await kieExtend(env, {
      ...baseExtend, defaultParamFlag: true, continueAt: 42.5,
      prompt: 'ต่อให้เบาลง', style: 'dream pop', title: 'ต่อจากสายฝน',
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.defaultParamFlag).toBe(true);
    expect(body.continueAt).toBe(42.5);
    expect(body.prompt).toBe('ต่อให้เบาลง');
    expect(body.style).toBe('dream pop');
    expect(body.title).toBe('ต่อจากสายฝน');
  });

  it('ไม่ส่ง sourceDuration ต่อไปให้ kie', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    await kieExtend(env, { ...baseExtend, sourceDuration: 120 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.sourceDuration).toBeUndefined();
  });

  it('โยนเมื่อ input ไม่ผ่าน validate โดยไม่ยิง fetch', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    await expect(kieExtend(env, { ...baseExtend, audioId: '' })).rejects.toThrow(/audioId/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('โยนเมื่อ envelope code ไม่ใช่ 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 402, msg: 'Insufficient Credits' }),
    }));
    await expect(kieExtend(env, baseExtend)).rejects.toThrow(/402|Insufficient/);
  });

  it('โยนเมื่อไม่มี data.taskId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: {} }),
    }));
    await expect(kieExtend(env, baseExtend)).rejects.toThrow(/taskId/);
  });

  it('โยนพร้อมบอกว่าเป็น network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    await expect(kieExtend(env, baseExtend)).rejects.toThrow(/network/i);
  });
});

describe('validateLyricsPrompt', () => {
  it('รับคำอธิบายปกติ', () => {
    expect(validateLyricsPrompt('เพลงเศร้าเรื่องฝนตกที่เชียงใหม่')).toBeNull();
  });

  it('ปฏิเสธคำอธิบายว่างหรือมีแต่ช่องว่าง', () => {
    expect(validateLyricsPrompt('')).toMatch(/prompt/i);
    expect(validateLyricsPrompt('   ')).toMatch(/prompt/i);
  });

  it(`ปฏิเสธคำอธิบายที่ยาวเกิน ${LYRICS_PROMPT_LIMIT} ตัวอักษร`, () => {
    expect(validateLyricsPrompt('x'.repeat(LYRICS_PROMPT_LIMIT))).toBeNull();
    expect(validateLyricsPrompt('x'.repeat(LYRICS_PROMPT_LIMIT + 1))).toMatch(/200/);
  });
});

describe('kieGenerateLyrics', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('ยิงไป /api/v1/lyrics พร้อม prompt กับ callBackUrl แล้วคืน taskId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { taskId: 'lyr-1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const taskId = await kieGenerateLyrics(env, 'เพลงเศร้า');
    expect(taskId).toBe('lyr-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.kie.ai/api/v1/lyrics');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.prompt).toBe('เพลงเศร้า');
    expect(body.callBackUrl).toBeTruthy();
  });

  it('โยนโดยไม่ยิง fetch เมื่อคำอธิบายว่าง', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(kieGenerateLyrics(env, '  ')).rejects.toThrow(/prompt/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('โยนพร้อมรหัสเมื่อ envelope ไม่ใช่ 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 400, msg: 'Song Description contained artist name' }),
    }));
    await expect(kieGenerateLyrics(env, 'เพลงแบบ Bodyslam')).rejects.toThrow(/400/);
  });
});

describe('kiePollLyrics', () => {
  const poll = (data: unknown) =>
    vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data }),
    });

  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('คืน PENDING ระหว่างที่ยังไม่เสร็จ', async () => {
    vi.stubGlobal('fetch', poll({ status: 'PENDING' }));
    expect(await kiePollLyrics(env, 'lyr-1')).toEqual({ kind: 'PENDING' });
  });

  it('แปลง response.data[] เป็น variants เมื่อ SUCCESS', async () => {
    vi.stubGlobal('fetch', poll({
      status: 'SUCCESS',
      response: {
        data: [
          { text: '[Verse]\nบรรทัดหนึ่ง', title: 'ฝนเดือนกันยา', status: 'complete', errorMessage: '' },
          { text: '[Verse]\nอีกแบบ', title: 'สายฝน', status: 'complete', errorMessage: '' },
        ],
      },
    }));
    const out = await kiePollLyrics(env, 'lyr-1');
    expect(out.kind).toBe('SUCCESS');
    if (out.kind !== 'SUCCESS') throw new Error('unreachable');
    expect(out.variants).toHaveLength(2);
    expect(out.variants[0].title).toBe('ฝนเดือนกันยา');
    expect(out.variants[0].text).toContain('บรรทัดหนึ่ง');
  });

  it('ข้ามรายการที่ไม่มีเนื้อเพลง', async () => {
    vi.stubGlobal('fetch', poll({
      status: 'SUCCESS',
      response: { data: [{ text: '', title: 'ว่าง' }, { text: 'มีเนื้อ', title: 'ดี' }] },
    }));
    const out = await kiePollLyrics(env, 'lyr-1');
    if (out.kind !== 'SUCCESS') throw new Error('expected SUCCESS');
    expect(out.variants).toHaveLength(1);
    expect(out.variants[0].title).toBe('ดี');
  });

  it('คืน FAILED เมื่อสถานะเป็น GENERATE_LYRICS_FAILED', async () => {
    vi.stubGlobal('fetch', poll({ status: 'GENERATE_LYRICS_FAILED', errorMessage: 'แต่งไม่ได้' }));
    const out = await kiePollLyrics(env, 'lyr-1');
    expect(out.kind).toBe('FAILED');
    if (out.kind !== 'FAILED') throw new Error('unreachable');
    expect(out.error).toBe('แต่งไม่ได้');
  });

  it('คืน FAILED เมื่อสถานะเป็น SENSITIVE_WORD_ERROR', async () => {
    vi.stubGlobal('fetch', poll({ status: 'SENSITIVE_WORD_ERROR' }));
    expect((await kiePollLyrics(env, 'lyr-1')).kind).toBe('FAILED');
  });

  it('คืน FAILED เมื่อสถานะเป็น CREATE_TASK_FAILED', async () => {
    vi.stubGlobal('fetch', poll({ status: 'CREATE_TASK_FAILED' }));
    expect((await kiePollLyrics(env, 'lyr-1')).kind).toBe('FAILED');
  });

  it('คืน TRANSIENT เมื่อ envelope ไม่ใช่ 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 455, msg: 'maintenance' }),
    }));
    expect((await kiePollLyrics(env, 'lyr-1')).kind).toBe('TRANSIENT');
  });

  it('คืน TRANSIENT เมื่อ network พัง', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    expect((await kiePollLyrics(env, 'lyr-1')).kind).toBe('TRANSIENT');
  });
});
