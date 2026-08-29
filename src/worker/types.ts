export type Env = {
  DB: D1Database;
  AUDIO: R2Bucket;
  KIE_API_KEY: string;
  APP_PASSWORD: string;
};

export type SongStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export interface SongRow {
  id: string; taskId: string; title: string; prompt: string; style: string;
  tags: string; model: string; instrumental: number; status: SongStatus;
  error: string | null; r2Key: string | null; imageKey: string | null; duration: number | null; createdAt: string;
  sunoId: string | null; variant: number;
}

export interface PersonaRow {
  id: string;
  personaId: string;
  name: string;
  description: string;
  songId: string;
  createdAt: string;
}
