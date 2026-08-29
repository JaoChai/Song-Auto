# Two Variants per Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หนึ่งครั้งที่กดสร้าง = 2 การ์ดในคลัง แต่ละใบผูกกับแทร็กของตัวเองใน `sunoData[]` การ์ดไหนเสร็จก่อนเล่นได้ก่อน และเก็บ `suno_id` ไว้ให้สเปก persona ใช้ต่อ

**Architecture:** แต่ละแถวใน `songs` ถือ `variant` (1 หรือ 2) ของตัวเอง เวลา poll จะหยิบ `sunoData[variant - 1]` — ตรรกะ "แถวไหนเอาแทร็กไหน" อยู่ที่ `getTask` ที่เดียว ส่วน `kiePollTask` แค่ส่งอาเรย์ดิบกลับมาพร้อมธงว่างานจบหรือยัง แถวที่งานจบแล้วแต่ไม่มีแทร็กของตัวเองจะถูกลบทิ้งและตอบ `GONE` ให้หน้าเว็บเอาการ์ดออก

**Tech Stack:** Cloudflare Workers + Hono + D1 + R2 · React 19 + TypeScript strict · vitest (environment: node) · ไม่เพิ่ม dependency ใหม่

**Spec:** `docs/superpowers/specs/2026-08-29-two-variants-per-generation-design.md`

## Global Constraints

- ไม่เพิ่ม dependency ใหม่ใน `package.json`
- `tsconfig.json` เปิด `strict`, `noUnusedLocals`, `noUnusedParameters` — import หรือตัวแปรที่ไม่ได้ใช้ทำให้ `npm run typecheck` ล้ม
- vitest: `environment: 'node'`, `include: ['tests/**/*.test.ts']`
- ห้ามแตะฟอร์ม (`CreatePanel` แก้เฉพาะการรับผลลัพธ์ ไม่แตะช่องกรอก), ห้ามเพิ่มตัวเลือกโมเดล, ห้ามเพิ่ม simple mode — อยู่นอกขอบเขตสเปกนี้
- ห้ามแตะ persona — เป็นสเปกถัดไป สเปกนี้แค่ **เก็บ** `suno_id` ไว้ให้
- `POST /api/generate` ยังส่ง body ชุดเดิมไป kie.ai ทุกฟิลด์ (เรียก kie **ครั้งเดียว** ต่อการกดสร้างหนึ่งครั้ง — Suno ทำ 2 แทร็กให้เองจากงานเดียว ห้ามยิงสองครั้ง)
- ข้อความ UI ภาษาไทย ยกเว้นป้าย `v1`/`v2`
- migration ใหม่ต้องรันได้กับฐานที่มีข้อมูลอยู่แล้ว (ห้าม DROP/RECREATE)

---

## File Structure

| ไฟล์ | หน้าที่ | สถานะ |
|------|---------|-------|
| `migrations/0003_add_variant_and_suno_id.sql` | เพิ่ม `suno_id`, `variant`, unique index | สร้างใหม่ |
| `src/worker/types.ts` | `SongRow` += `sunoId`, `variant` | แก้ |
| `src/worker/kie.ts` | `TrackInfo` += `sunoId` · `KiePoll` คืน `tracks[]` + `complete` | แก้ |
| `src/worker/routes.ts` | `createSong` insert 2 แถว · `getTask` เลือกแทร็กตาม variant + ยุบแถว | แก้ |
| `tests/api.test.ts` | D1 ปลอมรองรับคอลัมน์ใหม่ + `DELETE` · เทสต์ใหม่ | แก้ |
| `tests/kie.test.ts` | เทสต์ที่อ้าง `res.track` → `res.tracks` | แก้ |
| `web/lib/api.ts` | `Song` += `variant`, `sunoId` | แก้ |
| `web/hooks/useSongs.ts` | `upsert` รับหลายตัว · `remove` · จัดการ `GONE` | แก้ |
| `web/components/CreatePanel.tsx` | `onCreated(songs)` ใช้แถวจากเซิร์ฟเวอร์ | แก้ |
| `web/App.tsx` | upsert 2 แถว | แก้ |
| `web/components/LibraryGrid.tsx` | retry: remove + upsert 2 · ส่ง `showVariant` | แก้ |
| `web/components/SongCard.tsx` | ป้าย v1/v2 | แก้ |

**บั๊กที่มีอยู่เดิมและจะถูกแก้ไปด้วยใน Task 1:** D1 ปลอมใน `tests/api.test.ts` destructure ค่าที่ bind ผิดตำแหน่ง — `INSERT` ผูก 9 ค่า แต่ fake อ่าน `created_at` จาก index 12 ทำให้แถวที่ insert ผ่าน fake มี `created_at` เป็น `undefined` ไม่มีเทสต์ไหนจับ เพราะเทสต์ที่ตรวจ `createdAt` ใช้ `rowFixture` ไม่ได้ผ่าน INSERT (สเปกเขียนว่า "13 binds" — ตัวเลขนั้นคลาดเคลื่อน ของจริงคือ 9 ค่าที่ bind กับ destructure ยาว 13 ช่อง)

---

### Task 1: schema + ชนิดข้อมูล (ยังไม่เปลี่ยนพฤติกรรม)

**Files:**
- Create: `migrations/0003_add_variant_and_suno_id.sql`
- Modify: `src/worker/types.ts`
- Modify: `src/worker/routes.ts` (`toSongRow`, SQL ของ `createSong`)
- Modify: `tests/api.test.ts` (D1 ปลอม + `rowFixture`)

**Interfaces:**
- Consumes: ไม่มี (task แรก)
- Produces:
  - `SongRow` มี `sunoId: string | null` และ `variant: number`
  - `INSERT INTO songs` ผูก 10 ค่า เรียงเป็น `(id, task_id, title, prompt, style, tags, model, instrumental, created_at, variant)`

- [ ] **Step 1: เขียน migration**

สร้าง `migrations/0003_add_variant_and_suno_id.sql`:

```sql
ALTER TABLE songs ADD COLUMN suno_id TEXT;
ALTER TABLE songs ADD COLUMN variant INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_task_variant ON songs (task_id, variant);
```

- [ ] **Step 2: ขยาย `SongRow`**

เปิด `src/worker/types.ts` แทนที่ interface `SongRow` ทั้งก้อนด้วย:

```ts
export interface SongRow {
  id: string; taskId: string; title: string; prompt: string; style: string;
  tags: string; model: string; instrumental: number; status: SongStatus;
  error: string | null; r2Key: string | null; imageKey: string | null; duration: number | null; createdAt: string;
  sunoId: string | null; variant: number;
}
```

- [ ] **Step 3: `toSongRow` อ่านคอลัมน์ใหม่**

เปิด `src/worker/routes.ts` ในฟังก์ชัน `toSongRow` เพิ่ม 2 บรรทัดก่อนปิดวงเล็บ (ต่อจาก `createdAt`):

```ts
  createdAt: r.created_at as string,
  sunoId: (r.suno_id as string | null) ?? null,
  variant: Number(r.variant ?? 1),
});
```

- [ ] **Step 4: INSERT เขียน variant ลงไปด้วย**

ใน `createSong` แทนที่บล็อก `try { await ctx.env.DB.prepare(...)...}` ทั้งก้อนด้วย:

```ts
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO songs (id, task_id, title, prompt, style, tags, model, instrumental, status, error, r2_key, duration, created_at, variant)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, NULL, NULL, ?, ?)`,
    ).bind(id, taskId, body.title ?? '', body.prompt ?? '', body.style ?? '', '', body.model, body.instrumental ? 1 : 0, createdAt, 1).run();
  } catch (e) {
    return c(ctx).json({ error: `failed to insert song row: ${err(e)}` }, 500);
  }
```

(ยังคง insert แถวเดียว `variant = 1` — Task 3 จะทำให้เป็นสองแถว)

- [ ] **Step 5: D1 ปลอมรองรับคอลัมน์ใหม่ + `DELETE`**

เปิด `tests/api.test.ts` แทนที่ฟังก์ชัน `makeDb` ทั้งก้อน (ตั้งแต่ `const makeDb =` จนถึง `return { db, data };\n};`) ด้วย:

```ts
const makeDb = (rows: Row[] = []) => {
  const data: Row[] = [...rows];
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

      return {
        bind(...args: unknown[]) {
          return {
            all: async () => ({ results: data.slice() }),
            first: async () => find(args[0] as string) ?? null,
            run: async () => {
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
              // SUCCESS update: (r2Key, imageKey, tags, duration, sunoId, id)
              const [r2_key, image_key, tags, duration, suno_id, id] =
                args as [string, string | null, string | null, number | null, string, string];
              Object.assign(find(id)!, { status: 'SUCCESS', r2_key, image_key, tags, duration, suno_id, error: null });
              return { success: true };
            },
          };
        },
        all: async () => ({ results: data.slice() }),
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
  return { db, data };
};
```

หมายเหตุ: `batch` เพิ่มไว้ล่วงหน้าให้ Task 3 ใช้ · การ destructure INSERT ที่แก้ใหม่ทำให้ `created_at` ที่เคยเป็น `undefined` มีค่าถูกต้อง

- [ ] **Step 6: `rowFixture` มี variant**

ใน `tests/api.test.ts` แทนที่ `rowFixture` ด้วย:

```ts
const rowFixture = (id: string, taskId: string, createdAt: string, variant = 1): Row => ({
  id, task_id: taskId, title: 't', prompt: 'p', style: 's', tags: '', model: 'V4_5',
  instrumental: 0, status: 'PENDING', error: null, r2_key: null, image_key: null,
  duration: null, created_at: createdAt, variant, suno_id: null,
});
```

- [ ] **Step 7: รันเทสต์ทั้งหมด**

รัน: `npm test`
คาดหวัง: PASS ทั้งหมด (พฤติกรรมยังไม่เปลี่ยน แค่มีคอลัมน์เพิ่ม)

- [ ] **Step 8: typecheck**

รัน: `npm run typecheck`
คาดหวัง: ไม่มี error

- [ ] **Step 9: Commit**

```bash
git add migrations/0003_add_variant_and_suno_id.sql src/worker/types.ts src/worker/routes.ts tests/api.test.ts
git commit -m "feat(db): add variant and suno_id columns"
```

---

### Task 2: `kiePollTask` คืนทุกแทร็ก

**Files:**
- Modify: `src/worker/kie.ts` (`TrackInfo`, `KiePoll`, `kiePollTask`)
- Modify: `src/worker/routes.ts` (`getTask` — ปรับให้เข้ากับสัญญาใหม่แบบชั่วคราว)
- Modify: `tests/kie.test.ts`

**Interfaces:**
- Consumes: `SongRow` จาก Task 1
- Produces:
  - `interface TrackInfo { sunoId: string; audioUrl: string; duration: number | null; tags: string | null; imageUrl: string | null }`
  - `type KiePoll = { kind: 'PENDING'; tracks: TrackInfo[]; complete: boolean } | { kind: 'FAILED'; error: string } | { kind: 'TRANSIENT'; note: string }`
  - `kiePollTask(env, taskId): Promise<KiePoll>` — ไม่มี `track` เดี่ยวอีกต่อไป

- [ ] **Step 1: แก้เทสต์ให้สะท้อนสัญญาใหม่ (เทสต์ก่อน)**

เปิด `tests/kie.test.ts` แทนที่เทสต์ 2 ตัวนี้ (`SUCCESS extracts first sunoData track…` และ `SUCCESS result carries track from sunoData[0]`) ด้วยชุดใหม่:

```ts
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
```

จากนั้นในเทสต์ `kiePollTask cover art` เปลี่ยน 2 บรรทัดสุดท้ายของแต่ละเคส:
- `expect(res.track?.imageUrl).toBe('https://x/a.jpg');` → `expect(res.kind === 'PENDING' && res.tracks[0].imageUrl).toBe('https://x/a.jpg');`
- `expect(res.track?.imageUrl).toBeNull();` → `expect(res.kind === 'PENDING' && res.tracks[0].imageUrl).toBeNull();`

- [ ] **Step 2: รันเทสต์ ให้เห็นว่าล้มเหลว**

รัน: `npx vitest run tests/kie.test.ts`
คาดหวัง: FAIL — `res.tracks` ยังไม่มี (`complete` ไม่มี)

- [ ] **Step 3: เขียน `kiePollTask` ใหม่**

เปิด `src/worker/kie.ts` แทนที่ตั้งแต่ `export type KiePoll =` จนจบไฟล์ ด้วย:

```ts
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
```

- [ ] **Step 4: ให้ `getTask` เข้ากับสัญญาใหม่ (ชั่วคราว — Task 4 จะเขียนใหม่ทั้งฟังก์ชัน)**

เปิด `src/worker/routes.ts` ใน `getTask` แทนที่บรรทัด

```ts
  // SUCCESS signal: kiePollTask returns kind PENDING with a track attached.
  if (poll.track) {
    const { audioUrl, duration, tags, imageUrl } = poll.track;
```

ด้วย

```ts
  // SUCCESS signal: kiePollTask returns kind PENDING carrying the tracks so far.
  const firstTrack = poll.kind === 'PENDING' ? poll.tracks[0] : undefined;
  if (firstTrack) {
    const { audioUrl, duration, tags, imageUrl } = firstTrack;
```

- [ ] **Step 5: รันเทสต์ทั้งหมด**

รัน: `npm test`
คาดหวัง: PASS ทั้งหมด

- [ ] **Step 6: typecheck**

รัน: `npm run typecheck`
คาดหวัง: ไม่มี error

- [ ] **Step 7: Commit**

```bash
git add src/worker/kie.ts src/worker/routes.ts tests/kie.test.ts
git commit -m "feat(worker): kiePollTask returns every track with its suno id"
```

---

### Task 3: กดสร้างหนึ่งครั้ง = 2 แถว

**Files:**
- Modify: `src/worker/routes.ts` (`createSong`)
- Modify: `tests/api.test.ts` (เทสต์เดิม 2 ตัวที่คาดหวังแถวเดียว + เทสต์ใหม่)

**Interfaces:**
- Consumes: `SongRow` (Task 1)
- Produces: `POST /api/generate` ตอบ `201 { songs: SongRow[] }` — อาเรย์ 2 ก้อน เรียงตาม `variant` 1 แล้ว 2 (ฟิลด์ `id`/`status` เดี่ยวแบบเดิมหายไป)

- [ ] **Step 1: แก้เทสต์เดิมให้คาดหวังสองแถว แล้วเพิ่มเทสต์ใหม่**

ใน `tests/api.test.ts` แทนที่เทสต์ `POST /api/generate: 201 happy path — inserts PENDING row and returns {id, status}` ทั้งก้อนด้วย:

```ts
  it('POST /api/generate: 201 happy path — inserts two PENDING rows (variant 1 and 2) and returns both', async () => {
    const { env, data } = makeEnv();
    const cookie = await cookieFor('pw');
    const { mock } = stubKieAndMp3({ taskId: 't', status: 'PENDING', response: { sunoData: [] } });
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseInput }),
    }, env);
    expect(res.status).toBe(201);
    const body = await res.json() as { songs: SongRow[] };
    expect(body.songs).toHaveLength(2);
    expect(body.songs.map((s) => s.variant)).toEqual([1, 2]);
    expect(body.songs[0].status).toBe('PENDING');
    expect(body.songs[0].id).not.toBe(body.songs[1].id);
    // both rows share the one kie task
    expect(data).toHaveLength(2);
    expect(data.map((r) => r.task_id)).toEqual(['task-1', 'task-1']);
    // kie create hit exactly once — Suno makes both tracks from a single job
    expect(mock).toHaveBeenCalledTimes(1);
    expect(String(mock.mock.calls[0][0])).toBe('https://api.kie.ai/api/v1/generate');
    expect(lastSql.value).toMatch(/INSERT INTO songs/i);
  });
```

แล้วแทนที่เทสต์ `POST /api/generate: instrumental custom-mode request with no prompt key…` ด้วย:

```ts
  it('POST /api/generate: instrumental custom-mode request with no prompt key at all still inserts rows (prompt defaults to empty string, not undefined)', async () => {
    const { env, data } = makeEnv();
    const cookie = await cookieFor('pw');
    stubKieAndMp3({ taskId: 't', status: 'PENDING', response: { sunoData: [] } });
    const { prompt: _omit, ...noPrompt } = { ...baseInput, style: 'lo-fi', title: 'Rain' };
    void _omit;
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(noPrompt),
    }, env);
    expect(res.status).toBe(201);
    expect(data).toHaveLength(2);
    expect(data[0].prompt).toBe('');
    expect(data[1].prompt).toBe('');
  });
```

ในเทสต์ `validation error → 400` และ `kie create failure (envelope 402) → 502` ทั้งสองตัวใช้ `expect(data).toHaveLength(0)` อยู่แล้ว — ปล่อยไว้ตามเดิม

- [ ] **Step 2: รันเทสต์ ให้เห็นว่าล้มเหลว**

รัน: `npx vitest run tests/api.test.ts`
คาดหวัง: FAIL — ได้ 1 แถว ไม่ใช่ 2 และ response ไม่มี `songs`

- [ ] **Step 3: เขียน `createSong` ใหม่**

เปิด `src/worker/routes.ts` แทนที่ฟังก์ชัน `createSong` ทั้งก้อนด้วย:

```ts
const VARIANTS = [1, 2] as const;

/** POST /api/generate — one kie job, two PENDING rows (Suno returns two tracks per task). */
export async function createSong(ctx: Context<{ Bindings: Env }>) {
  let body: GenerateInput;
  try {
    body = (await ctx.req.json()) as GenerateInput;
  } catch {
    return c(ctx).json({ error: 'invalid JSON body' }, 400);
  }
  const validation = validateGenerate(body);
  if (validation) return c(ctx).json({ error: validation }, 400);

  let taskId: string;
  try {
    taskId = await kieGenerate(ctx.env, body);
  } catch (e) {
    return c(ctx).json({ error: err(e) }, 502);
  }

  const createdAt = new Date().toISOString();
  const rows = VARIANTS.map((variant) => ({
    id: nanoid(),
    task_id: taskId,
    title: body.title ?? '',
    prompt: body.prompt ?? '',
    style: body.style ?? '',
    tags: '',
    model: body.model,
    instrumental: body.instrumental ? 1 : 0,
    status: 'PENDING' as const,
    error: null,
    r2_key: null,
    image_key: null,
    duration: null,
    created_at: createdAt,
    suno_id: null,
    variant,
  }));

  try {
    await ctx.env.DB.batch(
      rows.map((r) =>
        ctx.env.DB.prepare(
          `INSERT INTO songs (id, task_id, title, prompt, style, tags, model, instrumental, status, error, r2_key, duration, created_at, variant)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, NULL, NULL, ?, ?)`,
        ).bind(r.id, r.task_id, r.title, r.prompt, r.style, r.tags, r.model, r.instrumental, r.created_at, r.variant),
      ),
    );
  } catch (e) {
    return c(ctx).json({ error: `failed to insert song rows: ${err(e)}` }, 500);
  }

  return c(ctx).json({ songs: rows.map(toSongRow) }, 201);
}
```

- [ ] **Step 4: รันเทสต์ทั้งหมด**

รัน: `npm test`
คาดหวัง: PASS ทั้งหมด — ถ้า `env.DB.batch is not a function` แปลว่า D1 ปลอมใน Task 1 Step 5 ยังไม่มี `batch`

- [ ] **Step 5: typecheck**

รัน: `npm run typecheck`
คาดหวัง: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/worker/routes.ts tests/api.test.ts
git commit -m "feat(worker): one generate request creates both variant rows"
```

---

### Task 4: แต่ละแถวเก็บแทร็กของตัวเอง + ยุบแถวที่ไม่ได้ใช้

**Files:**
- Modify: `src/worker/routes.ts` (`getTask`)
- Modify: `tests/api.test.ts` (เทสต์ใหม่ 6 เคส)

**Interfaces:**
- Consumes: `KiePoll` (Task 2), แถวที่มี `variant` (Task 1/3)
- Produces: `GET /api/tasks/:id` ตอบได้ 4 แบบ
  - `{ status: 'SUCCESS', song: SongRow }`
  - `{ status: 'FAILED', error: string }`
  - `{ status: 'PENDING' }` หรือ `{ status: 'PENDING', transient: true }`
  - `{ status: 'GONE' }` — แถวถูกลบแล้ว หน้าเว็บต้องเอาการ์ดออก (HTTP 200 เสมอ)

- [ ] **Step 1: เขียนเทสต์ที่ยังล้มเหลว**

ใน `tests/api.test.ts` เพิ่มเทสต์ต่อไปนี้ก่อนปิด `describe('API routes', …)`:

```ts
  it('GET /api/tasks/:id: FIRST_SUCCESS — v1 finishes, v2 keeps waiting', async () => {
    const { env, data, store } = makeEnv([
      rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      rowFixture('s2', 'task-1', '2026-08-26T00:00:00.000Z', 2),
    ]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({
      taskId: 'task-1',
      status: 'FIRST_SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 100, tags: 'calm' }] },
    });

    const first = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect((await first.json() as { status: string }).status).toBe('SUCCESS');
    expect(store.get('s1.mp3')).toBeInstanceOf(Uint8Array);

    const second = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    expect(await second.json()).toEqual({ status: 'PENDING' });
    expect(data.find((r) => r.id === 's2')!.status).toBe('PENDING');
  });

  it('GET /api/tasks/:id: SUCCESS with two tracks — each row takes its own, storing distinct suno ids', async () => {
    const { env, data, store } = makeEnv([
      rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      rowFixture('s2', 'task-1', '2026-08-26T00:00:00.000Z', 2),
    ]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({
      taskId: 'task-1',
      status: 'SUCCESS',
      response: {
        sunoData: [
          { id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 100, tags: 'calm' },
          { id: 'a2', audioUrl: 'https://cdn/2.mp3', duration: 101, tags: 'warm' },
        ],
      },
    });

    const r1 = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    const r2 = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    const b1 = await r1.json() as { status: string; song: SongRow };
    const b2 = await r2.json() as { status: string; song: SongRow };

    expect(b1.song.sunoId).toBe('a1');
    expect(b2.song.sunoId).toBe('a2');
    expect(b1.song.tags).toBe('calm');
    expect(b2.song.tags).toBe('warm');
    expect(store.get('s1.mp3')).toBeInstanceOf(Uint8Array);
    expect(store.get('s2.mp3')).toBeInstanceOf(Uint8Array);
    expect(data).toHaveLength(2);
  });

  it('GET /api/tasks/:id: SUCCESS with only one track — the spare row is deleted and reported GONE', async () => {
    const { env, data } = makeEnv([
      rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      rowFixture('s2', 'task-1', '2026-08-26T00:00:00.000Z', 2),
    ]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({
      taskId: 'task-1',
      status: 'SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 100, tags: 'calm' }] },
    });

    const res = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'GONE' });
    expect(data.map((r) => r.id)).toEqual(['s1']);
  });

  it('GET /api/tasks/:id: FAILED — v1 records the error, v2 is deleted', async () => {
    const { env, data } = makeEnv([
      rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      rowFixture('s2', 'task-1', '2026-08-26T00:00:00.000Z', 2),
    ]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({ taskId: 'task-1', status: 'GENERATE_AUDIO_FAILED', errorMessage: 'engine died' });

    const r2 = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    expect(await r2.json()).toEqual({ status: 'GONE' });

    const r1 = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    expect(await r1.json()).toEqual({ status: 'FAILED', error: 'engine died' });

    expect(data.map((r) => r.id)).toEqual(['s1']);
    expect(data[0].status).toBe('FAILED');
  });

  it('GET /api/tasks/:id: polling an already-finished row downloads nothing and does not call kie', async () => {
    const { env } = makeEnv([{
      ...rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z', 1),
      status: 'SUCCESS', r2_key: 's1.mp3', suno_id: 'a1',
    } as Row]);
    const cookie = await cookieFor('pw');
    const { mock } = stubKieAndMp3({ taskId: 'task-1', status: 'SUCCESS', response: { sunoData: [] } });

    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    const body = await res.json() as { status: string; song: SongRow };
    expect(body.status).toBe('SUCCESS');
    expect(body.song.r2Key).toBe('s1.mp3');
    expect(mock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: รันเทสต์ ให้เห็นว่าล้มเหลว**

รัน: `npx vitest run tests/api.test.ts`
คาดหวัง: FAIL — แถว v2 ยังไปหยิบ `tracks[0]` และยังไม่มีสถานะ `GONE`

- [ ] **Step 3: เขียน `getTask` ใหม่ทั้งฟังก์ชัน**

เปิด `src/worker/routes.ts` แทนที่ `getTask` ทั้งก้อน (ตั้งแต่คอมเมนต์ `/** GET /api/tasks/:id …` จนถึงวงเล็บปิดของฟังก์ชัน) ด้วย:

```ts
/**
 * GET /api/tasks/:id — poll kie once for this row's task, then take the track that belongs to
 * this row (`sunoData[variant - 1]`). A row whose track never arrives — the job finished with
 * fewer tracks, or failed — is deleted and reported as GONE so the card leaves the library.
 */
export async function getTask(ctx: Context<{ Bindings: Env }>) {
  const id = ctx.req.param('id');
  const row = await ctx.env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(id).first<Record<string, unknown> | null>();
  if (!row) return c(ctx).json({ error: `song not found: ${id}` }, 404);

  // already downloaded — never spend a kie call or a download on it twice
  if (row.status === 'SUCCESS' && row.r2_key) {
    return c(ctx).json({ status: 'SUCCESS', song: toSongRow(row) });
  }

  const variant = Number(row.variant ?? 1);
  const drop = async () => {
    await ctx.env.DB.prepare('DELETE FROM songs WHERE id = ?').bind(id).run();
    return c(ctx).json({ status: 'GONE' });
  };

  const poll = await kiePollTask(ctx.env, row.task_id as string);

  if (poll.kind === 'FAILED') {
    // the error belongs on one card, not two
    if (variant > 1) return drop();
    await ctx.env.DB.prepare(`UPDATE songs SET status = 'FAILED', error = ? WHERE id = ?`)
      .bind(poll.error, id).run();
    row.status = 'FAILED';
    row.error = poll.error;
    return c(ctx).json({ status: 'FAILED', error: poll.error });
  }

  if (poll.kind === 'TRANSIENT') {
    // keep PENDING in D1; UI retries later
    return c(ctx).json({ status: 'PENDING', transient: true });
  }

  const track = poll.tracks[variant - 1];
  if (!track || !track.audioUrl) {
    // the job is done and this row's track never came — collapse the placeholder
    if (poll.complete) return drop();
    return c(ctx).json({ status: 'PENDING' });
  }

  const { audioUrl, duration, tags, imageUrl, sunoId } = track;

  let bytes: Uint8Array | null = null;
  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(audioUrl);
      if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`);
      const buf = await res.arrayBuffer();
      bytes = new Uint8Array(buf);
      break;
    } catch {
      if (attempt < MAX_DOWNLOAD_ATTEMPTS) await sleep(250 * attempt);
    }
  }
  if (!bytes) {
    // row stays PENDING so the next poll retries the download
    return c(ctx).json({ status: 'PENDING', transient: true });
  }

  const r2Key = `${id}.mp3`;
  await ctx.env.AUDIO.put(r2Key, bytes, { httpMetadata: { contentType: 'audio/mpeg' } });

  // cover art is best-effort — a failure must not fail the song
  let imageKey: string | null = null;
  if (imageUrl) {
    try {
      const coverRes = await fetch(imageUrl);
      if (coverRes.ok) {
        const coverBytes = new Uint8Array(await coverRes.arrayBuffer());
        await ctx.env.AUDIO.put(`${id}.jpg`, coverBytes, { httpMetadata: { contentType: 'image/jpeg' } });
        imageKey = `${id}.jpg`;
      }
    } catch {
      // a song without cover art is fine
    }
  }

  await ctx.env.DB.prepare(
    `UPDATE songs SET status = 'SUCCESS', r2_key = ?, image_key = ?, tags = ?, duration = ?, suno_id = ?, error = NULL WHERE id = ?`,
  ).bind(r2Key, imageKey, tags ?? '', duration, sunoId, id).run();

  row.status = 'SUCCESS';
  row.r2_key = r2Key;
  row.image_key = imageKey;
  row.tags = tags ?? '';
  row.duration = duration;
  row.suno_id = sunoId;
  row.error = null;
  return c(ctx).json({ status: 'SUCCESS', song: toSongRow(row) });
}
```

- [ ] **Step 4: รันเทสต์ทั้งหมด**

รัน: `npm test`
คาดหวัง: PASS ทั้งหมด — เทสต์เดิม `SUCCESS — downloads mp3…` ยังผ่านเพราะ fixture เดิมเป็น `variant = 1`

- [ ] **Step 5: typecheck**

รัน: `npm run typecheck`
คาดหวัง: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/worker/routes.ts tests/api.test.ts
git commit -m "feat(worker): each row claims its own track, spare rows collapse"
```

---

### Task 5: หน้าเว็บรับสองการ์ด

**Files:**
- Modify: `web/lib/api.ts`
- Modify: `web/hooks/useSongs.ts`
- Modify: `web/components/CreatePanel.tsx`
- Modify: `web/App.tsx`
- Modify: `web/components/LibraryGrid.tsx`
- Modify: `web/components/SongCard.tsx`
- Modify: `web/index.css` (คลาสป้าย)

**Interfaces:**
- Consumes: `POST /api/generate` → `{ songs: Song[] }` (Task 3) · `GET /api/tasks/:id` → อาจได้ `{ status: 'GONE' }` (Task 4)
- Produces:
  - `Song` มี `variant: number` และ `sunoId: string | null`
  - `useSongs()` คืน `{ songs, loaded, authNeeded, refresh, upsert, remove }` — `upsert(song: Song | Song[])`, `remove(id: string)`
  - `CreatePanel` prop `onCreated: (songs: Song[]) => void`
  - `SongCard` prop เพิ่ม `showVariant: boolean`

- [ ] **Step 1: ขยายชนิด `Song`**

เปิด `web/lib/api.ts` ใน `interface Song` เพิ่ม 2 ฟิลด์ต่อจาก `createdAt`:

```ts
  createdAt: string;
  sunoId: string | null;
  variant: number;
}
```

- [ ] **Step 2: `useSongs` รับหลายเพลงและลบการ์ดได้**

เปิด `web/hooks/useSongs.ts`:

(ก) แทนที่ `pollOnePending` ทั้งก้อนด้วย:

```ts
  /** Poll ONE pending song; apply result. Returns true when a poll happened. */
  const pollOnePending = useCallback(async (): Promise<boolean> => {
    let polled = false;
    setSongs((current) => {
      const target = current.find((s) => s.status === 'PENDING');
      if (!target) return current;
      polled = true;
      void api<{ status: string; song?: Song }>('/api/tasks/' + target.id)
        .then((res) => {
          // the server collapsed this row (the task produced fewer tracks, or failed)
          if (res.status === 'GONE') {
            setSongs((prev) => prev.filter((s) => s.id !== target.id));
            return;
          }
          if (res.song || res.status !== 'PENDING') {
            setSongs((prev) =>
              res.song
                ? prev.map((s) => (s.id === res.song!.id ? res.song! : s))
                : prev.map((s) =>
                    s.id === target.id ? { ...s, status: res.status as Song['status'], error: null } : s,
                  ),
            );
          }
        })
        .catch(() => {
          /* transient — next tick retries */
        });
      return current;
    });
    return polled;
  }, []);
```

(ข) แทนที่ `upsert` ทั้งก้อน และเพิ่ม `remove` ต่อท้าย:

```ts
  /** Insert/replace song rows (used by CreatePanel, retry, and poll results). */
  const upsert = useCallback((incoming: Song | Song[]) => {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    setSongs((prev) => {
      const next = [...prev];
      // walk backwards so a batch of new songs keeps its given order at the top
      for (let i = list.length - 1; i >= 0; i--) {
        const song = list[i];
        const idx = next.findIndex((s) => s.id === song.id);
        if (idx >= 0) next[idx] = song;
        else next.unshift(song);
      }
      return next;
    });
  }, []);

  /** Drop a song row that no longer exists on the server. */
  const remove = useCallback((id: string) => {
    setSongs((prev) => prev.filter((s) => s.id !== id));
  }, []);
```

(ค) แทนที่บรรทัด return สุดท้ายด้วย:

```ts
  return { songs, loaded, authNeeded, refresh, upsert, remove };
```

- [ ] **Step 3: `CreatePanel` ใช้แถวจากเซิร์ฟเวอร์**

เปิด `web/components/CreatePanel.tsx`:

(ก) เปลี่ยน `interface Props` เป็น:

```ts
interface Props {
  onCreated: (songs: Song[]) => void;
}
```

(ข) แทนที่บล็อกตั้งแต่ `const created = await api<...>` จนถึงคอมเมนต์ `// the form deliberately keeps its values…` ด้วย:

```ts
      const created = await api<{ songs: Song[] }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated(created.songs);
      // the form deliberately keeps its values: tweak a word, create again
```

(ค) import ที่ไม่ได้ใช้แล้วต้องออก — บรรทัด import แรกกลายเป็น:

```ts
import { api, type GenerateBody, type Song } from '../lib/api';
```

(คงเดิม — `Song` ยังใช้ใน Props · `GenerateBody` ยังใช้ตอนประกอบ body)

- [ ] **Step 4: `App` upsert ทั้งสองแถว**

เปิด `web/App.tsx`:

(ก) เปลี่ยนบรรทัด `const { songs, loaded, authNeeded, refresh, upsert } = useSongs();` เป็น:

```tsx
  const { songs, loaded, authNeeded, refresh, upsert, remove } = useSongs();
```

(ข) แทนที่ `<CreatePanel onCreated={...} />` ทั้งก้อนด้วย:

```tsx
          <CreatePanel
            onCreated={(created) => {
              upsert(created);
              setActiveId(created[0].id);
              wasPending.current = true;
              // on desktop the library is already in view; on mobile show the new cards
              setTab('library');
              setToast('เริ่มสร้างเพลงแล้ว — จะขึ้นในคลังเมื่อเสร็จ');
            }}
          />
```

(ค) ส่ง `remove` ลง `LibraryGrid` — เพิ่ม prop ต่อจาก `upsert={upsert}`:

```tsx
            upsert={upsert}
            remove={remove}
```

- [ ] **Step 5: `LibraryGrid` — retry ได้สองการ์ด + ป้าย**

เปิด `web/components/LibraryGrid.tsx`:

(ก) เพิ่มใน `interface Props`:

```ts
  upsert: (song: Song | Song[]) => void;
  remove: (id: string) => void;
```

(ข) เพิ่ม `remove` ในพารามิเตอร์ที่ destructure ของ `export function LibraryGrid({ … })`

(ค) แทนที่บล็อก `try { const created = await api<...>(...); upsert({...}); }` ในฟังก์ชัน `retry` ด้วย:

```ts
    try {
      const created = await api<{ songs: Song[] }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      // the failed card is replaced by the fresh pair
      remove(song.id);
      upsert(created.songs);
    } catch {
```

(หมายเหตุ: บล็อก `catch` เดิมและ `onRetryFailed` คงไว้ตามเดิม)

(ง) แทนที่บล็อก `return (` สุดท้ายของไฟล์ทั้งก้อนด้วย:

```tsx
  return (
    <div className={GRID}>
      {visible.map((song, i) => (
        <div key={song.id} className="rise-in" style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}>
          <SongCard
            song={song}
            showVariant={visible.filter((s) => s.taskId === song.taskId).length > 1}
            isActive={activeSong?.id === song.id}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onRetry={retry}
          />
        </div>
      ))}
    </div>
  );
}
```

(`visible` คือ `filterSongs(songs, query)` ที่ไฟล์นี้คำนวณไว้แล้วเหนือบล็อกนี้ — ป้ายจึงขึ้นเฉพาะเมื่อคู่ของมันยังอยู่ในรายการที่กรองแล้ว)

- [ ] **Step 6: `SongCard` — ป้าย v1/v2**

เปิด `web/components/SongCard.tsx`:

(ก) เพิ่มใน `interface Props`:

```ts
  showVariant: boolean;
```

(ข) เพิ่ม `showVariant` ในพารามิเตอร์ที่ destructure

(ค) ภายใน `<div>` ที่ครอบปก (ตัวที่มี `className={...relative aspect-square...}`) เพิ่มก่อน `{pending && …}`:

```tsx
        {showVariant && (
          <span className="variant-badge" aria-hidden="true">v{song.variant}</span>
        )}
```

(ง) ต่อท้าย `web/index.css` (หลังบล็อก `.aside-divider`) เพิ่ม:

```css
/* ป้ายบอกว่าเป็นเวอร์ชันที่เท่าไรของงานเดียวกัน */
.variant-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 1;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: var(--text);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}
```

- [ ] **Step 7: typecheck**

รัน: `npm run typecheck`
คาดหวัง: ไม่มี error · ถ้าเห็น `Property 'remove' is missing` แปลว่ายังส่ง prop ไม่ครบจาก `App` ลง `LibraryGrid`

- [ ] **Step 8: เทสต์เดิมยังผ่าน**

รัน: `npm test`
คาดหวัง: PASS ทั้งหมด

- [ ] **Step 9: build**

รัน: `npm run build`
คาดหวัง: `✓ built in …`

- [ ] **Step 10: Commit**

```bash
git add web
git commit -m "feat(web): library shows both variants of a generation"
```

---

### Task 6: รัน migration และตรวจของจริง

**Files:** ไม่แก้ไฟล์ (เว้นแต่เจอปัญหา)

**Interfaces:**
- Consumes: ทุก task ก่อนหน้า
- Produces: ไม่มี

- [ ] **Step 1: รัน migration บนฐานในเครื่อง**

ฐานคือ `song-auto-db` และ `wrangler.jsonc` ตั้ง `"migrations_dir": "migrations"` ไว้แล้ว

รัน: `npx wrangler d1 migrations apply song-auto-db --local`
คาดหวัง: รายงานว่า `0003_add_variant_and_suno_id.sql` ถูกใช้แล้ว

- [ ] **Step 2: ตรวจด้วยตาบนเบราว์เซอร์**

รัน: `npm run dev` แล้วเปิดหน้าเว็บ

ตรวจ 5 ข้อ:
1. กดสร้างหนึ่งครั้ง → คลังขึ้น **2 การ์ด** ทันที ทั้งคู่หมุนรอ
2. ทั้งสองการ์ดมีป้าย `v1` และ `v2` ที่มุมซ้ายบนของปก
3. เพลงเก่าที่มีอยู่ก่อนหน้า **ไม่มีป้าย**
4. เมื่อแทร็กแรกเสร็จ การ์ด v1 เล่นได้ทั้งที่ v2 ยังหมุนอยู่
5. รีเฟรชหน้า → ทั้งสองการ์ดยังอยู่และสถานะถูกต้อง

- [ ] **Step 3: ตรวจว่าเพลงสองใบไม่ใช่ไฟล์เดียวกัน**

หลังทั้งคู่เสร็จ ให้เล่นทีละใบ — ต้องเป็นคนละเพลง (Suno ทำสองเวอร์ชันจาก prompt เดียวกัน คล้ายกันแต่ไม่เหมือน)
ถ้าได้ยินเหมือนกันเป๊ะ ให้หยุดและรายงาน — แปลว่า index ของแทร็กถูกหยิบซ้ำ

- [ ] **Step 4: รัน migration บนฐานจริง (ต้องขออนุญาตเจ้าของก่อน)**

**อย่ารันเอง** — บอกเจ้าของว่าคำสั่งคือ `npx wrangler d1 migrations apply song-auto-db --remote`
และรอให้เจ้าของสั่งก่อน (นี่คือการแตะข้อมูลจริง) · ถ้ายังไม่รัน โค้ดที่ deploy ไปจะพังทันทีที่ query
คอลัมน์ที่ยังไม่มีในฐานจริง

---

## เสร็จแล้วตรวจอะไรบ้าง (Definition of Done)

- `npm test` ผ่านทั้งหมด รวมเทสต์ใหม่ 5 เคสของ `getTask` และ 3 เคสของ `kiePollTask`
- `npm run typecheck` และ `npm run build` ผ่าน
- กดสร้าง 1 ครั้ง → 2 แถวในฐาน `task_id` เดียวกัน `variant` 1 และ 2 · เรียก kie แค่ครั้งเดียว
- การ์ดแรกเล่นได้ก่อนการ์ดที่สองเสร็จ
- แถวที่ไม่มีแทร็กถูกลบ ไม่ค้างหมุนตลอดกาล
- `suno_id` ถูกเก็บคนละค่าในสองแถว (สเปก persona จะใช้ต่อ)
- migration ถูกใช้กับฐานในเครื่องแล้ว และเจ้าของรับทราบเรื่องฐานจริง
