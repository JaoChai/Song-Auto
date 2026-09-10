import type { Env } from './types';

const BASE_URL = 'https://api.kie.ai';
// kie.ai requires callBackUrl (422 without it) even though we poll record-info instead
const CALLBACK_URL = 'https://song-auto.anugooltippon.workers.dev/api/health';
const KIE_MODELS = ['V3_5', 'V4', 'V4_5', 'V4_5PLUS', 'V4_5ALL', 'V5'] as const;
const PERSONA_MODELS = ['style_persona', 'voice_persona'] as const;
const PERSONA_CAPABLE_MODELS = ['V5'] as const;

const PROMPT_LIMIT_SIMPLE = 3000;
const PROMPT_LIMIT_CUSTOM = 5000;
const STYLE_LIMIT = 1000;
const TITLE_LIMIT = 80;

const VOCAL_GENDERS = ['m', 'f'] as const;

export interface GenerateInput {
  prompt: string;
  style?: string;
  title?: string;
  instrumental: boolean;
  model: string;
  negativeTags?: string;
  personaId?: string;
  personaModel?: string;
  vocalGender?: string;
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
}

const KIE_FAILED_STATUSES = [
  'CREATE_TASK_FAILED',
  'GENERATE_AUDIO_FAILED',
  'CALLBACK_EXCEPTION',
  'SENSITIVE_WORD_ERROR',
] as const;

// kie only treats prompt as lyrics for custom + non-instrumental; an
// instrumental custom-mode track is described by style + title alone.
const promptIsOptional = (input: GenerateInput): boolean =>
  Boolean(input.style || input.title) && input.instrumental;

// persona ใช้ได้เฉพาะเมื่อมาครบคู่ — kie ต้องรู้ทั้ง id และโหมดที่จะใช้มัน
const checkPersonaPair = (personaId?: string, personaModel?: string): string | null => {
  if (Boolean(personaId) !== Boolean(personaModel)) {
    return 'personaId and personaModel must be given together';
  }
  if (personaModel && !(PERSONA_MODELS as readonly string[]).includes(personaModel)) {
    return `unsupported personaModel '${personaModel}' (expected one of ${PERSONA_MODELS.join(', ')})`;
  }
  return null;
};

const checkUnitRange = (value: number | undefined, name: string): string | null => {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > 1) return `${name} must be between 0 and 1`;
  return null;
};

export function validateGenerate(input: GenerateInput): string | null {
  if (!promptIsOptional(input) && (!input.prompt || !input.prompt.trim())) return 'prompt is required';
  const custom = Boolean(input.style || input.title);
  const promptLimit = custom ? PROMPT_LIMIT_CUSTOM : PROMPT_LIMIT_SIMPLE;
  if (input.prompt && input.prompt.length > promptLimit) {
    return `prompt exceeds ${promptLimit} characters (${custom ? 'custom mode' : 'simple mode'})`;
  }
  if (input.style && input.style.length > STYLE_LIMIT) {
    return `style exceeds ${STYLE_LIMIT} characters`;
  }
  if (input.title && input.title.length > TITLE_LIMIT) {
    return `title exceeds ${TITLE_LIMIT} characters`;
  }
  if (!(KIE_MODELS as readonly string[]).includes(input.model)) {
    return `unsupported model '${input.model}' (expected one of ${KIE_MODELS.join(', ')})`;
  }
  if (input.vocalGender && !(VOCAL_GENDERS as readonly string[]).includes(input.vocalGender)) {
    return `unsupported vocalGender '${input.vocalGender}' (expected one of ${VOCAL_GENDERS.join(', ')})`;
  }
  return (
    checkUnitRange(input.styleWeight, 'styleWeight') ??
    checkUnitRange(input.weirdnessConstraint, 'weirdnessConstraint') ??
    checkUnitRange(input.audioWeight, 'audioWeight') ??
    checkPersonaPair(input.personaId, input.personaModel)
  );
}

const authHeaders = (env: Env): Record<string, string> => ({
  Authorization: `Bearer ${env.KIE_API_KEY}`,
  'Content-Type': 'application/json',
});

/** POST /api/v1/generate — returns the kie taskId. Throws on any failure (caller decides HTTP mapping). */
export async function kieGenerate(env: Env, input: GenerateInput): Promise<string> {
  const validation = validateGenerate(input);
  if (validation) throw new Error(validation);

  const custom = Boolean(input.style || input.title);
  const body: Record<string, unknown> = {
    customMode: custom,
    instrumental: input.instrumental,
    model: input.model,
    callBackUrl: CALLBACK_URL,
  };
  if (!promptIsOptional(input)) body.prompt = input.prompt;
  if (custom) {
    if (input.style) body.style = input.style;
    if (input.title) body.title = input.title;
  }
  if (input.negativeTags) body.negativeTags = input.negativeTags;
  if (input.personaId && input.personaModel) {
    body.personaId = input.personaId;
    body.personaModel = input.personaModel;
  }
  if (input.vocalGender) body.vocalGender = input.vocalGender;
  if (typeof input.styleWeight === 'number') body.styleWeight = input.styleWeight;
  if (typeof input.weirdnessConstraint === 'number') body.weirdnessConstraint = input.weirdnessConstraint;
  if (typeof input.audioWeight === 'number') body.audioWeight = input.audioWeight;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/generate`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`kie generate network error: ${(err as Error).message}`);
  }

  let envelope: { code: number; msg: string; data?: { taskId?: string } };
  try {
    envelope = await res.json();
  } catch {
    throw new Error(`kie generate: invalid JSON response (HTTP ${res.status})`);
  }
  if (envelope.code !== 200) {
    throw new Error(`kie generate failed (code ${envelope.code}): ${envelope.msg}`);
  }
  const taskId = envelope.data?.taskId;
  if (!taskId) throw new Error('kie generate: response missing data.taskId');
  return taskId;
}

export type KiePoll =
  | { kind: 'PENDING'; tracks: TrackInfo[]; complete: boolean }
  | { kind: 'FAILED'; error: string }
  | { kind: 'TRANSIENT'; note: string };

export interface TrackInfo {
  sunoId: string;
  audioUrl: string;
  duration: number | null;
  tags: string | null;
  imageUrl: string | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/**
 * GET /api/v1/generate/record-info — the single source of kie status mapping.
 * The four FAILED enums → FAILED with errorMessage; PENDING/TEXT_SUCCESS/FIRST_SUCCESS/SUCCESS →
 * PENDING carrying every sunoData item in its original position (complete=true only on SUCCESS);
 * non-200 envelope or network throw → TRANSIENT (safe to retry).
 *
 * Positions are preserved on purpose: a row keeps its own index into this array, so an item
 * that has not got its audioUrl yet must stay in place rather than be filtered out.
 */
export async function kiePollTask(env: Env, taskId: string): Promise<KiePoll> {
  let data: {
    status?: string;
    errorMessage?: string;
    response?: { sunoData?: Array<Record<string, unknown>> };
  };
  try {
    const res = await fetch(`${BASE_URL}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${env.KIE_API_KEY}` },
    });
    const envelope = await res.json() as { code: number; msg: string; data: typeof data };
    if (envelope.code !== 200) {
      return { kind: 'TRANSIENT', note: `kie poll envelope code ${envelope.code}: ${envelope.msg}` };
    }
    data = envelope.data;
  } catch (err) {
    return { kind: 'TRANSIENT', note: `kie poll network error: ${(err as Error).message}` };
  }

  const status = data?.status;
  if (status && (KIE_FAILED_STATUSES as readonly string[]).includes(status)) {
    return { kind: 'FAILED', error: data?.errorMessage || `kie task ${status}` };
  }
  if (status === 'PENDING' || status === 'TEXT_SUCCESS' || status === 'FIRST_SUCCESS' || status === 'SUCCESS') {
    const items = data?.response?.sunoData ?? [];
    const tracks: TrackInfo[] = items.map((it) => ({
      sunoId: str(it?.id),
      audioUrl: str(it?.audioUrl),
      duration: typeof it?.duration === 'number' ? it.duration : null,
      tags: strOrNull(it?.tags),
      imageUrl: strOrNull(it?.imageUrl),
    }));
    return { kind: 'PENDING', tracks, complete: status === 'SUCCESS' };
  }
  return { kind: 'TRANSIENT', note: `kie poll: unexpected status '${String(status)}'` };
}

const WAV_FAILED_STATUSES = [
  'CREATE_TASK_FAILED',
  'GENERATE_WAV_FAILED',
  'CALLBACK_EXCEPTION',
] as const;

export interface WavGenerateInput {
  /** taskId ของงานสร้าง/ต่อเพลงเดิม (ไม่ใช่ taskId ของงานแปลง WAV) */
  taskId: string;
  /** sunoId ของแทร็กที่จะแปลง — ต้องระบุเพราะหนึ่ง taskId มีได้หลายแทร็ก */
  audioId: string;
}

// รหัสตาม docs ของ /wav/generate ที่ "ลองใหม่ได้" (ชั่วคราว) — ที่เหลือ (402/404/409/422/400/401) ลองใหม่ไม่ช่วย
const WAV_GENERATE_RETRYABLE_CODES = [429, 455, 500];

export class WavGenerateError extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
    this.name = 'WavGenerateError';
  }
}

/** POST /api/v1/wav/generate — เริ่มงานแปลง WAV คืน taskId ของงานแปลง (คนละอันกับ taskId ที่ส่งเข้าไป) ไว้ poll ต่อ */
export async function kieWavGenerate(env: Env, input: WavGenerateInput): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/wav/generate`, {
      method: 'POST',
      headers: authHeaders(env),
      // kie บังคับให้มี callBackUrl เหมือน endpoint อื่นทั้งที่เราใช้วิธี poll
      body: JSON.stringify({ taskId: input.taskId, audioId: input.audioId, callBackUrl: CALLBACK_URL }),
    });
  } catch (err) {
    throw new WavGenerateError(`kie wav generate network error: ${(err as Error).message}`, true);
  }

  let envelope: { code: number; msg: string; data?: { taskId?: string } };
  try {
    envelope = await res.json();
  } catch {
    throw new WavGenerateError(`kie wav generate: invalid JSON response (HTTP ${res.status})`, true);
  }
  if (envelope.code !== 200) {
    const retryable = (WAV_GENERATE_RETRYABLE_CODES as readonly number[]).includes(envelope.code);
    throw new WavGenerateError(`kie wav generate failed (code ${envelope.code}): ${envelope.msg}`, retryable);
  }
  const taskId = envelope.data?.taskId;
  if (!taskId) throw new WavGenerateError('kie wav generate: response missing data.taskId', true);
  return taskId;
}

export type WavPoll =
  | { kind: 'PENDING' }
  | { kind: 'SUCCESS'; audioWavUrl: string }
  | { kind: 'FAILED'; error: string }
  | { kind: 'TRANSIENT'; note: string };

/** GET /api/v1/wav/record-info — poll งานแปลง WAV ที่เริ่มด้วย kieWavGenerate (สถานะอยู่ใน successFlag ไม่ใช่ status) */
export async function kieWavPoll(env: Env, taskId: string): Promise<WavPoll> {
  let data: {
    successFlag?: string;
    errorMessage?: string;
    response?: { audioWavUrl?: string };
  };
  try {
    const res = await fetch(`${BASE_URL}/api/v1/wav/record-info?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${env.KIE_API_KEY}` },
    });
    const envelope = await res.json() as { code: number; msg: string; data: typeof data };
    if (envelope.code !== 200) {
      return { kind: 'TRANSIENT', note: `kie wav poll envelope code ${envelope.code}: ${envelope.msg}` };
    }
    data = envelope.data;
  } catch (err) {
    return { kind: 'TRANSIENT', note: `kie wav poll network error: ${(err as Error).message}` };
  }

  const status = data?.successFlag;
  if (status && (WAV_FAILED_STATUSES as readonly string[]).includes(status)) {
    return { kind: 'FAILED', error: data?.errorMessage || `kie wav task ${status}` };
  }
  if (status === 'SUCCESS') {
    const audioWavUrl = data?.response?.audioWavUrl;
    if (!audioWavUrl) return { kind: 'TRANSIENT', note: 'kie wav poll: SUCCESS but missing audioWavUrl' };
    return { kind: 'SUCCESS', audioWavUrl };
  }
  if (status === 'PENDING') return { kind: 'PENDING' };
  return { kind: 'TRANSIENT', note: `kie wav poll: unexpected status '${String(status)}'` };
}

export const PERSONA_SEGMENT_MIN = 10;
export const PERSONA_SEGMENT_MAX = 30;

export interface CreatePersonaInput {
  taskId: string;
  audioId: string;
  name: string;
  description: string;
  /** ช่วงเวลาที่ให้ kie วิเคราะห์ ต้องห่างกัน 10-30 วินาที ค่าตั้งต้นคือ 0-30 */
  vocalStart?: number;
  vocalEnd?: number;
  /** แท็บแนวเพลงเสริม เช่น "Electronic Pop" */
  style?: string;
}

export function validatePersonaSegment(
  start: number,
  end: number,
  duration: number | null,
): string | null {
  if (!Number.isFinite(start) || start < 0) return 'vocalStart must be 0 or greater';
  if (!Number.isFinite(end) || end <= start) return 'vocalEnd must be greater than vocalStart';
  const span = end - start;
  if (span < PERSONA_SEGMENT_MIN) {
    return `ช่วงที่เลือกต้องยาวอย่างน้อย ${PERSONA_SEGMENT_MIN} วินาที`;
  }
  if (span > PERSONA_SEGMENT_MAX) {
    return `ช่วงที่เลือกต้องไม่ยาวเกิน ${PERSONA_SEGMENT_MAX} วินาที`;
  }
  if (typeof duration === 'number' && end > duration) {
    return `ช่วงที่เลือกเลยความยาวเพลง (${Math.floor(duration)} วินาที)`;
  }
  return null;
}

/**
 * POST /api/v1/generate/generate-persona — returns kie's personaId.
 * Throws on any failure (caller decides HTTP mapping), same contract as kieGenerate.
 */
export async function kieCreatePersona(env: Env, input: CreatePersonaInput): Promise<string> {
  const body: Record<string, unknown> = {
    taskId: input.taskId,
    audioId: input.audioId,
    name: input.name,
    description: input.description,
  };
  if (typeof input.vocalStart === 'number') body.vocalStart = input.vocalStart;
  if (typeof input.vocalEnd === 'number') body.vocalEnd = input.vocalEnd;
  if (input.style) body.style = input.style;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/generate/generate-persona`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`kie persona network error: ${(err as Error).message}`);
  }

  let envelope: { code: number; msg: string; data?: { personaId?: string } };
  try {
    envelope = await res.json();
  } catch {
    throw new Error(`kie persona: invalid JSON response (HTTP ${res.status})`);
  }
  if (envelope.code !== 200) {
    throw new Error(`kie persona failed (code ${envelope.code}): ${envelope.msg}`);
  }
  const personaId = envelope.data?.personaId;
  if (!personaId) throw new Error('kie persona: response missing data.personaId');
  return personaId;
}

export interface ExtendInput {
  audioId: string;
  model: string;
  defaultParamFlag: boolean;
  /** ความยาวเพลงต้นทาง (วินาที) ใช้ตรวจว่า continueAt ไม่เลยท้ายเพลง */
  sourceDuration?: number | null;
  continueAt?: number;
  prompt?: string;
  style?: string;
  title?: string;
  negativeTags?: string;
  personaId?: string;
  personaModel?: string;
  instrumental?: boolean;
}

export function validateExtend(input: ExtendInput): string | null {
  if (!input.audioId || !input.audioId.trim()) return 'audioId is required';
  if (!(KIE_MODELS as readonly string[]).includes(input.model)) {
    return `unsupported model '${input.model}' (expected one of ${KIE_MODELS.join(', ')})`;
  }

  if (input.defaultParamFlag) {
    const at = input.continueAt;
    if (typeof at !== 'number' || Number.isNaN(at) || at <= 0) {
      return 'continueAt is required and must be greater than 0 in custom mode';
    }
    if (typeof input.sourceDuration === 'number' && at >= input.sourceDuration) {
      return `continueAt must be less than the source duration (${input.sourceDuration}s)`;
    }
    if (!input.style || !input.style.trim()) return 'style is required in custom mode';
    if (!input.title || !input.title.trim()) return 'title is required in custom mode';
    if (!input.instrumental && (!input.prompt || !input.prompt.trim())) {
      return 'prompt is required in custom mode unless instrumental';
    }
  }

  // ขีดจำกัดตัวอักษร — ตรวจเสมอ แม้ค่าเหล่านี้จะถูกส่งจริงเฉพาะเมื่อ defaultParamFlag = true
  if (input.prompt && input.prompt.length > PROMPT_LIMIT_CUSTOM) {
    return `prompt exceeds ${PROMPT_LIMIT_CUSTOM} characters`;
  }
  if (input.style && input.style.length > STYLE_LIMIT) {
    return `style exceeds ${STYLE_LIMIT} characters`;
  }
  if (input.title && input.title.length > TITLE_LIMIT) {
    return `title exceeds ${TITLE_LIMIT} characters`;
  }

  const personaError = checkPersonaPair(input.personaId, input.personaModel);
  if (personaError) return personaError;
  if (input.personaModel && !(PERSONA_CAPABLE_MODELS as readonly string[]).includes(input.model)) {
    return `persona requires model V5 (got '${input.model}')`;
  }
  return null;
}

/** POST /api/v1/generate/extend — returns the kie taskId. Throws on any failure. */
export async function kieExtend(env: Env, input: ExtendInput): Promise<string> {
  const validation = validateExtend(input);
  if (validation) throw new Error(validation);

  const body: Record<string, unknown> = {
    audioId: input.audioId,
    model: input.model,
    defaultParamFlag: input.defaultParamFlag,
    // kie บังคับให้มี callBackUrl เหมือน generate ทั้งที่เราใช้วิธี poll
    callBackUrl: CALLBACK_URL,
  };
  if (input.defaultParamFlag) {
    body.continueAt = input.continueAt;
    body.style = input.style;
    body.title = input.title;
    if (!input.instrumental) body.prompt = input.prompt;
  }
  if (typeof input.instrumental === 'boolean') body.instrumental = input.instrumental;
  if (input.negativeTags) body.negativeTags = input.negativeTags;
  if (input.personaId && input.personaModel) {
    body.personaId = input.personaId;
    body.personaModel = input.personaModel;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/generate/extend`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`kie extend network error: ${(err as Error).message}`);
  }

  let envelope: { code: number; msg: string; data?: { taskId?: string } };
  try {
    envelope = await res.json();
  } catch {
    throw new Error(`kie extend: invalid JSON response (HTTP ${res.status})`);
  }
  if (envelope.code !== 200) {
    throw new Error(`kie extend failed (code ${envelope.code}): ${envelope.msg}`);
  }
  const taskId = envelope.data?.taskId;
  if (!taskId) throw new Error('kie extend: response missing data.taskId');
  return taskId;
}

export const LYRICS_PROMPT_LIMIT = 200;

export interface LyricsVariant {
  title: string;
  text: string;
}

export type LyricsPoll =
  | { kind: 'PENDING' }
  | { kind: 'SUCCESS'; variants: LyricsVariant[] }
  | { kind: 'FAILED'; error: string }
  | { kind: 'TRANSIENT'; note: string };

const LYRICS_FAILED_STATUSES = [
  'CREATE_TASK_FAILED',
  'GENERATE_LYRICS_FAILED',
  'CALLBACK_EXCEPTION',
  'SENSITIVE_WORD_ERROR',
] as const;

export function validateLyricsPrompt(prompt: string): string | null {
  if (!prompt || !prompt.trim()) return 'prompt is required';
  if (prompt.length > LYRICS_PROMPT_LIMIT) {
    return `prompt exceeds ${LYRICS_PROMPT_LIMIT} characters`;
  }
  return null;
}

/** POST /api/v1/lyrics — returns the kie taskId. Throws on any failure. */
export async function kieGenerateLyrics(env: Env, prompt: string): Promise<string> {
  const validation = validateLyricsPrompt(prompt);
  if (validation) throw new Error(validation);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/lyrics`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify({ prompt, callBackUrl: CALLBACK_URL }),
    });
  } catch (err) {
    throw new Error(`kie lyrics network error: ${(err as Error).message}`);
  }

  let envelope: { code: number; msg: string; data?: { taskId?: string } };
  try {
    envelope = await res.json();
  } catch {
    throw new Error(`kie lyrics: invalid JSON response (HTTP ${res.status})`);
  }
  if (envelope.code !== 200) {
    throw new Error(`kie lyrics failed (code ${envelope.code}): ${envelope.msg}`);
  }
  const taskId = envelope.data?.taskId;
  if (!taskId) throw new Error('kie lyrics: response missing data.taskId');
  return taskId;
}

/**
 * GET /api/v1/lyrics/record-info — งานแต่งเนื้อเพลงมีสถานะชุดของตัวเอง
 * และคืนผลใน data.response.data[] ซึ่งคนละรูปกับ sunoData ของงานสร้างเพลง
 */
export async function kiePollLyrics(env: Env, taskId: string): Promise<LyricsPoll> {
  let data: {
    status?: string;
    errorMessage?: string;
    response?: { data?: Array<Record<string, unknown>> };
  };
  try {
    const res = await fetch(
      `${BASE_URL}/api/v1/lyrics/record-info?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${env.KIE_API_KEY}` } },
    );
    const envelope = await res.json() as { code: number; msg: string; data: typeof data };
    if (envelope.code !== 200) {
      return { kind: 'TRANSIENT', note: `kie lyrics poll envelope code ${envelope.code}: ${envelope.msg}` };
    }
    data = envelope.data;
  } catch (err) {
    return { kind: 'TRANSIENT', note: `kie lyrics poll network error: ${(err as Error).message}` };
  }

  const status = data?.status;
  if (status && (LYRICS_FAILED_STATUSES as readonly string[]).includes(status)) {
    return { kind: 'FAILED', error: data?.errorMessage || `kie lyrics task ${status}` };
  }
  if (status === 'SUCCESS') {
    const items = data?.response?.data ?? [];
    const variants: LyricsVariant[] = items
      .map((it) => ({ title: str(it?.title), text: str(it?.text) }))
      .filter((v) => v.text.trim().length > 0);
    return { kind: 'SUCCESS', variants };
  }
  if (status === 'PENDING') return { kind: 'PENDING' };
  return { kind: 'TRANSIENT', note: `kie lyrics poll: unexpected status '${String(status)}'` };
}
