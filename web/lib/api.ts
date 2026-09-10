export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Fetch wrapper — throws ApiError on non-2xx. 401 surfaces as err.status===401 for AuthGate. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      msg = body.error ?? msg;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export interface Song {
  id: string;
  taskId: string;
  title: string;
  prompt: string;
  style: string;
  tags: string;
  model: string;
  instrumental: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  error: string | null;
  r2Key: string | null;
  imageKey: string | null;
  duration: number | null;
  createdAt: string;
  sunoId: string | null;
  variant: number;
  parentSongId: string | null;
  continueAt: number | null;
}

export interface Persona {
  id: string;
  personaId: string;
  name: string;
  description: string;
  songId: string;
  createdAt: string;
}

const r2Url = (key: string | null): string | null => (key ? `/audio/${key}` : null);

export const songAudioUrl = (s: Song): string | null => r2Url(s.r2Key);

export const songCoverUrl = (s: Song): string | null => r2Url(s.imageKey);

export const fmtDuration = (sec: number | null): string => {
  if (sec === null || Number.isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const MODELS = ['V3_5', 'V4', 'V4_5', 'V4_5PLUS', 'V4_5ALL', 'V5'] as const;

export interface GenerateBody {
  prompt?: string;
  style?: string;
  title?: string;
  instrumental: boolean;
  model: string;
  negativeTags?: string;
  personaId?: string;
  personaModel?: 'style_persona' | 'voice_persona';
  vocalGender?: 'm' | 'f';
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
}

export const LYRICS_PROMPT_MAX = 200;
export const PERSONA_SEGMENT_MIN = 10;
export const PERSONA_SEGMENT_MAX = 30;

export interface LyricsVariant {
  title: string;
  text: string;
}

export type LyricsPollResult =
  | { status: 'PENDING'; transient?: boolean }
  | { status: 'SUCCESS'; variants: LyricsVariant[] }
  | { status: 'FAILED'; error: string };

export interface ExtendBody {
  defaultParamFlag: boolean;
  continueAt?: number;
  prompt?: string;
  style?: string;
  title?: string;
  negativeTags?: string;
  personaId?: string;
  personaModel?: 'style_persona' | 'voice_persona';
}

export const extendSong = (songId: string, body: ExtendBody) =>
  api<{ songs: Song[] }>(`/api/songs/${encodeURIComponent(songId)}/extend`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const startLyrics = (prompt: string) =>
  api<{ taskId: string }>('/api/lyrics', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });

export const pollLyrics = (taskId: string) =>
  api<LyricsPollResult>(`/api/lyrics/${encodeURIComponent(taskId)}`);

/** ช่วงตั้งต้นที่ให้ kie วิเคราะห์เสียง — เพลงสั้นกว่า 30 วินาทีใช้ทั้งเพลง */
export const defaultPersonaWindow = (duration: number | null): { start: number; end: number } => {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    return { start: 0, end: PERSONA_SEGMENT_MAX };
  }
  return { start: 0, end: Math.min(PERSONA_SEGMENT_MAX, duration) };
};

const finished = (s: Song): boolean => s.status === 'SUCCESS' && Boolean(s.sunoId);

export const canExtend = (s: Song): boolean => finished(s);

export const canPersona = (s: Song): boolean => finished(s) && s.model !== 'V3_5';

/**
 * เหตุผลที่ทำ persona ไม่ได้ — คืน null ถ้าทำได้
 * ปุ่มต้องขึ้นแบบกดไม่ได้พร้อมข้อความนี้ ไม่ใช่หายไปเฉย ๆ อย่างที่เคยเป็น
 */
export const personaBlockReason = (s: Song): string | null => {
  if (s.status === 'FAILED') return 'เพลงนี้สร้างไม่สำเร็จ ทำ persona ไม่ได้';
  if (s.status !== 'SUCCESS') return 'รอเพลงสร้างเสร็จก่อน';
  if (!s.sunoId) return 'เพลงนี้สร้างก่อนระบบเก็บรหัสแทร็ก จึงทำ persona ไม่ได้';
  if (s.model === 'V3_5') return 'เพลงโมเดล V3_5 ทำ persona ไม่ได้';
  return null;
};

/** เหตุผลที่ต่อเพลงไม่ได้ — คืน null ถ้าทำได้ */
export const extendBlockReason = (s: Song): string | null => {
  if (s.status === 'FAILED') return 'เพลงนี้สร้างไม่สำเร็จ ต่อเพลงไม่ได้';
  if (s.status !== 'SUCCESS') return 'รอเพลงสร้างเสร็จก่อน';
  if (!s.sunoId) return 'เพลงนี้สร้างก่อนระบบเก็บรหัสแทร็ก จึงต่อเพลงไม่ได้';
  return null;
};
