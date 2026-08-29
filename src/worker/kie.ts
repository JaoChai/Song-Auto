import type { Env } from './types';

const BASE_URL = 'https://api.kie.ai';
const KIE_MODELS = ['V3_5', 'V4', 'V4_5', 'V4_5PLUS', 'V4_5ALL', 'V5'] as const;
const PERSONA_MODELS = ['style_persona', 'voice_persona'] as const;

const PROMPT_LIMIT_SIMPLE = 3000;
const PROMPT_LIMIT_CUSTOM = 5000;
const STYLE_LIMIT = 1000;
const TITLE_LIMIT = 80;

export interface GenerateInput {
  prompt: string;
  style?: string;
  title?: string;
  instrumental: boolean;
  model: string;
  negativeTags?: string;
  personaId?: string;
  personaModel?: string;
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
  // persona ใช้ได้เฉพาะเมื่อมาครบคู่ — kie ต้องรู้ทั้ง id และโหมดที่จะใช้มัน
  if (Boolean(input.personaId) !== Boolean(input.personaModel)) {
    return 'personaId and personaModel must be given together';
  }
  if (input.personaModel && !(PERSONA_MODELS as readonly string[]).includes(input.personaModel)) {
    return `unsupported personaModel '${input.personaModel}' (expected one of ${PERSONA_MODELS.join(', ')})`;
  }
  return null;
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
    // kie.ai requires callBackUrl (422 without it) even though we poll record-info instead
    callBackUrl: 'https://song-auto.anugooltippon.workers.dev/api/health',
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

export interface CreatePersonaInput {
  taskId: string;
  audioId: string;
  name: string;
  description: string;
}

/**
 * POST /api/v1/generate/generate-persona — returns kie's personaId.
 * Throws on any failure (caller decides HTTP mapping), same contract as kieGenerate.
 */
export async function kieCreatePersona(env: Env, input: CreatePersonaInput): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/generate/generate-persona`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify(input),
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
