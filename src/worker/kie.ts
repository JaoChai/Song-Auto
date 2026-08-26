import type { Env } from './types';

const BASE_URL = 'https://api.kie.ai';
const KIE_MODELS = ['V3_5', 'V4', 'V4_5', 'V4_5PLUS', 'V4_5ALL', 'V5'] as const;

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
}

const KIE_FAILED_STATUSES = [
  'CREATE_TASK_FAILED',
  'GENERATE_AUDIO_FAILED',
  'CALLBACK_EXCEPTION',
  'SENSITIVE_WORD_ERROR',
] as const;

export function validateGenerate(input: GenerateInput): string | null {
  if (!input.prompt || !input.prompt.trim()) return 'prompt is required';
  const custom = Boolean(input.style || input.title);
  const promptLimit = custom ? PROMPT_LIMIT_CUSTOM : PROMPT_LIMIT_SIMPLE;
  if (input.prompt.length > promptLimit) {
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
    prompt: input.prompt,
    customMode: custom,
    instrumental: input.instrumental,
    model: input.model,
  };
  if (custom) {
    if (input.style) body.style = input.style;
    if (input.title) body.title = input.title;
  }
  if (input.negativeTags) body.negativeTags = input.negativeTags;

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
  | { kind: 'PENDING' }
  | { kind: 'FAILED'; error: string }
  | { kind: 'TRANSIENT'; note: string };

export interface TrackInfo {
  audioUrl: string;
  duration: number | null;
  tags: string | null;
}

/**
 * GET /api/v1/generate/record-info — the single source of kie status mapping.
 * PENDING/TEXT_SUCCESS/FIRST_SUCCESS → PENDING; SUCCESS → PENDING + track from
 * first sunoData item; the four FAILED enums → FAILED with errorMessage;
 * non-200 envelope or network throw → TRANSIENT (safe to retry).
 */
export async function kiePollTask(env: Env, taskId: string): Promise<KiePoll & { track?: TrackInfo }> {
  let data: {
    status?: string;
    errorMessage?: string;
    response?: { sunoData?: Array<Partial<TrackInfo> & { id?: string }> };
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
  if (status === 'PENDING' || status === 'TEXT_SUCCESS' || status === 'FIRST_SUCCESS') {
    return { kind: 'PENDING' };
  }
  if (status && (KIE_FAILED_STATUSES as readonly string[]).includes(status)) {
    return { kind: 'FAILED', error: data?.errorMessage || `kie task ${status}` };
  }
  if (status === 'SUCCESS') {
    const first = data?.response?.sunoData?.[0];
    const track: TrackInfo = {
      audioUrl: first?.audioUrl ?? '',
      duration: typeof first?.duration === 'number' ? first.duration : null,
      tags: typeof first?.tags === 'string' ? first.tags : null,
    };
    return { kind: 'PENDING', track };
  }
  return { kind: 'TRANSIENT', note: `kie poll: unexpected status '${String(status)}'` };
}
