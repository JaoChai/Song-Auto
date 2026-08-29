import { vi } from 'vitest';
import type { Env } from '../src/worker/types';

// --- fakes ---------------------------------------------------------------

export interface Row extends Record<string, unknown> {
  id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export interface PersonaRowRaw extends Record<string, unknown> {
  id: string;
  persona_id: string;
}

export const lastSql = { value: '' };

/**
 * Fake D1 that actually parses the SQL the routes use:
 * - INSERT INTO songs (...) VALUES (?, ..., ?)   → 13 binds, id first
 * - SELECT * FROM songs WHERE id = ?             → 1 bind
 * - UPDATE songs SET status='FAILED', error=?    → 2 binds (error, id)
 * - UPDATE songs SET status='SUCCESS', ...       → 5 binds (r2Key, imageKey, tags, duration, id)
 * - SELECT * FROM songs ORDER BY created_at DESC → 0 binds, all()
 */
const makeDb = (rows: Row[] = []) => {
  const data: Row[] = [...rows];
  const personas: PersonaRowRaw[] = [];
  const find = (id: string) => data.find((r) => r.id === id);

  const db = {
    prepare(sql: string) {
      lastSql.value = sql;
      const S = sql.toUpperCase();
      const isInsert = S.includes('INSERT INTO');
      const isDelete = S.startsWith('DELETE');
      const isSelectById = S.startsWith('SELECT') && S.includes('WHERE ID = ?');
      const isList = S.startsWith('SELECT') && !S.includes('WHERE');
      const isFailedUpdate = S.includes("SET STATUS = 'FAILED'");
      const isPersonas = S.includes('PERSONAS');

      return {
        bind(...args: unknown[]) {
          return {
            all: async () => ({ results: isPersonas ? personas.slice() : data.slice() }),
            first: async () => find(args[0] as string) ?? null,
            run: async () => {
              if (isPersonas) {
                // INSERT INTO personas (id, persona_id, name, description, song_id, created_at)
                const [id, persona_id, name, description, song_id, created_at] = args as never[];
                personas.push({ id, persona_id, name, description, song_id, created_at } as unknown as PersonaRowRaw);
                return { success: true };
              }
              if (isInsert) {
                // (id, task_id, title, prompt, style, tags, model, instrumental, created_at, variant)
                const [id, task_id, title, prompt, style, tags, model, instrumental, created_at, variant] = args as never[];
                data.push({
                  id, task_id, title, prompt, style, tags, model,
                  instrumental: Number(instrumental), status: 'PENDING',
                  error: null, r2_key: null, image_key: null, duration: null,
                  created_at, variant: Number(variant), suno_id: null,
                } as unknown as Row);
                return { success: true };
              }
              if (isDelete) {
                const [id] = args as [string];
                const i = data.findIndex((r) => r.id === id);
                if (i >= 0) data.splice(i, 1);
                return { success: true };
              }
              if (isFailedUpdate) {
                const [error, id] = args as [string, string];
                Object.assign(find(id)!, { status: 'FAILED', error });
                return { success: true };
              }
              // SUCCESS update: (r2Key, imageKey, tags, duration, [sunoId,] id)
              // suno_id เข้ามาใน UPDATE ตอน Task 4 — อ่านจาก SQL ไม่ใช่จำนวน args
              const hasSunoId = S.includes('SUNO_ID = ?');
              const [r2_key, image_key, tags, duration] =
                args as [string, string | null, string | null, number | null];
              const rowId = args[hasSunoId ? 5 : 4] as string;
              Object.assign(find(rowId)!, {
                status: 'SUCCESS', r2_key, image_key, tags, duration, error: null,
                ...(hasSunoId ? { suno_id: args[4] as string } : {}),
              });
              return { success: true };
            },
          };
        },
        all: async () => ({ results: isPersonas ? personas.slice() : data.slice() }),
        first: async () => null,
        run: async () => {
          void isInsert; void isDelete; void isSelectById; void isList;
          return { success: true };
        },
      };
    },
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  } as unknown as Env['DB'];
  return { db, data, personas };
};

const makeR2 = () => {
  const store = new Map<string, Uint8Array>();
  const bucket = {
    put: vi.fn(async (key: string, body: unknown) => {
      store.set(key, body as Uint8Array);
      return { key };
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    keys: () => [...store.keys()],
  } as unknown as Env['AUDIO'];
  return { bucket, store };
};

export const makeEnv = (rows: Row[] = []) => {
  const { db, data, personas } = makeDb(rows);
  const { bucket, store } = makeR2();
  const env: Env = { DB: db, AUDIO: bucket, KIE_API_KEY: 'test-key', APP_PASSWORD: 'pw' };
  return { env, data, personas, bucket, store };
};
