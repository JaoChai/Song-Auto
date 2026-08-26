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
  duration: number | null;
  createdAt: string;
}

export const songAudioUrl = (s: Song): string | null => (s.r2Key ? `/audio/${s.r2Key}` : null);

export const fmtDuration = (sec: number | null): string => {
  if (sec === null || Number.isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const MODELS = ['V3_5', 'V4', 'V4_5', 'V4_5PLUS', 'V4_5ALL', 'V5'] as const;

export interface GenerateBody {
  prompt: string;
  style?: string;
  title?: string;
  instrumental: boolean;
  model: string;
  negativeTags?: string;
}
