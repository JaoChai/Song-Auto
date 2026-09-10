# Extend / AI Lyrics / Persona Rework / UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มการต่อเพลง (extend) และการให้ AI แต่งเนื้อเพลง (lyrics) ลง Song-Auto, ทำให้ persona ส่งพารามิเตอร์ครบและกันเงื่อนไขที่ kie ระบุ, และเปลี่ยนจานสี ตัวอักษร กับที่ทางบนหน้าจอให้อ่านง่ายขึ้น

**Architecture:** kie คืน `taskId` ให้ทั้ง `generate` และ `generate/extend` แล้วอ่านผลผ่าน `generate/record-info` เส้นเดียวกัน ดังนั้นเพลงที่ต่อแล้วจึงเป็นแค่แถวใหม่ในตาราง `songs` ที่มี `parent_song_id` ชี้กลับไปต้นทาง — `kiePollTask`, `GET /api/tasks/:id` และ hook `useSongs` ทำงานกับมันได้ทันทีโดยไม่ต้องเขียนระบบ poll ชุดที่สอง ส่วนงานแต่งเนื้อเพลงมี task/poll คนละชุด (`/api/v1/lyrics`) แต่ไม่แตะฐานข้อมูลเพราะงานอายุสั้นและใช้แล้วทิ้ง ฝั่งหน้าเว็บย้ายทุกการกระทำที่เกี่ยวกับเพลงหนึ่งเพลงออกจากการ์ดไปอยู่บนแผงรายละเอียดที่เลื่อนทับ grid เข้ามาจากขอบขวา

**Tech Stack:** Cloudflare Workers · Hono 4 · D1 · R2 · React 19 · Vite · Tailwind 4 · Vitest 4 · TypeScript 7

**Spec:** `docs/superpowers/specs/2026-09-10-extend-lyrics-persona-redesign-design.md`

## Global Constraints

- ภาษาของ UI และข้อความ error ที่ผู้ใช้เห็นทั้งหมดเป็น**ภาษาไทย** ส่วนข้อความ error ที่โยนจาก `kie.ts` เป็นภาษาอังกฤษตามแบบเดิมของไฟล์นั้น (ผู้เรียกเป็นคนแปลง)
- ทุกฟังก์ชันใน `src/worker/kie.ts` ใช้สัญญาเดียวกับของเดิม: คืนค่าเมื่อสำเร็จ **โยน `Error`** เมื่อพลาด ผู้เรียกเป็นคนตัดสินว่าตอบ HTTP อะไร
- ทุกเส้นทางใหม่ใต้ `/api/*` อยู่หลัง `authMiddleware` โดยอัตโนมัติ (`index.ts:30`) — ห้ามยกเว้น
- ขีดจำกัดตัวอักษรของ kie: prompt 3000 (simple) / 5000 (custom) · style 1000 · title 80 · lyrics prompt **200**
- โมเดลที่รองรับ: `V3_5`, `V4`, `V4_5`, `V4_5PLUS`, `V4_5ALL`, `V5` — persona **ไม่รองรับ `V3_5`**
- `personaModel` มีสองค่า: `style_persona`, `voice_persona` และใช้ได้เฉพาะโมเดล V5 ขึ้นไป
- persona: `vocalEnd - vocalStart` ต้องอยู่ระหว่าง **10 ถึง 30 วินาที** และหนึ่ง `audioId` ทำ persona ได้ครั้งเดียว
- extend: `model` ต้องเท่ากับเพลงต้นทางเสมอ — อ่านจากแถวในฐานข้อมูล **ห้ามรับจากผู้เรียก**
- สั่งเทสต์ด้วย `npx vitest run <path> -t "<ชื่อเทสต์>"` — ห้ามใช้ `npm test` ระหว่างทำทีละข้อเพราะมันรันทั้งชุด
- commit ทุกครั้งที่จบ task ตามข้อความที่ระบุไว้ในแต่ละ Step สุดท้าย
- ต่อท้ายทุก commit message ด้วยสองบรรทัดนี้:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy
  ```

## File Structure

| ไฟล์ | หน้าที่ | สถานะ |
|------|--------|-------|
| `migrations/0005_extend_lineage.sql` | คอลัมน์ `parent_song_id`, `continue_at` | สร้าง |
| `src/worker/types.ts` | `SongRow` รับสองฟิลด์ใหม่ | แก้ |
| `src/worker/kie.ts` | ตัวเรียก kie ทั้งหมด + validate | แก้ |
| `src/worker/lyrics.ts` | สองเส้นทางของงานแต่งเนื้อเพลง | สร้าง |
| `src/worker/routes.ts` | `extendSong`, `backfillSunoId`, `toSongRow` | แก้ |
| `src/worker/personas.ts` | กันซ้ำ กัน V3_5 ส่งช่วงวิเคราะห์ | แก้ |
| `src/worker/index.ts` | ผูกเส้นทางใหม่ | แก้ |
| `tests/fakes.ts` | fake D1 ที่อ่านชื่อคอลัมน์จาก SQL | แก้ |
| `web/index.css` | token สี ฟอนต์ไทย | แก้ |
| `web/lib/api.ts` | ชนิดข้อมูลและตัวเรียกของเส้นทางใหม่ | แก้ |
| `web/hooks/useLyrics.ts` | เริ่มงานแต่งเนื้อแล้ว poll | สร้าง |
| `web/components/LyricsAssist.tsx` | UI ของงานแต่งเนื้อ | สร้าง |
| `web/components/ExtendPanel.tsx` | UI ของการต่อเพลง | สร้าง |
| `web/components/SongDetail.tsx` | แผงรายละเอียดเพลง | สร้าง |
| `web/components/SongCard.tsx` | เหลือแค่แสดงกับสั่งเล่น | แก้ |
| `web/components/LibraryGrid.tsx` | สถานะคลังน้อย | แก้ |
| `web/components/CreatePanel.tsx` | ปุ่มเรียก LyricsAssist | แก้ |
| `web/App.tsx` | ราวซ้ายถาวร + แผงทับจากขวา | แก้ |
| `design-system/song-auto/MASTER.md` | จานสีและ pattern ให้ตรงของจริง | แก้ |

---

## Task 1: คอลัมน์สายพันธุ์เพลง และ fake D1 ที่ทนต่อการเพิ่มคอลัมน์

เพิ่มสองคอลัมน์ที่ extend ต้องใช้ และแก้ fake D1 ให้อ่านชื่อคอลัมน์จาก SQL แทนการนับตำแหน่ง argument — ถ้าไม่แก้ตรงนี้ก่อน เทสต์ทุกตัวที่แตะ INSERT จะพังทันทีที่ Task 3 เพิ่ม bind

**Files:**
- Create: `migrations/0005_extend_lineage.sql`
- Modify: `src/worker/types.ts:9-14`
- Modify: `src/worker/routes.ts:8-25` (`toSongRow`)
- Modify: `tests/fakes.ts:54-64` (สาขา `isInsert`)
- Test: `tests/api.test.ts`

**Interfaces:**
- Consumes: ไม่มี (task แรก)
- Produces: `SongRow.parentSongId: string | null` · `SongRow.continueAt: number | null` · fake D1 ที่รับ INSERT กี่คอลัมน์ก็ได้

- [ ] **Step 1: เขียน migration**

สร้าง `migrations/0005_extend_lineage.sql`:

```sql
ALTER TABLE songs ADD COLUMN parent_song_id TEXT;
ALTER TABLE songs ADD COLUMN continue_at REAL;
CREATE INDEX IF NOT EXISTS idx_songs_parent ON songs (parent_song_id);
```

- [ ] **Step 2: เขียนเทสต์ที่ต้องพัง**

เพิ่มลงท้าย `tests/api.test.ts`:

```ts
describe('GET /api/songs — ฟิลด์สายพันธุ์', () => {
  it('ส่ง parentSongId กับ continueAt ออกมาด้วย', async () => {
    const { env } = makeEnv([
      {
        id: 's2', task_id: 'task-2', title: 'ต่อจากสายฝน', prompt: '', style: '', tags: '',
        model: 'V5', instrumental: 0, status: 'SUCCESS', error: null, r2_key: 's2.mp3',
        image_key: null, duration: 60, created_at: '2026-09-10T00:00:00.000Z', variant: 1,
        suno_id: 'a2', parent_song_id: 's1', continue_at: 42.5,
      } as never,
    ]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/songs', { headers: { cookie } }, env);
    const out = await res.json() as { songs: Array<Record<string, unknown>> };
    expect(out.songs[0].parentSongId).toBe('s1');
    expect(out.songs[0].continueAt).toBe(42.5);
  });

  it('เพลงที่ไม่ได้ต่อจากใคร ได้ null ทั้งสองฟิลด์', async () => {
    const { env } = makeEnv([
      {
        id: 's1', task_id: 'task-1', title: 'สายฝน', prompt: '', style: '', tags: '',
        model: 'V5', instrumental: 0, status: 'SUCCESS', error: null, r2_key: 's1.mp3',
        image_key: null, duration: 60, created_at: '2026-09-09T00:00:00.000Z', variant: 1,
        suno_id: 'a1',
      } as never,
    ]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/songs', { headers: { cookie } }, env);
    const out = await res.json() as { songs: Array<Record<string, unknown>> };
    expect(out.songs[0].parentSongId).toBeNull();
    expect(out.songs[0].continueAt).toBeNull();
  });
});
```

> ถ้า `tests/api.test.ts` ยังไม่มี helper `cookieFor` ให้คัดลอกมาจาก `tests/personas.test.ts:7-16` ตามเดิม

- [ ] **Step 3: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run tests/api.test.ts -t "ฟิลด์สายพันธุ์"`
Expected: FAIL — `expected undefined to be 's1'`

- [ ] **Step 4: เพิ่มฟิลด์ใน `SongRow`**

ใน `src/worker/types.ts` แก้ interface `SongRow` เพิ่มสองบรรทัดท้าย:

```ts
export interface SongRow {
  id: string; taskId: string; title: string; prompt: string; style: string;
  tags: string; model: string; instrumental: number; status: SongStatus;
  error: string | null; r2Key: string | null; imageKey: string | null; duration: number | null; createdAt: string;
  sunoId: string | null; variant: number;
  parentSongId: string | null; continueAt: number | null;
}
```

- [ ] **Step 5: แปลงฟิลด์ใน `toSongRow`**

ใน `src/worker/routes.ts` เพิ่มสองบรรทัดก่อนปีกกาปิดของ `toSongRow`:

```ts
  variant: Number(r.variant ?? 1),
  parentSongId: (r.parent_song_id as string | null) ?? null,
  continueAt: typeof r.continue_at === 'number' ? r.continue_at : null,
});
```

- [ ] **Step 6: รันเทสต์ให้ผ่าน**

Run: `npx vitest run tests/api.test.ts -t "ฟิลด์สายพันธุ์"`
Expected: PASS ทั้งสองตัว

- [ ] **Step 7: แก้ fake D1 ให้อ่านชื่อคอลัมน์จาก SQL**

ใน `tests/fakes.ts` แทนที่สาขา `if (isInsert) { ... }` (บรรทัด 54-64) ทั้งก้อนด้วย:

```ts
              if (isInsert) {
                // อ่านชื่อคอลัมน์กับตำแหน่ง ? จาก SQL แทนการนับ argument
                // — เพิ่มคอลัมน์ใหม่แล้วเทสต์เดิมต้องไม่พัง
                const cols = (sql.match(/INSERT INTO\s+\w+\s*\(([^)]*)\)/i)?.[1] ?? '')
                  .split(',').map((c) => c.trim());
                const vals = (sql.match(/VALUES\s*\(([^)]*)\)/i)?.[1] ?? '')
                  .split(',').map((v) => v.trim());
                const row: Record<string, unknown> = {};
                let argIndex = 0;
                cols.forEach((col, i) => {
                  const v = vals[i];
                  if (v === '?') row[col] = args[argIndex++];
                  else if (v === 'NULL') row[col] = null;
                  else row[col] = v.replace(/^'|'$/g, '');
                });
                data.push({
                  ...row,
                  instrumental: Number(row.instrumental ?? 0),
                  variant: Number(row.variant ?? 1),
                  suno_id: (row.suno_id as string | null) ?? null,
                  parent_song_id: (row.parent_song_id as string | null) ?? null,
                  continue_at: (row.continue_at as number | null) ?? null,
                } as unknown as Row);
                return { success: true };
              }
```

- [ ] **Step 8: รันทั้งชุดให้แน่ใจว่าไม่มีอะไรพัง**

Run: `npx vitest run`
Expected: PASS ทุกไฟล์ (เทสต์เดิมต้องไม่พังจากการแก้ fake)

- [ ] **Step 9: ลง migration จริง**

```bash
npx wrangler d1 migrations apply song-auto-db --remote
```
Expected: รายงานว่าลง `0005_extend_lineage.sql` สำเร็จ

- [ ] **Step 10: Commit**

```bash
git add migrations/0005_extend_lineage.sql src/worker/types.ts src/worker/routes.ts tests/fakes.ts tests/api.test.ts
git commit -m "feat(db): add parent_song_id and continue_at for extended songs

fake D1 อ่านชื่อคอลัมน์จาก SQL แทนการนับตำแหน่ง argument เพื่อให้เทสต์เดิม
ไม่พังเมื่อมีคอลัมน์เพิ่ม

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 2: `validateExtend` และ `kieExtend`

**Files:**
- Modify: `src/worker/kie.ts` (เพิ่มท้ายไฟล์)
- Test: `tests/kie.test.ts`

**Interfaces:**
- Consumes: `Env` จาก Task 1 · `authHeaders`, `KIE_MODELS`, `PERSONA_MODELS`, ขีดจำกัดตัวอักษรที่มีอยู่แล้วใน `kie.ts`
- Produces:
  ```ts
  export interface ExtendInput {
    audioId: string;
    model: string;
    defaultParamFlag: boolean;
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
  export function validateExtend(input: ExtendInput): string | null
  export async function kieExtend(env: Env, input: ExtendInput): Promise<string>
  ```

- [ ] **Step 1: เขียนเทสต์ของ `validateExtend` ที่ต้องพัง**

เพิ่มลงท้าย `tests/kie.test.ts`:

```ts
import { validateExtend, kieExtend, type ExtendInput } from '../src/worker/kie';

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
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run tests/kie.test.ts -t "validateExtend"`
Expected: FAIL — import ไม่เจอ `validateExtend`

- [ ] **Step 3: เขียน `validateExtend`**

เพิ่มท้าย `src/worker/kie.ts`:

```ts
const PERSONA_CAPABLE_MODELS = ['V5'] as const;

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

  // ขีดจำกัดตัวอักษร — extend ใช้โหมด custom เสมอเมื่อ defaultParamFlag = true
  if (input.prompt && input.prompt.length > PROMPT_LIMIT_CUSTOM) {
    return `prompt exceeds ${PROMPT_LIMIT_CUSTOM} characters`;
  }
  if (input.style && input.style.length > STYLE_LIMIT) {
    return `style exceeds ${STYLE_LIMIT} characters`;
  }
  if (input.title && input.title.length > TITLE_LIMIT) {
    return `title exceeds ${TITLE_LIMIT} characters`;
  }

  if (Boolean(input.personaId) !== Boolean(input.personaModel)) {
    return 'personaId and personaModel must be given together';
  }
  if (input.personaModel) {
    if (!(PERSONA_MODELS as readonly string[]).includes(input.personaModel)) {
      return `unsupported personaModel '${input.personaModel}' (expected one of ${PERSONA_MODELS.join(', ')})`;
    }
    if (!(PERSONA_CAPABLE_MODELS as readonly string[]).includes(input.model)) {
      return `persona requires model V5 (got '${input.model}')`;
    }
  }
  return null;
}
```

- [ ] **Step 4: รันเทสต์ของ validate ให้ผ่าน**

Run: `npx vitest run tests/kie.test.ts -t "validateExtend"`
Expected: PASS ทั้ง 9 ตัว

- [ ] **Step 5: เขียนเทสต์ของ `kieExtend` ที่ต้องพัง**

เพิ่มต่อใน `tests/kie.test.ts`:

```ts
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
```

- [ ] **Step 6: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run tests/kie.test.ts -t "kieExtend"`
Expected: FAIL — `kieExtend is not a function`

- [ ] **Step 7: เขียน `kieExtend`**

เพิ่มท้าย `src/worker/kie.ts`:

```ts
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
```

- [ ] **Step 8: ดึง callBackUrl ออกมาเป็นค่าคงที่ร่วม**

ใน `src/worker/kie.ts` เพิ่มค่าคงที่ใต้ `const BASE_URL`:

```ts
// kie.ai requires callBackUrl (422 without it) even though we poll record-info instead
const CALLBACK_URL = 'https://song-auto.anugooltippon.workers.dev/api/health';
```

แล้วใน `kieGenerate` แทน string เดิมที่บรรทัด 77 ด้วย `callBackUrl: CALLBACK_URL,` และลบคอมเมนต์ซ้ำที่บรรทัด 76 ออก

- [ ] **Step 9: รันเทสต์ให้ผ่านทั้งไฟล์**

Run: `npx vitest run tests/kie.test.ts`
Expected: PASS ทุกตัว รวมเทสต์เดิมของ `kieGenerate` ที่ยังต้องส่ง callBackUrl เหมือนเดิม

- [ ] **Step 10: Commit**

```bash
git add src/worker/kie.ts tests/kie.test.ts
git commit -m "feat(kie): add validateExtend and kieExtend

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 3: เส้นทาง `POST /api/songs/:id/extend`

**Files:**
- Modify: `src/worker/routes.ts` (เพิ่มฟังก์ชัน `extendSong`)
- Modify: `src/worker/index.ts` (ผูกเส้นทาง)
- Test: `tests/extend.test.ts` (สร้าง)

**Interfaces:**
- Consumes: `kieExtend`, `validateExtend`, `ExtendInput` จาก Task 2 · `toSongRow`, `VARIANTS` จาก `routes.ts`
- Produces: `export async function extendSong(ctx: Context<{ Bindings: Env }>)` — ตอบ `201 { songs: SongRow[] }`

- [ ] **Step 1: เขียนเทสต์ที่ต้องพัง**

สร้าง `tests/extend.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../src/worker/index';
import { makeEnv } from './fakes';
import type { SongRow } from '../src/worker/types';

const cookieFor = async (env: Parameters<typeof app.request>[2]): Promise<string> => {
  const res = await app.request('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'pw' }),
  }, env);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('no session cookie issued');
  return setCookie.split(';')[0];
};

const songRow = (over: Record<string, unknown> = {}) => ({
  id: 's1', task_id: 'task-1', title: 'สายฝน', prompt: 'p', style: 'dream pop', tags: 'calm',
  model: 'V4_5', instrumental: 0, status: 'SUCCESS' as const, error: null, r2_key: 's1.mp3',
  image_key: null, duration: 100, created_at: '2026-09-09T00:00:00.000Z', variant: 1,
  suno_id: 'a1', parent_song_id: null, continue_at: null, ...over,
});

const okExtend = () =>
  vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({ code: 200, msg: 'success', data: { taskId: 'ext-1' } }),
  });

describe('POST /api/songs/:id/extend', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('สร้างสองแถวใหม่ที่ชี้กลับไปเพลงต้นทาง', async () => {
    const { env, data } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', okExtend());

    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);

    expect(res.status).toBe(201);
    const out = await res.json() as { songs: SongRow[] };
    expect(out.songs).toHaveLength(2);
    expect(out.songs.map((s) => s.variant)).toEqual([1, 2]);
    expect(out.songs.every((s) => s.parentSongId === 's1')).toBe(true);
    expect(out.songs.every((s) => s.taskId === 'ext-1')).toBe(true);
    expect(out.songs.every((s) => s.status === 'PENDING')).toBe(true);
    // ต้นทาง 1 + ใหม่ 2
    expect(data).toHaveLength(3);
  });

  it('ใช้ model ของเพลงต้นทางเสมอ แม้ผู้เรียกจะส่งค่าอื่นมา', async () => {
    const { env } = makeEnv([songRow({ model: 'V4_5' }) as never]);
    const cookie = await cookieFor(env);
    const fetchMock = okExtend();
    vi.stubGlobal('fetch', fetchMock);

    await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false, model: 'V5', audioId: 'ปลอม' }),
    }, env);

    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.model).toBe('V4_5');
    expect(sent.audioId).toBe('a1');
  });

  it('ส่ง continueAt และเก็บลงแถวใหม่ในโหมดปรับเอง', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    const fetchMock = okExtend();
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        defaultParamFlag: true, continueAt: 42.5,
        prompt: 'ต่อให้เบาลง', style: 'dream pop', title: 'ต่อจากสายฝน',
      }),
    }, env);

    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.continueAt).toBe(42.5);
    const out = await res.json() as { songs: SongRow[] };
    expect(out.songs.every((s) => s.continueAt === 42.5)).toBe(true);
    expect(out.songs.every((s) => s.title === 'ต่อจากสายฝน')).toBe(true);
  });

  it('โหมดใช้ค่าเดิมยืมชื่อเพลงต้นทางมาตั้งเป็นชื่อตั้งต้น', async () => {
    const { env } = makeEnv([songRow({ title: 'สายฝน' }) as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', okExtend());

    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);

    const out = await res.json() as { songs: SongRow[] };
    expect(out.songs.every((s) => s.title === 'สายฝน')).toBe(true);
  });

  it('ตอบ 404 เมื่อไม่มีเพลงนั้น', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/songs/ไม่มี/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);
    expect(res.status).toBe(404);
  });

  it('ตอบ 400 พร้อมข้อความไทยเมื่อเพลงยังไม่มี suno_id', async () => {
    const { env } = makeEnv([songRow({ suno_id: null }) as never]);
    const cookie = await cookieFor(env);
    const fetchMock = okExtend();
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);

    expect(res.status).toBe(400);
    const out = await res.json() as { error: string };
    expect(out.error).toContain('รหัสแทร็ก');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ตอบ 400 เมื่อเพลงต้นทางยังไม่สำเร็จ', async () => {
    const { env } = makeEnv([songRow({ status: 'PENDING' }) as never]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);
    expect(res.status).toBe(400);
  });

  it('ตอบ 400 เมื่อ continueAt เกินความยาวเพลงต้นทาง', async () => {
    const { env } = makeEnv([songRow({ duration: 100 }) as never]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        defaultParamFlag: true, continueAt: 150, prompt: 'p', style: 's', title: 't',
      }),
    }, env);
    expect(res.status).toBe(400);
  });

  it('ตอบ 502 เมื่อ kie ปฏิเสธ', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 402, msg: 'Insufficient Credits' }),
    }));
    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);
    expect(res.status).toBe(502);
  });

  it('ตอบ 401 เมื่อไม่มี cookie', async () => {
    const { env } = makeEnv([songRow() as never]);
    const res = await app.request('/api/songs/s1/extend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ defaultParamFlag: false }),
    }, env);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run tests/extend.test.ts`
Expected: FAIL — ทุกตัวได้ 404 เพราะยังไม่มีเส้นทาง

- [ ] **Step 3: เขียน `extendSong`**

เพิ่มท้าย `src/worker/routes.ts` แล้วแก้ import ที่บรรทัด 3 ให้เป็น:

```ts
import { kieExtend, kieGenerate, kiePollTask, validateExtend, validateGenerate, type ExtendInput, type GenerateInput } from './kie';
```

แล้วเพิ่มฟังก์ชัน:

```ts
interface ExtendBody {
  defaultParamFlag?: boolean;
  continueAt?: number;
  prompt?: string;
  style?: string;
  title?: string;
  negativeTags?: string;
  personaId?: string;
  personaModel?: string;
}

/**
 * POST /api/songs/:id/extend — ต่อเพลงจากแถวนี้ แล้วเขียนแถว PENDING ใหม่สองแถว
 * ที่ชี้กลับมาหาเพลงต้นทาง โมเดลกับ audioId มาจากแถวต้นทางเสมอ ผู้เรียกกำหนดไม่ได้
 */
export async function extendSong(ctx: Context<{ Bindings: Env }>) {
  const parentId = ctx.req.param('id');
  const parent = await ctx.env.DB.prepare('SELECT * FROM songs WHERE id = ?')
    .bind(parentId).first<Record<string, unknown> | null>();
  if (!parent) return c(ctx).json({ error: `song not found: ${parentId}` }, 404);

  if (parent.status !== 'SUCCESS') {
    return c(ctx).json({ error: 'ต่อเพลงได้เฉพาะเพลงที่สร้างเสร็จแล้ว' }, 400);
  }
  const audioId = (parent.suno_id as string | null) ?? '';
  if (!audioId) {
    return c(ctx).json({ error: 'เพลงนี้สร้างก่อนระบบเก็บรหัสแทร็ก จึงต่อเพลงไม่ได้' }, 400);
  }

  let body: ExtendBody;
  try {
    body = (await ctx.req.json()) as ExtendBody;
  } catch {
    return c(ctx).json({ error: 'invalid JSON body' }, 400);
  }

  const custom = Boolean(body.defaultParamFlag);
  const input: ExtendInput = {
    audioId,
    model: parent.model as string,
    defaultParamFlag: custom,
    sourceDuration: typeof parent.duration === 'number' ? parent.duration : null,
    instrumental: Number(parent.instrumental ?? 0) === 1,
    ...(custom
      ? {
          continueAt: body.continueAt,
          prompt: body.prompt,
          style: body.style,
          title: body.title,
        }
      : {}),
    ...(body.negativeTags ? { negativeTags: body.negativeTags } : {}),
    ...(body.personaId && body.personaModel
      ? { personaId: body.personaId, personaModel: body.personaModel }
      : {}),
  };

  const validation = validateExtend(input);
  if (validation) return c(ctx).json({ error: validation }, 400);

  let taskId: string;
  try {
    taskId = await kieExtend(ctx.env, input);
  } catch (e) {
    return c(ctx).json({ error: err(e) }, 502);
  }

  const createdAt = new Date().toISOString();
  const title = custom ? (body.title ?? '') : ((parent.title as string) ?? '');
  const style = custom ? (body.style ?? '') : ((parent.style as string) ?? '');
  const prompt = custom ? (body.prompt ?? '') : ((parent.prompt as string) ?? '');
  const continueAt = custom ? (body.continueAt ?? null) : null;

  const rows = VARIANTS.map((variant) => ({
    id: nanoid(),
    task_id: taskId,
    title,
    prompt,
    style,
    tags: '',
    model: parent.model as string,
    instrumental: Number(parent.instrumental ?? 0),
    status: 'PENDING' as const,
    error: null,
    r2_key: null,
    image_key: null,
    duration: null,
    created_at: createdAt,
    suno_id: null,
    variant,
    parent_song_id: parentId,
    continue_at: continueAt,
  }));

  try {
    await ctx.env.DB.batch(
      rows.map((r) =>
        ctx.env.DB.prepare(
          `INSERT INTO songs (id, task_id, title, prompt, style, tags, model, instrumental, status, error, r2_key, duration, created_at, variant, parent_song_id, continue_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, NULL, NULL, ?, ?, ?, ?)`,
        ).bind(
          r.id, r.task_id, r.title, r.prompt, r.style, r.tags, r.model, r.instrumental,
          r.created_at, r.variant, r.parent_song_id, r.continue_at,
        ),
      ),
    );
  } catch (e) {
    return c(ctx).json({ error: `failed to insert song rows: ${err(e)}` }, 500);
  }

  return c(ctx).json({ songs: rows.map(toSongRow) }, 201);
}
```

- [ ] **Step 4: ผูกเส้นทาง**

ใน `src/worker/index.ts` เพิ่ม `extendSong` เข้า import ที่บรรทัด 6 แล้วเพิ่มบรรทัดนี้ใต้ `app.get('/api/songs', listSongs);`:

```ts
app.post('/api/songs/:id/extend', extendSong);
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `npx vitest run tests/extend.test.ts`
Expected: PASS ทั้ง 10 ตัว

- [ ] **Step 6: รันทั้งชุด**

Run: `npx vitest run`
Expected: PASS ทุกไฟล์

- [ ] **Step 7: Commit**

```bash
git add src/worker/routes.ts src/worker/index.ts tests/extend.test.ts
git commit -m "feat(api): POST /api/songs/:id/extend

โมเดลกับ audioId มาจากแถวต้นทางเสมอ เพราะ kie บังคับให้โมเดลของเพลงต่อ
ตรงกับต้นฉบับ ผลลัพธ์เป็นแถว PENDING สองแถวที่ระบบ poll เดิมรับช่วงต่อได้ทันที

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 4: เติม `suno_id` ย้อนหลัง

**ทำไมต้องมี:** ทั้งสองเพลงในคลังจริงมี `suno_id` เป็น `NULL` ทำให้ทั้ง persona และ extend ใช้ไม่ได้เลย งานนี้พยายามเติมย้อนหลังจาก `task_id` ที่ยังมีอยู่

**Files:**
- Modify: `src/worker/routes.ts` (เพิ่ม `backfillSunoId`)
- Modify: `src/worker/index.ts`
- Test: `tests/backfill.test.ts` (สร้าง)

**Interfaces:**
- Consumes: `kiePollTask` จาก `kie.ts` (มีอยู่แล้ว)
- Produces: `export async function backfillSunoId(ctx)` — ตอบ `200 { filled: number, skipped: Array<{ taskId: string; reason: string }> }`

- [ ] **Step 1: เขียนเทสต์ที่ต้องพัง**

สร้าง `tests/backfill.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../src/worker/index';
import { makeEnv } from './fakes';

const cookieFor = async (env: Parameters<typeof app.request>[2]): Promise<string> => {
  const res = await app.request('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'pw' }),
  }, env);
  return res.headers.get('set-cookie')!.split(';')[0];
};

const row = (over: Record<string, unknown> = {}) => ({
  id: 's1', task_id: 'task-1', title: 't', prompt: '', style: '', tags: '',
  model: 'V4_5', instrumental: 0, status: 'SUCCESS' as const, error: null, r2_key: 's1.mp3',
  image_key: null, duration: 100, created_at: '2026-08-01T00:00:00.000Z', variant: 1,
  suno_id: null, parent_song_id: null, continue_at: null, ...over,
});

const recordInfo = (sunoIds: string[]) =>
  vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({
      code: 200, msg: 'success',
      data: {
        status: 'SUCCESS',
        response: { sunoData: sunoIds.map((id) => ({ id, audioUrl: `https://x/${id}.mp3` })) },
      },
    }),
  });

describe('POST /api/songs/backfill-suno-id', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('เติม suno_id ให้แถวที่ยังว่าง โดยใช้ตำแหน่งตาม variant', async () => {
    const { env, data } = makeEnv([
      row({ id: 's1', variant: 1 }) as never,
      row({ id: 's2', variant: 2 }) as never,
    ]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', recordInfo(['audio-A', 'audio-B']));

    const res = await app.request('/api/songs/backfill-suno-id',
      { method: 'POST', headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const out = await res.json() as { filled: number };
    expect(out.filled).toBe(2);
    expect(data.find((r) => r.id === 's1')!.suno_id).toBe('audio-A');
    expect(data.find((r) => r.id === 's2')!.suno_id).toBe('audio-B');
  });

  it('ยิง record-info ครั้งเดียวต่อหนึ่ง task แม้มีหลายแถว', async () => {
    const { env } = makeEnv([
      row({ id: 's1', variant: 1 }) as never,
      row({ id: 's2', variant: 2 }) as never,
    ]);
    const cookie = await cookieFor(env);
    const fetchMock = recordInfo(['audio-A', 'audio-B']);
    vi.stubGlobal('fetch', fetchMock);

    await app.request('/api/songs/backfill-suno-id', { method: 'POST', headers: { cookie } }, env);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ข้ามแถวที่มี suno_id อยู่แล้ว และไม่ยิง fetch เลยถ้าไม่มีอะไรต้องเติม', async () => {
    const { env } = makeEnv([row({ suno_id: 'มีแล้ว' }) as never]);
    const cookie = await cookieFor(env);
    const fetchMock = recordInfo(['audio-A']);
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/api/songs/backfill-suno-id',
      { method: 'POST', headers: { cookie } }, env);
    const out = await res.json() as { filled: number };
    expect(out.filled).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('รายงาน task ที่เติมไม่ได้พร้อมเหตุผล ไม่ล้มทั้งคำขอ', async () => {
    const { env, data } = makeEnv([row({ id: 's1', variant: 1 }) as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 404, msg: 'Not Found' }),
    }));

    const res = await app.request('/api/songs/backfill-suno-id',
      { method: 'POST', headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const out = await res.json() as { filled: number; skipped: Array<{ taskId: string; reason: string }> };
    expect(out.filled).toBe(0);
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0].taskId).toBe('task-1');
    expect(data[0].suno_id).toBeNull();
  });

  it('ข้ามแถวที่ยังไม่ SUCCESS', async () => {
    const { env } = makeEnv([row({ status: 'PENDING' }) as never]);
    const cookie = await cookieFor(env);
    const fetchMock = recordInfo(['audio-A']);
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request('/api/songs/backfill-suno-id',
      { method: 'POST', headers: { cookie } }, env);
    const out = await res.json() as { filled: number };
    expect(out.filled).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ตอบ 401 เมื่อไม่มี cookie', async () => {
    const { env } = makeEnv([row() as never]);
    const res = await app.request('/api/songs/backfill-suno-id', { method: 'POST' }, env);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: เพิ่มการรองรับ UPDATE suno_id ใน fake D1**

สาขาสุดท้ายของ `run()` ใน `tests/fakes.ts` จัดการเฉพาะ UPDATE ของ SUCCESS ต้องเพิ่มสาขาใหม่**ก่อน**สาขานั้น:

```ts
              if (S.startsWith('UPDATE') && S.includes('SET SUNO_ID = ?') && !S.includes('STATUS')) {
                const [suno_id, id] = args as [string, string];
                Object.assign(find(id)!, { suno_id });
                return { success: true };
              }
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run tests/backfill.test.ts`
Expected: FAIL — 404 เพราะยังไม่มีเส้นทาง

- [ ] **Step 4: เขียน `backfillSunoId`**

เพิ่มท้าย `src/worker/routes.ts`:

```ts
/**
 * POST /api/songs/backfill-suno-id — เติม suno_id ให้แถวเก่าที่สร้างก่อน migration 0003
 * ยิง record-info ครั้งเดียวต่อหนึ่ง task แล้วจับคู่แทร็กตาม variant
 * เรียกแบบมือครั้งเดียว ไม่มีปุ่มบนหน้าเว็บ
 */
export async function backfillSunoId(ctx: Context<{ Bindings: Env }>) {
  const { results } = await ctx.env.DB
    .prepare(`SELECT * FROM songs WHERE suno_id IS NULL AND status = 'SUCCESS'`)
    .bind().all<Record<string, unknown>>();

  const byTask = new Map<string, Array<Record<string, unknown>>>();
  for (const row of results) {
    const taskId = row.task_id as string;
    if (!taskId) continue;
    const list = byTask.get(taskId) ?? [];
    list.push(row);
    byTask.set(taskId, list);
  }

  let filled = 0;
  const skipped: Array<{ taskId: string; reason: string }> = [];

  for (const [taskId, rows] of byTask) {
    const poll = await kiePollTask(ctx.env, taskId);
    if (poll.kind !== 'PENDING') {
      skipped.push({
        taskId,
        reason: poll.kind === 'FAILED' ? poll.error : poll.note,
      });
      continue;
    }
    for (const row of rows) {
      const track = poll.tracks[Number(row.variant ?? 1) - 1];
      if (!track || !track.sunoId) {
        skipped.push({ taskId, reason: `ไม่พบแทร็กลำดับที่ ${row.variant} ในงานนี้` });
        continue;
      }
      await ctx.env.DB.prepare('UPDATE songs SET suno_id = ? WHERE id = ?')
        .bind(track.sunoId, row.id as string).run();
      filled++;
    }
  }

  return c(ctx).json({ filled, skipped });
}
```

`kiePollTask` อยู่ใน import ที่แก้ไว้ตอน Task 3 แล้ว ไม่ต้องแก้ซ้ำ

- [ ] **Step 5: ผูกเส้นทาง**

ใน `src/worker/index.ts` เพิ่ม `backfillSunoId` เข้า import แล้วเพิ่มบรรทัด **ก่อน** `app.post('/api/songs/:id/extend', ...)`:

```ts
app.post('/api/songs/backfill-suno-id', backfillSunoId);
```

- [ ] **Step 6: รันเทสต์ให้ผ่าน**

Run: `npx vitest run tests/backfill.test.ts`
Expected: PASS ทั้ง 6 ตัว

- [ ] **Step 7: รันทั้งชุดแล้ว typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS ทั้งคู่

- [ ] **Step 8: Commit**

```bash
git add src/worker/routes.ts src/worker/index.ts tests/backfill.test.ts tests/fakes.ts
git commit -m "feat(api): backfill suno_id for songs created before migration 0003

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

- [ ] **Step 9: รันของจริง แล้วบันทึกผล**

ต้องมี `KIE_API_KEY` ใน `.dev.vars` ก่อน (ไฟล์อยู่ใน `.gitignore` แล้ว) จากนั้น:

```bash
npm run deploy
# แล้วยิงด้วย session cookie ที่ได้จากการ login บนเว็บ
curl -X POST https://song-auto.anugooltippon.workers.dev/api/songs/backfill-suno-id \
  -H "cookie: <sa_session cookie จากเบราว์เซอร์>"
```

**บันทึกผลลัพธ์ไว้แล้วรายงาน** — ถ้า `filled` เป็น 0 และ `skipped` บอกว่างานหมดอายุ
แปลว่าสมมติฐานข้อ 1 ในสเปกถูกใช้จริง: ปุ่มต่อเพลงกับ persona ของสองเพลงเดิมต้องขึ้น
แบบกดไม่ได้พร้อมข้อความอธิบาย ซึ่ง Task 10 จะทำอยู่แล้ว **หยุดถามผู้ใช้ก่อนไปต่อ**
ถ้าผลออกมาต่างจากที่คาด

---

## Task 5: `kieGenerateLyrics` และ `kiePollLyrics`

**Files:**
- Modify: `src/worker/kie.ts`
- Test: `tests/kie.test.ts`

**Interfaces:**
- Consumes: `BASE_URL`, `authHeaders`, `CALLBACK_URL` จาก Task 2
- Produces:
  ```ts
  export const LYRICS_PROMPT_LIMIT = 200;
  export type LyricsVariant = { title: string; text: string };
  export type LyricsPoll =
    | { kind: 'PENDING' }
    | { kind: 'SUCCESS'; variants: LyricsVariant[] }
    | { kind: 'FAILED'; error: string }
    | { kind: 'TRANSIENT'; note: string };
  export function validateLyricsPrompt(prompt: string): string | null
  export async function kieGenerateLyrics(env: Env, prompt: string): Promise<string>
  export async function kiePollLyrics(env: Env, taskId: string): Promise<LyricsPoll>
  ```

- [ ] **Step 1: เขียนเทสต์ที่ต้องพัง**

เพิ่มลงท้าย `tests/kie.test.ts` (เพิ่ม import ด้วย):

```ts
import {
  validateLyricsPrompt, kieGenerateLyrics, kiePollLyrics, LYRICS_PROMPT_LIMIT,
} from '../src/worker/kie';

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
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run tests/kie.test.ts -t "Lyrics"`
Expected: FAIL — import ไม่เจอ

- [ ] **Step 3: เขียนสามฟังก์ชัน**

เพิ่มท้าย `src/worker/kie.ts`:

```ts
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
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run tests/kie.test.ts`
Expected: PASS ทุกตัว

- [ ] **Step 5: Commit**

```bash
git add src/worker/kie.ts tests/kie.test.ts
git commit -m "feat(kie): add lyrics generation and polling

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 6: เส้นทางของงานแต่งเนื้อเพลง

**Files:**
- Create: `src/worker/lyrics.ts`
- Modify: `src/worker/index.ts`
- Test: `tests/lyrics.test.ts` (สร้าง)

**Interfaces:**
- Consumes: `kieGenerateLyrics`, `kiePollLyrics`, `validateLyricsPrompt`, `LYRICS_PROMPT_LIMIT` จาก Task 5
- Produces: `export async function createLyrics(ctx)` · `export async function getLyrics(ctx)`

- [ ] **Step 1: เขียนเทสต์ที่ต้องพัง**

สร้าง `tests/lyrics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../src/worker/index';
import { makeEnv } from './fakes';

const cookieFor = async (env: Parameters<typeof app.request>[2]): Promise<string> => {
  const res = await app.request('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'pw' }),
  }, env);
  return res.headers.get('set-cookie')!.split(';')[0];
};

const post = (cookie: string, body: unknown) => ({
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('POST /api/lyrics', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('คืน taskId เมื่อสำเร็จ', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { taskId: 'lyr-1' } }),
    }));
    const res = await app.request('/api/lyrics', post(cookie, { prompt: 'เพลงเศร้า' }), env);
    expect(res.status).toBe(201);
    expect((await res.json() as { taskId: string }).taskId).toBe('lyr-1');
  });

  it('ตอบ 400 เมื่อคำอธิบายว่าง', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/lyrics', post(cookie, { prompt: '   ' }), env);
    expect(res.status).toBe(400);
  });

  it('ตอบ 400 เมื่อคำอธิบายยาวเกิน 200 ตัวอักษร', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    const res = await app.request('/api/lyrics', post(cookie, { prompt: 'x'.repeat(201) }), env);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toContain('200');
  });

  it('แปลงกรณีมีชื่อศิลปินเป็นข้อความไทยที่บอกวิธีแก้', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 400, msg: 'Song Description contained artist name' }),
    }));
    const res = await app.request('/api/lyrics', post(cookie, { prompt: 'แบบ Bodyslam' }), env);
    expect(res.status).toBe(502);
    expect((await res.json() as { error: string }).error).toContain('ชื่อศิลปิน');
  });

  it('แปลงกรณีถูกกรองเนื้อหาเป็นข้อความไทย', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 400, msg: 'Song Description flagged for moderation' }),
    }));
    const res = await app.request('/api/lyrics', post(cookie, { prompt: 'อะไรสักอย่าง' }), env);
    expect((await res.json() as { error: string }).error).toContain('กรอง');
  });

  it('ตอบ 401 เมื่อไม่มี cookie', async () => {
    const { env } = makeEnv([]);
    const res = await app.request('/api/lyrics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x' }),
    }, env);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/lyrics/:taskId', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('คืน variants เมื่องานเสร็จ', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        code: 200, msg: 'success',
        data: {
          status: 'SUCCESS',
          response: { data: [{ title: 'ฝน', text: '[Verse]\nเนื้อ' }] },
        },
      }),
    }));
    const res = await app.request('/api/lyrics/lyr-1', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    const out = await res.json() as { status: string; variants: Array<{ title: string }> };
    expect(out.status).toBe('SUCCESS');
    expect(out.variants[0].title).toBe('ฝน');
  });

  it('คืน PENDING ระหว่างรอ', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { status: 'PENDING' } }),
    }));
    const res = await app.request('/api/lyrics/lyr-1', { headers: { cookie } }, env);
    expect((await res.json() as { status: string }).status).toBe('PENDING');
  });

  it('คืน FAILED พร้อมข้อความไทยเมื่อโดนกรองคำ', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { status: 'SENSITIVE_WORD_ERROR' } }),
    }));
    const res = await app.request('/api/lyrics/lyr-1', { headers: { cookie } }, env);
    const out = await res.json() as { status: string; error: string };
    expect(out.status).toBe('FAILED');
    expect(out.error).toContain('กรอง');
  });

  it('คืน PENDING พร้อม transient เมื่อ kie ล่มชั่วคราว', async () => {
    const { env } = makeEnv([]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const res = await app.request('/api/lyrics/lyr-1', { headers: { cookie } }, env);
    const out = await res.json() as { status: string; transient?: boolean };
    expect(out.status).toBe('PENDING');
    expect(out.transient).toBe(true);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run tests/lyrics.test.ts`
Expected: FAIL — 404 ทุกตัว

- [ ] **Step 3: เขียน `src/worker/lyrics.ts`**

```ts
import type { Context } from 'hono';
import { kieGenerateLyrics, kiePollLyrics, validateLyricsPrompt } from './kie';
import type { Env } from './types';

const err = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * kie ยัดหลายกรณีไว้ใต้ code 400 เดียวกัน แยกได้จากข้อความเท่านั้น
 * ทุกข้อความที่คืนออกไปต้องบอกผู้ใช้ว่าทำอะไรต่อได้ ไม่ใช่แค่บอกว่าพัง
 */
export function toThaiLyricsError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('artist name')) {
    return 'เอาชื่อศิลปินออกจากคำอธิบายก่อน แล้วบอกเป็นแนวเพลงหรืออารมณ์แทน';
  }
  if (s.includes('moderation') || s.includes('sensitive')) {
    return 'คำอธิบายนี้ถูกระบบกรองไว้ ลองเขียนใหม่ให้ต่างจากเดิม';
  }
  if (s.includes('unable to generate') || s.includes('rephrasing')) {
    return 'คำอธิบายกว้างไป ลองบอกธีม อารมณ์ หรือเรื่องราวให้ชัดขึ้น';
  }
  return `แต่งเนื้อเพลงไม่สำเร็จ: ${raw}`;
}

/** POST /api/lyrics — เริ่มงานแต่งเนื้อเพลง ไม่แตะฐานข้อมูลเพราะงานอายุสั้น */
export async function createLyrics(ctx: Context<{ Bindings: Env }>) {
  let body: { prompt?: unknown };
  try {
    body = (await ctx.req.json()) as typeof body;
  } catch {
    return ctx.json({ error: 'invalid JSON body' }, 400);
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  const validation = validateLyricsPrompt(prompt);
  if (validation) {
    return ctx.json({ error: validation.replace('prompt', 'คำอธิบาย') }, 400);
  }

  try {
    const taskId = await kieGenerateLyrics(ctx.env, prompt);
    return ctx.json({ taskId }, 201);
  } catch (e) {
    return ctx.json({ error: toThaiLyricsError(err(e)) }, 502);
  }
}

/** GET /api/lyrics/:taskId — ถามสถานะงานแต่งเนื้อเพลง */
export async function getLyrics(ctx: Context<{ Bindings: Env }>) {
  const taskId = ctx.req.param('taskId');
  const poll = await kiePollLyrics(ctx.env, taskId);

  if (poll.kind === 'SUCCESS') return ctx.json({ status: 'SUCCESS', variants: poll.variants });
  if (poll.kind === 'FAILED') {
    return ctx.json({ status: 'FAILED', error: toThaiLyricsError(poll.error) });
  }
  if (poll.kind === 'TRANSIENT') return ctx.json({ status: 'PENDING', transient: true });
  return ctx.json({ status: 'PENDING' });
}
```

> `SENSITIVE_WORD_ERROR` ที่ไม่มี `errorMessage` จะกลายเป็นข้อความ
> `kie lyrics task SENSITIVE_WORD_ERROR` ซึ่ง `toThaiLyricsError` จับได้จากคำว่า `sensitive`

- [ ] **Step 4: ผูกเส้นทาง**

ใน `src/worker/index.ts` เพิ่ม import แล้วสองบรรทัด:

```ts
import { createLyrics, getLyrics } from './lyrics';
// ...
app.post('/api/lyrics', createLyrics);
app.get('/api/lyrics/:taskId', getLyrics);
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `npx vitest run tests/lyrics.test.ts`
Expected: PASS ทั้ง 10 ตัว

- [ ] **Step 6: รันทั้งชุด**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/worker/lyrics.ts src/worker/index.ts tests/lyrics.test.ts
git commit -m "feat(api): AI lyrics generation routes

kie ยัดหลายกรณีไว้ใต้ code 400 เดียวกัน แยกจากข้อความแล้วแปลงเป็นภาษาไทย
ที่บอกวิธีแก้ ไม่ใช่โยน msg ดิบออกจอ

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 7: ยกเครื่อง persona

**Files:**
- Modify: `src/worker/kie.ts` (`CreatePersonaInput`, `kieCreatePersona`)
- Modify: `src/worker/personas.ts`
- Test: `tests/personas.test.ts`, `tests/kie.test.ts`

**Interfaces:**
- Consumes: `PERSONA_CAPABLE_MODELS` จาก Task 2
- Produces:
  ```ts
  export interface CreatePersonaInput {
    taskId: string; audioId: string; name: string; description: string;
    vocalStart?: number; vocalEnd?: number; style?: string;
  }
  export function validatePersonaSegment(start: number, end: number, duration: number | null): string | null
  ```

- [ ] **Step 1: เขียนเทสต์ของช่วงวิเคราะห์ที่ต้องพัง**

เพิ่มใน `tests/kie.test.ts`:

```ts
import { validatePersonaSegment } from '../src/worker/kie';

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
```

- [ ] **Step 2: รันให้เห็นว่าพัง**

Run: `npx vitest run tests/kie.test.ts -t "validatePersonaSegment"`
Expected: FAIL — import ไม่เจอ

- [ ] **Step 3: เขียน `validatePersonaSegment` และขยาย `CreatePersonaInput`**

ใน `src/worker/kie.ts` แทน interface `CreatePersonaInput` เดิม (บรรทัด 177-182) ด้วย:

```ts
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
```

แล้วใน `kieCreatePersona` เปลี่ยนจากการส่ง `input` ทั้งก้อน เป็นการประกอบ body เอง:

```ts
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
  // ...ส่วนที่เหลือคงเดิมทุกบรรทัด
}
```

- [ ] **Step 4: รันเทสต์ของ segment ให้ผ่าน**

Run: `npx vitest run tests/kie.test.ts -t "validatePersonaSegment"`
Expected: PASS ทั้ง 8 ตัว

- [ ] **Step 5: เขียนเทสต์ของเส้นทาง persona ที่ต้องพัง**

เพิ่มใน `tests/personas.test.ts`:

```ts
describe('POST /api/personas — กฎที่ kie บังคับ', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('ตอบ 409 เมื่อเพลงนี้ทำ persona ไปแล้ว โดยไม่ยิง kie ซ้ำ', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    const fetchMock = stubPersonaOk();
    vi.stubGlobal('fetch', fetchMock);

    const first = await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env);
    expect(first.status).toBe(201);

    const second = await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, name: 'ชื่ออื่น' }),
    }, env);

    expect(second.status).toBe(409);
    const out = await second.json() as { error: string };
    expect(out.error).toContain('เสียงฝน');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ตอบ 400 เมื่อเพลงเป็นโมเดล V3_5 ที่ kie ไม่รองรับ', async () => {
    const { env } = makeEnv([songRow({ model: 'V3_5' }) as never]);
    const cookie = await cookieFor(env);
    const fetchMock = stubPersonaOk();
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env);

    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toContain('V3_5');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ส่ง vocalStart, vocalEnd และ style ต่อให้ kie', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    const fetchMock = stubPersonaOk();
    vi.stubGlobal('fetch', fetchMock);

    await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, vocalStart: 12.5, vocalEnd: 32.5, style: 'Dream Pop' }),
    }, env);

    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.vocalStart).toBe(12.5);
    expect(sent.vocalEnd).toBe(32.5);
    expect(sent.style).toBe('Dream Pop');
  });

  it('ใช้ช่วงตั้งต้น 0-30 เมื่อไม่ได้ระบุมา', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    const fetchMock = stubPersonaOk();
    vi.stubGlobal('fetch', fetchMock);

    await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env);

    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.vocalStart).toBe(0);
    expect(sent.vocalEnd).toBe(30);
  });

  it('ตอบ 400 เมื่อช่วงที่เลือกสั้นกว่า 10 วินาที', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    const fetchMock = stubPersonaOk();
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, vocalStart: 0, vocalEnd: 5 }),
    }, env);

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('แปลง 409 ที่มาจาก kie เป็นข้อความไทย', async () => {
    const { env } = makeEnv([songRow() as never]);
    const cookie = await cookieFor(env);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 409, msg: 'Persona already exists for this music' }),
    }));

    const res = await app.request('/api/personas', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, env);

    expect(res.status).toBe(409);
    expect((await res.json() as { error: string }).error).toContain('เพลงนี้ทำ persona ไปแล้ว');
  });
});
```

- [ ] **Step 6: ให้ fake D1 รองรับการถาม personas ด้วย song_id**

ใน `tests/fakes.ts` ภายใน `prepare()` เพิ่มตัวแปรและแก้ `first`:

```ts
      const isPersonaBySong = isPersonas && S.includes('SONG_ID = ?');
```

แล้วเปลี่ยนบรรทัด `first: async () => find(args[0] as string) ?? null,` เป็น:

```ts
            first: async () =>
              isPersonaBySong
                ? personas.find((p) => p.song_id === (args[0] as string)) ?? null
                : find(args[0] as string) ?? null,
```

- [ ] **Step 7: รันให้เห็นว่าพัง**

Run: `npx vitest run tests/personas.test.ts -t "กฎที่ kie บังคับ"`
Expected: FAIL — ตัวแรกได้ 201 แทน 409

- [ ] **Step 8: แก้ `personas.ts`**

ใน `src/worker/personas.ts` แก้ `createPersona` — เพิ่ม import และแทรกตรรกะใหม่หลังจากหาแถวเพลงเจอ:

```ts
import { kieCreatePersona, validatePersonaSegment, PERSONA_SEGMENT_MAX } from './kie';
```

แล้วในตัวฟังก์ชัน หลังบล็อกที่เช็ค `audioId` ให้แทรก:

```ts
  // kie ไม่รองรับ persona ของโมเดล V3_5
  if (song.model === 'V3_5') {
    return ctx.json({ error: 'เพลงโมเดล V3_5 ทำ persona ไม่ได้ (kie ไม่รองรับ)' }, 400);
  }

  // หนึ่งแทร็กทำ persona ได้ครั้งเดียว — กันตั้งแต่ที่นี่ จะได้ไม่เสีย request ให้ kie
  const existing = await ctx.env.DB
    .prepare('SELECT * FROM personas WHERE song_id = ?')
    .bind(songId).first<Record<string, unknown> | null>();
  if (existing) {
    return ctx.json(
      { error: `เพลงนี้ทำ persona ไปแล้วในชื่อ “${existing.name as string}”` },
      409,
    );
  }

  // ช่วงที่ให้ kie วิเคราะห์ — ตั้งต้น 0 ถึง 30 วินาทีตามค่าเริ่มต้นของ kie
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const vocalStart = num(body.vocalStart, 0);
  const vocalEnd = num(body.vocalEnd, PERSONA_SEGMENT_MAX);
  const duration = typeof song.duration === 'number' ? song.duration : null;
  const segmentError = validatePersonaSegment(vocalStart, vocalEnd, duration);
  if (segmentError) return ctx.json({ error: segmentError }, 400);

  const style = trimmed(body.style);
```

ขยาย type ของ `body` ที่หัวฟังก์ชัน:

```ts
  let body: {
    songId?: unknown; name?: unknown; description?: unknown;
    vocalStart?: unknown; vocalEnd?: unknown; style?: unknown;
  };
```

ส่งค่าใหม่เข้า `kieCreatePersona`:

```ts
    personaId = await kieCreatePersona(ctx.env, {
      taskId: song.task_id as string,
      audioId,
      name,
      description,
      vocalStart,
      vocalEnd,
      ...(style ? { style } : {}),
    });
```

และแปลง error ของ kie ก่อนตอบ — แทนบล็อก `catch` เดิม:

```ts
  } catch (e) {
    const raw = err(e);
    if (raw.includes('code 409')) {
      return ctx.json({ error: 'เพลงนี้ทำ persona ไปแล้ว (ฝั่ง kie แจ้งว่าซ้ำ)' }, 409);
    }
    return ctx.json({ error: raw }, 502);
  }
```

- [ ] **Step 9: รันเทสต์ให้ผ่าน**

Run: `npx vitest run tests/personas.test.ts`
Expected: PASS ทั้งไฟล์ รวมเทสต์เดิม

- [ ] **Step 10: รันทั้งชุด**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/worker/kie.ts src/worker/personas.ts tests/personas.test.ts tests/kie.test.ts tests/fakes.ts
git commit -m "fix(persona): enforce kie rules and send the analysis window

หนึ่ง audioId ทำ persona ได้ครั้งเดียว และ V3_5 ไม่รองรับ — ทั้งสองข้อกันที่
ฝั่งเราก่อนเสีย request ให้ kie พร้อมส่ง vocalStart/vocalEnd/style ที่เดิมไม่เคยส่ง

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 8: จานสีและตัวอักษรชุดใหม่

ทำก่อนรื้อ layout เพื่อให้เห็นผลของสีบนโครงเดิมและแยกสาเหตุได้ถ้ามีอะไรเพี้ยน

**Files:**
- Modify: `web/index.css`
- Test: ตรวจด้วยตาในเบราว์เซอร์ (CSS ไม่มี unit test ในโปรเจกต์นี้)

**Interfaces:**
- Consumes: ไม่มี
- Produces: CSS custom properties ที่ทุก component ใช้ต่อ — `--ground`, `--surface`, `--surface-2`, `--surface-hover`, `--ink`, `--ink-2`, `--ink-3`, `--grape`, `--grape-soft`, `--grape-text`, `--pink`, `--pink-soft`, `--line`, `--line-strong`, `--danger`, `--ok`, `--radius`, `--ease`

- [ ] **Step 1: แทนบล็อก `:root` และ import ฟอนต์**

ใน `web/index.css` แทนบรรทัด 1 และบล็อก `:root { ... }` (บรรทัด 10-36) ทั้งก้อนด้วย:

```css
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Anuphan:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
@import 'tailwindcss';

/* ============================================================
   Song-Auto Design System v4 — "Grape Light"
   พื้นสว่างอมม่วง ปกเพลงเป็นตัวเดินสี chrome อยู่เงียบ ๆ
   ม่วง = การกระทำของระบบ · ชมพู = สิ่งที่ AI แต่งให้
   ทุกคู่ที่ใช้กับตัวหนังสือผ่าน WCAG AA (>= 4.5:1)
   ============================================================ */

:root {
  /* พื้นผิว */
  --ground: #faf7ff;
  --surface: #ffffff;
  --surface-2: #f3edfd;
  --surface-hover: #ebe2fb;

  /* ตัวหนังสือ */
  --ink: #17122b;        /* 17.11 บนพื้น · 18.14 บนการ์ด */
  --ink-2: #4a4363;      /* 8.71 บนพื้น */
  --ink-3: #6e6690;      /* 5.00 บนพื้น · 5.29 บนการ์ด — เดิม #7c7c85 ได้ 4.37 ซึ่งตกเกณฑ์ */

  /* สีหลัก — การกระทำของระบบ */
  --grape: #6d28d9;      /* ตัวขาวบนปุ่มได้ 7.10 */
  --grape-soft: #ede4fe;
  --grape-text: #5b21b6;

  /* สีรอง — เฉพาะสิ่งที่ AI แต่งให้ (เนื้อเพลง, persona) */
  --pink: #be185d;       /* ตัวขาวบนสีได้ 6.04 */
  --pink-soft: #fce4ef;

  /* เส้น */
  --line: #e7dcfb;
  --line-strong: #d3c2f2;

  /* สถานะ */
  --danger: #dc2626;     /* 4.56 บนพื้น */
  --danger-soft: #fee9e9;
  --ok: #047857;         /* 5.17 บนพื้น */

  --radius: 18px;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);

  --font-display: 'Chakra Petch', 'Anuphan', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Anuphan', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

- [ ] **Step 2: แก้ `body` ให้ใช้ token ใหม่และ line-height ของภาษาไทย**

แทนบล็อก `body { ... }` (บรรทัด 44-49) ด้วย:

```css
body {
  background: var(--ground);
  color: var(--ink);
  font-family: var(--font-body);
  /* ไทยต้องการ line-height สูงกว่าอังกฤษ เพราะสระบนกับวรรณยุกต์ซ้อนกันสองชั้น
     ค่า 1.5 แบบที่ใช้กับอังกฤษทำให้วรรณยุกต์ชนบรรทัดบน */
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, .font-display {
  font-family: var(--font-display);
  line-height: 1.45;
}

.tabular-nums, .mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: แทนชื่อ token เดิมทั่วทั้งไฟล์**

ใน `web/index.css` แทนทุกที่ที่อ้าง token เดิม:

| เดิม | ใหม่ |
|------|------|
| `var(--bg)` | `var(--ground)` |
| `var(--text)` | `var(--ink)` |
| `var(--text-2)` | `var(--ink-2)` |
| `var(--text-3)` | `var(--ink-3)` |
| `var(--accent)` | `var(--grape)` |
| `var(--accent-dim)` | `var(--grape-soft)` |
| `var(--accent-text)` | `var(--grape-text)` |
| `var(--border)` | `var(--line)` |
| `var(--border-strong)` | `var(--line-strong)` |

และแก้สามจุดที่ฝังค่าสีตรง ๆ ไว้:

```css
/* .btn-primary — ตัวหนังสือบนปุ่มม่วงต้องเป็นขาว ไม่ใช่เขียวเข้มของธีมเดิม */
.btn-primary {
  color: #ffffff;
}

/* .card — บนพื้นสว่างต้องมีเงาอ่อน ๆ ไม่งั้นการ์ดขาวจมหายไปกับพื้น */
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 1px 2px rgba(23, 18, 43, 0.05);
}

/* .shimmer — เส้นแสงต้องเป็นสีเข้มบนพื้นสว่าง ไม่ใช่ขาวโปร่ง */
.shimmer {
  background-image: linear-gradient(
    100deg,
    transparent 20%,
    rgba(23, 18, 43, 0.07) 50%,
    transparent 80%
  );
}
```

- [ ] **Step 4: แก้สีที่ฝังไว้ใน component**

ไล่แทนที่ทุกจุดที่เขียนสีตรง ๆ ในไฟล์ TSX:

| ไฟล์ | เดิม | ใหม่ |
|------|------|------|
| `CreatePanel.tsx:84,178,188` | `accent-[#22c55e]` | `accent-[#6d28d9]` |
| `CreatePanel.tsx:215` | `rgba(239,68,68,0.1)` / `#f87171` | `var(--danger-soft)` / `var(--danger)` |
| `SongCard.tsx:90` | `background: 'var(--accent)', color: '#052e12'` | `background: 'var(--grape)', color: '#ffffff'` |
| `SongCard.tsx:148,182` | `#f87171` | `var(--danger)` |
| `SongCard.tsx:113,131` | `rgba(0,0,0,0.55)` | `rgba(23,18,43,0.62)` |
| `SongCard.tsx:86` | `rgba(0,0,0,0.45)` | `rgba(23,18,43,0.5)` |

ค้นให้ครบด้วย:

```bash
grep -rn "22c55e\|052e12\|f87171\|--accent\|--text-\|--border\|--bg)" web/
```

ทุกบรรทัดที่ขึ้นต้องถูกแทนหมด

- [ ] **Step 5: ดูของจริง**

```bash
npm run dev
```
เปิด `http://localhost:5173` แล้วตรวจ:
- พื้นหลังเป็นขาวอมม่วง ไม่ใช่ดำ
- ปุ่ม Create song เป็นม่วงตัวหนังสือขาว
- ข้อความไทยทุกจุดเป็นฟอนต์ Anuphan (วรรณยุกต์ไม่ชนบรรทัดบน)
- ไม่มีตัวหนังสือจุดไหนที่จางจนอ่านไม่ออก
- การ์ดเพลงยังแยกจากพื้นได้ด้วยเงาอ่อน

- [ ] **Step 6: Commit**

```bash
git add web/index.css web/components/
git commit -m "feat(web): new light grape palette and Thai-capable fonts

ของเดิมโหลดแค่ Inter ที่ไม่มีอักขระไทย ข้อความไทยทุกบรรทัดจึงตกไปใช้ฟอนต์ระบบ
และ --text-3 บน surface ได้คอนทราสต์ 4.37 ซึ่งต่ำกว่าเกณฑ์ AA ทั้งที่ใช้กับ
แนวเพลง ตัวนับอักษร และ placeholder ทั้งแอป

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 9: ชั้นเรียก API ฝั่งหน้าเว็บ

**Files:**
- Modify: `web/lib/api.ts`
- Test: `tests/api-client.test.ts` (สร้าง)

**Interfaces:**
- Consumes: `SongRow` จาก Task 1 (ฝั่ง worker) — ฝั่งหน้าเว็บมี `Song` ของตัวเองที่ต้องตรงกัน
- Produces:
  ```ts
  export interface Song { /* ...ของเดิม... */ parentSongId: string | null; continueAt: number | null }
  export interface LyricsVariant { title: string; text: string }
  export interface ExtendBody {
    defaultParamFlag: boolean;
    continueAt?: number; prompt?: string; style?: string; title?: string;
    negativeTags?: string; personaId?: string; personaModel?: 'style_persona' | 'voice_persona';
  }
  export const LYRICS_PROMPT_MAX = 200;
  export const PERSONA_SEGMENT_MIN = 10;
  export const PERSONA_SEGMENT_MAX = 30;
  export const extendSong: (songId: string, body: ExtendBody) => Promise<{ songs: Song[] }>
  export const startLyrics: (prompt: string) => Promise<{ taskId: string }>
  export const pollLyrics: (taskId: string) => Promise<LyricsPollResult>
  export const defaultPersonaWindow: (duration: number | null) => { start: number; end: number }
  export const canExtend: (s: Song) => boolean
  export const canPersona: (s: Song) => boolean
  export const personaBlockReason: (s: Song) => string | null
  ```

- [ ] **Step 1: เขียนเทสต์ของฟังก์ชันบริสุทธิ์ที่ต้องพัง**

สร้าง `tests/api-client.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  defaultPersonaWindow, canExtend, canPersona, personaBlockReason, type Song,
} from '../web/lib/api';

const song = (over: Partial<Song> = {}): Song => ({
  id: 's1', taskId: 't1', title: 'สายฝน', prompt: '', style: 'dream pop', tags: 'calm',
  model: 'V5', instrumental: 0, status: 'SUCCESS', error: null, r2Key: 's1.mp3',
  imageKey: null, duration: 100, createdAt: '2026-09-09T00:00:00.000Z', sunoId: 'a1',
  variant: 1, parentSongId: null, continueAt: null, ...over,
});

describe('defaultPersonaWindow', () => {
  it('เพลงยาวพอ ได้ช่วง 0 ถึง 30', () => {
    expect(defaultPersonaWindow(100)).toEqual({ start: 0, end: 30 });
  });

  it('เพลงสั้นกว่า 30 วินาที ใช้ทั้งเพลง', () => {
    expect(defaultPersonaWindow(22)).toEqual({ start: 0, end: 22 });
  });

  it('ไม่รู้ความยาว ใช้ค่าตั้งต้นของ kie', () => {
    expect(defaultPersonaWindow(null)).toEqual({ start: 0, end: 30 });
  });

  it('เพลงสั้นกว่าช่วงต่ำสุด 10 วินาที ยังคืนทั้งเพลง (ให้ฝั่ง server ปฏิเสธ)', () => {
    expect(defaultPersonaWindow(6)).toEqual({ start: 0, end: 6 });
  });
});

describe('canExtend', () => {
  it('เพลงที่สำเร็จและมี sunoId ต่อได้', () => {
    expect(canExtend(song())).toBe(true);
  });

  it('เพลงที่ยังไม่สำเร็จ ต่อไม่ได้', () => {
    expect(canExtend(song({ status: 'PENDING' }))).toBe(false);
  });

  it('เพลงที่ไม่มี sunoId ต่อไม่ได้', () => {
    expect(canExtend(song({ sunoId: null }))).toBe(false);
  });
});

describe('canPersona / personaBlockReason', () => {
  it('เพลง V5 ที่มี sunoId ทำ persona ได้ และไม่มีเหตุผลขัดขวาง', () => {
    expect(canPersona(song())).toBe(true);
    expect(personaBlockReason(song())).toBeNull();
  });

  it('เพลง V3_5 ทำไม่ได้ พร้อมบอกเหตุผล', () => {
    const s = song({ model: 'V3_5' });
    expect(canPersona(s)).toBe(false);
    expect(personaBlockReason(s)).toContain('V3_5');
  });

  it('เพลงที่ไม่มี sunoId ทำไม่ได้ พร้อมบอกเหตุผลที่ผู้ใช้เข้าใจได้', () => {
    const s = song({ sunoId: null });
    expect(canPersona(s)).toBe(false);
    expect(personaBlockReason(s)).toContain('รหัสแทร็ก');
  });

  it('เพลงที่ยังสร้างไม่เสร็จ ทำไม่ได้', () => {
    expect(canPersona(song({ status: 'PENDING' }))).toBe(false);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าพัง**

Run: `npx vitest run tests/api-client.test.ts`
Expected: FAIL — import ไม่เจอ

- [ ] **Step 3: เพิ่มชนิดข้อมูลและฟังก์ชันใน `web/lib/api.ts`**

แก้ interface `Song` เพิ่มสองฟิลด์ท้าย:

```ts
export interface Song {
  // ...ฟิลด์เดิมทั้งหมด...
  variant: number;
  parentSongId: string | null;
  continueAt: number | null;
}
```

แล้วเพิ่มท้ายไฟล์:

```ts
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
  if (s.status !== 'SUCCESS') return 'รอเพลงสร้างเสร็จก่อน';
  if (!s.sunoId) return 'เพลงนี้สร้างก่อนระบบเก็บรหัสแทร็ก จึงทำ persona ไม่ได้';
  if (s.model === 'V3_5') return 'เพลงโมเดล V3_5 ทำ persona ไม่ได้';
  return null;
};
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run tests/api-client.test.ts`
Expected: PASS ทั้ง 12 ตัว

- [ ] **Step 5: รันทั้งชุดแล้ว typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS — ถ้า tsc บ่นว่าที่อื่นสร้าง `Song` ไม่ครบฟิลด์ ให้เติม `parentSongId: null, continueAt: null` ที่จุดนั้น

- [ ] **Step 6: Commit**

```bash
git add web/lib/api.ts tests/api-client.test.ts
git commit -m "feat(web): API client for extend and lyrics, plus capability helpers

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 10: ให้ AI แต่งเนื้อเพลง

**Files:**
- Create: `web/hooks/useLyrics.ts`
- Create: `web/components/LyricsAssist.tsx`
- Modify: `web/components/CreatePanel.tsx`
- Modify: `web/index.css`

**Interfaces:**
- Consumes: `startLyrics`, `pollLyrics`, `LyricsVariant`, `LYRICS_PROMPT_MAX` จาก Task 9
- Produces:
  ```ts
  // useLyrics.ts
  export function useLyrics(): {
    state: 'idle' | 'working' | 'done' | 'error';
    variants: LyricsVariant[];
    error: string | null;
    start: (prompt: string) => void;
    reset: () => void;
  }
  // LyricsAssist.tsx
  export function LyricsAssist(props: { onPick: (v: LyricsVariant) => void; onClose: () => void }): JSX.Element
  ```

- [ ] **Step 1: เขียน `web/hooks/useLyrics.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { pollLyrics, startLyrics, type LyricsVariant } from '../lib/api';

const POLL_INTERVAL_MS = 3_000;
const GIVE_UP_MS = 90_000;

type State = 'idle' | 'working' | 'done' | 'error';

/**
 * งานแต่งเนื้อเพลงมีอายุสั้นและไม่ถูกเก็บลงฐานข้อมูล ปิดแท็บกลางคันแล้วงานหายไปเฉย ๆ
 * ซึ่งยอมรับได้เพราะยิงใหม่ได้ทันที — เลิกถามเมื่อครบ 90 วินาที
 */
export function useLyrics() {
  const [state, setState] = useState<State>('idle');
  const [variants, setVariants] = useState<LyricsVariant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setState('idle');
    setVariants([]);
    setError(null);
  }, [stop]);

  const start = useCallback((prompt: string) => {
    stop();
    setState('working');
    setVariants([]);
    setError(null);
    startedAt.current = Date.now();

    void startLyrics(prompt)
      .then(({ taskId }) => {
        timer.current = setInterval(() => {
          if (Date.now() - startedAt.current > GIVE_UP_MS) {
            stop();
            setState('error');
            setError('รอนานเกินไป ลองกดแต่งใหม่อีกครั้ง');
            return;
          }
          void pollLyrics(taskId)
            .then((res) => {
              if (res.status === 'SUCCESS') {
                stop();
                setVariants(res.variants);
                setState(res.variants.length > 0 ? 'done' : 'error');
                if (res.variants.length === 0) setError('ไม่ได้เนื้อเพลงกลับมา ลองใหม่อีกครั้ง');
              } else if (res.status === 'FAILED') {
                stop();
                setState('error');
                setError(res.error);
              }
              // PENDING — รอบหน้าถามใหม่
            })
            .catch(() => {
              /* ชั่วคราว — รอบหน้าถามใหม่ */
            });
        }, POLL_INTERVAL_MS);
      })
      .catch((e: unknown) => {
        setState('error');
        setError(e instanceof Error ? e.message : 'เริ่มงานแต่งเนื้อเพลงไม่สำเร็จ');
      });
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { state, variants, error, start, reset };
}
```

- [ ] **Step 2: เขียน `web/components/LyricsAssist.tsx`**

```tsx
import { useState } from 'react';
import { LYRICS_PROMPT_MAX, type LyricsVariant } from '../lib/api';
import { useLyrics } from '../hooks/useLyrics';
import { SpinnerIcon } from './icons';

interface Props {
  onPick: (variant: LyricsVariant) => void;
  onClose: () => void;
}

export function LyricsAssist({ onPick, onClose }: Props) {
  const [prompt, setPrompt] = useState('');
  const { state, variants, error, start, reset } = useLyrics();
  const busy = state === 'working';

  return (
    <div className="assist-panel">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="lyrics-brief" className="field-label" style={{ marginBottom: 0 }}>
          บอกธีมสั้น ๆ แล้วให้ AI แต่งให้
        </label>
        <span className="text-xs tabular-nums" style={{ color: 'var(--ink-3)' }}>
          {prompt.length} / {LYRICS_PROMPT_MAX}
        </span>
      </div>

      <textarea
        id="lyrics-brief"
        className="input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        maxLength={LYRICS_PROMPT_MAX}
        rows={2}
        disabled={busy}
        placeholder="เพลงคิดถึงบ้าน คนทำงานกรุงเทพ กลับต่างจังหวัดปีละครั้ง"
      />

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {state === 'done' && (
        <ul className="assist-list">
          {variants.map((v, i) => (
            <li key={`${v.title}-${i}`}>
              <button
                type="button"
                className="assist-option"
                onClick={() => { onPick(v); onClose(); }}
              >
                <span className="assist-option-title">{v.title || 'ไม่มีชื่อ'}</span>
                <span className="assist-option-body">{v.text.slice(0, 160)}…</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-assist"
          disabled={busy || !prompt.trim()}
          onClick={() => start(prompt)}
        >
          {busy ? (
            <><SpinnerIcon className="h-4 w-4 animate-spin" /> กำลังแต่ง…</>
          ) : state === 'done' ? 'แต่งใหม่อีกชุด' : 'แต่งเนื้อเพลง'}
        </button>
        <button
          type="button"
          className="cursor-pointer text-sm"
          style={{ color: 'var(--ink-3)' }}
          onClick={() => { reset(); onClose(); }}
        >
          ปิด
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: เพิ่มสไตล์ของแผงนี้ใน `web/index.css`**

เพิ่มท้ายไฟล์:

```css
/* แผงให้ AI แต่งเนื้อเพลง — ชมพูคือสีของสิ่งที่เครื่องแต่งให้ */
.assist-panel {
  margin-top: 10px;
  padding: 14px;
  border: 1px solid var(--pink-soft);
  border-left: 3px solid var(--pink);
  border-radius: 12px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.btn-assist {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding-inline: 16px;
  border-radius: 10px;
  background: var(--pink);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 150ms ease, transform 150ms var(--ease);
}
.btn-assist:hover:not(:disabled) { filter: brightness(1.08); }
.btn-assist:active:not(:disabled) { transform: scale(0.98); }
.btn-assist:disabled {
  background: var(--surface-2);
  color: var(--ink-3);
  cursor: not-allowed;
}
.assist-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}
.assist-option {
  width: 100%;
  text-align: start;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
  transition: border-color 160ms var(--ease), background-color 160ms var(--ease);
}
.assist-option:hover {
  border-color: var(--pink);
  background: var(--pink-soft);
}
.assist-option-title { font-size: 14px; font-weight: 600; }
.assist-option-body {
  font-size: 13px;
  color: var(--ink-3);
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* ปุ่มเรียกแผงแต่งเนื้อ ที่อยู่ข้างหัวข้อ Lyrics */
.assist-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--pink-soft);
  color: var(--pink);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 150ms ease;
}
.assist-trigger:hover { filter: brightness(0.96); }
```

- [ ] **Step 4: ต่อปุ่มเข้ากับ `CreatePanel.tsx`**

เพิ่ม state และ import:

```tsx
import { LyricsAssist } from './LyricsAssist';
// ...
const [assistOpen, setAssistOpen] = useState(false);
```

แล้วแทนบล็อกหัวข้อ Lyrics (บรรทัด 92-97) ด้วย:

```tsx
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label htmlFor="lyrics" className="field-label" style={{ marginBottom: 0 }}>เนื้อเพลง</label>
            <div className="flex items-baseline gap-3">
              <button
                type="button"
                className="assist-trigger"
                aria-expanded={assistOpen}
                onClick={() => setAssistOpen((v) => !v)}
              >
                ✦ ให้ AI แต่ง
              </button>
              <span className="text-xs tabular-nums" style={{ color: 'var(--ink-3)' }}>
                {lyrics.length.toLocaleString()} / {LYRICS_MAX.toLocaleString()}
              </span>
            </div>
          </div>
```

และเพิ่มแผงใต้ `<textarea id="lyrics" …/>` ภายใน `{!instrumental && (...)}` ก้อนเดิม:

```tsx
          {assistOpen && (
            <LyricsAssist
              onClose={() => setAssistOpen(false)}
              onPick={(v) => {
                set('lyrics', v.text);
                // เติมชื่อเพลงให้ด้วยถ้ายังไม่ได้ตั้งเอง
                if (!title.trim() && v.title) set('title', v.title.slice(0, TITLE_MAX));
              }}
            />
          )}
```

- [ ] **Step 5: ตรวจในเบราว์เซอร์**

```bash
npm run dev
```
- กดปุ่ม "✦ ให้ AI แต่ง" แล้วแผงชมพูกางออก
- ตัวนับหยุดที่ 200
- ปุ่ม "แต่งเนื้อเพลง" กดไม่ได้ตอนช่องว่าง
- ถ้ายังไม่มี `KIE_API_KEY` ใน `.dev.vars` จะเห็น error กลับมาแทนผลลัพธ์ ซึ่งถูกต้อง —
  ให้ตรวจว่าข้อความ error เป็นภาษาไทยและอ่านรู้เรื่อง

- [ ] **Step 6: typecheck แล้ว commit**

```bash
npx tsc --noEmit
git add web/hooks/useLyrics.ts web/components/LyricsAssist.tsx web/components/CreatePanel.tsx web/index.css
git commit -m "feat(web): AI lyrics assistant in the create form

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 11: แผงต่อเพลง

**Files:**
- Create: `web/components/ExtendPanel.tsx`
- Modify: `web/index.css`

**Interfaces:**
- Consumes: `extendSong`, `ExtendBody`, `Song` จาก Task 9 · `fmtDuration` จาก `api.ts`
- Produces:
  ```ts
  export function ExtendPanel(props: {
    song: Song;
    onCreated: (songs: Song[]) => void;
    onClose: () => void;
  }): JSX.Element
  ```

- [ ] **Step 1: เขียน `web/components/ExtendPanel.tsx`**

```tsx
import { useState } from 'react';
import { extendSong, fmtDuration, type ExtendBody, type Song } from '../lib/api';
import { SpinnerIcon } from './icons';

interface Props {
  song: Song;
  onCreated: (songs: Song[]) => void;
  onClose: () => void;
}

/** จุดต่อตั้งต้น: 80% ของเพลง หรือ 30 วินาทีถ้าไม่รู้ความยาว */
const defaultContinueAt = (duration: number | null): number => {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 1) return 30;
  return Math.round(duration * 0.8 * 10) / 10;
};

export function ExtendPanel({ song, onCreated, onClose }: Props) {
  const [custom, setCustom] = useState(false);
  const [continueAt, setContinueAt] = useState(() => defaultContinueAt(song.duration));
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(song.style || song.tags || '');
  const [title, setTitle] = useState(song.title ? `${song.title} (ต่อ)` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const instrumental = song.instrumental === 1;
  const max = typeof song.duration === 'number' ? song.duration : 0;
  const ready = custom
    ? Boolean(style.trim() && title.trim() && (instrumental || prompt.trim()) && continueAt > 0)
    : true;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: ExtendBody = custom
        ? {
            defaultParamFlag: true,
            continueAt,
            style,
            title,
            ...(instrumental ? {} : { prompt }),
          }
        : { defaultParamFlag: false };
      const out = await extendSong(song.id, body);
      onCreated(out.songs);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ต่อเพลงไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detail-panel">
      <h4 className="detail-panel-title">ต่อเพลงนี้</h4>
      <p className="detail-panel-note">
        ได้เพลงใหม่สองเวอร์ชันในคลัง โมเดลใช้ {song.model} ตามเพลงต้นทาง เปลี่ยนไม่ได้
      </p>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm" style={{ color: 'var(--ink-2)' }}>
        <input
          type="checkbox"
          checked={custom}
          onChange={(e) => setCustom(e.target.checked)}
          className="h-4 w-4 accent-[#6d28d9]"
        />
        ปรับเอง (ไม่งั้นใช้ค่าเดิมของเพลงต้นทาง)
      </label>

      {custom && (
        <>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor={`at-${song.id}`} className="field-label" style={{ marginBottom: 0 }}>
                ต่อจากวินาทีที่
              </label>
              <span className="text-xs tabular-nums" style={{ color: 'var(--ink-3)' }}>
                {fmtDuration(continueAt)} / {fmtDuration(song.duration)}
              </span>
            </div>
            <input
              id={`at-${song.id}`}
              type="range"
              min={1}
              max={max > 1 ? Math.floor(max - 1) : 300}
              step={0.5}
              value={continueAt}
              onChange={(e) => setContinueAt(Number(e.target.value))}
              className="w-full accent-[#6d28d9]"
            />
          </div>

          {!instrumental && (
            <div>
              <label htmlFor={`p-${song.id}`} className="field-label">ให้ต่อไปทางไหน</label>
              <textarea
                id={`p-${song.id}`}
                className="input"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="ค่อย ๆ เบาลง แล้วจบด้วยเปียโนตัวเดียว"
              />
            </div>
          )}

          <div>
            <label htmlFor={`s-${song.id}`} className="field-label">แนวเพลง</label>
            <input id={`s-${song.id}`} className="input" value={style}
              onChange={(e) => setStyle(e.target.value)} maxLength={1000} />
          </div>

          <div>
            <label htmlFor={`t-${song.id}`} className="field-label">ชื่อเพลงใหม่</label>
            <input id={`t-${song.id}`} className="input" value={title}
              onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" className="btn-primary" style={{ minHeight: 40, fontSize: 14 }}
          disabled={busy || !ready} onClick={() => void submit()}>
          {busy ? (<><SpinnerIcon className="h-4 w-4 animate-spin" /> กำลังส่ง…</>) : 'ต่อเพลง'}
        </button>
        <button type="button" className="cursor-pointer text-sm" style={{ color: 'var(--ink-3)' }}
          onClick={onClose}>
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: เพิ่มสไตล์ของแผงย่อยในแผงรายละเอียด**

เพิ่มท้าย `web/index.css`:

```css
/* แผงย่อยในแผงรายละเอียดเพลง — ใช้ทั้งกับต่อเพลงและ persona */
.detail-panel {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.detail-panel-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.detail-panel-note {
  font-size: 13px;
  color: var(--ink-3);
  margin: 0;
}
.detail-panel .input { background: var(--surface); }
```

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (component ยังไม่ถูกเรียกจากที่ไหน จะถูกต่อใน Task 12)

- [ ] **Step 4: Commit**

```bash
git add web/components/ExtendPanel.tsx web/index.css
git commit -m "feat(web): extend panel with continue-point picker

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 12: แผงรายละเอียดเพลง

รวมทุกการกระทำที่เกี่ยวกับเพลงหนึ่งเพลงไว้ที่เดียว — เนื้อเพลง ต่อเพลง persona และสายพันธุ์

**Files:**
- Create: `web/components/SongDetail.tsx`
- Modify: `web/index.css`

**Interfaces:**
- Consumes: `ExtendPanel` จาก Task 11 · `canExtend`, `canPersona`, `personaBlockReason`, `defaultPersonaWindow`, `PERSONA_SEGMENT_MIN`, `PERSONA_SEGMENT_MAX` จาก Task 9 · `CoverArt`, `icons` ที่มีอยู่
- Produces:
  ```ts
  export function SongDetail(props: {
    song: Song;
    parent: Song | null;
    personaName: string | null;   // ชื่อ persona ที่ทำจากเพลงนี้แล้ว ถ้ามี
    onClose: () => void;
    onSelectSong: (id: string) => void;
    onExtended: (songs: Song[]) => void;
    onCreatePersona: (song: Song, input: {
      name: string; description: string; vocalStart: number; vocalEnd: number; style: string;
    }) => Promise<void>;
  }): JSX.Element
  ```

- [ ] **Step 1: เขียน `web/components/SongDetail.tsx`**

```tsx
import { useState } from 'react';
import {
  canExtend, canPersona, defaultPersonaWindow, fmtDuration, personaBlockReason,
  PERSONA_SEGMENT_MAX, PERSONA_SEGMENT_MIN, type Song,
} from '../lib/api';
import { CoverArt } from './CoverArt';
import { ExtendPanel } from './ExtendPanel';

interface Props {
  song: Song;
  parent: Song | null;
  personaName: string | null;
  onClose: () => void;
  onSelectSong: (id: string) => void;
  onExtended: (songs: Song[]) => void;
  onCreatePersona: (song: Song, input: {
    name: string; description: string; vocalStart: number; vocalEnd: number; style: string;
  }) => Promise<void>;
}

export function SongDetail({
  song, parent, personaName, onClose, onSelectSong, onExtended, onCreatePersona,
}: Props) {
  const [open, setOpen] = useState<'none' | 'extend' | 'persona'>('none');

  const window0 = defaultPersonaWindow(song.duration);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState([song.tags, song.style].filter(Boolean).join(', '));
  const [pStyle, setPStyle] = useState('');
  const [start, setStart] = useState(window0.start);
  const [end, setEnd] = useState(window0.end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = personaBlockReason(song);
  const alreadyMade = personaName !== null;
  const maxTime = typeof song.duration === 'number' ? song.duration : PERSONA_SEGMENT_MAX;
  const span = end - start;
  const spanOk = span >= PERSONA_SEGMENT_MIN && span <= PERSONA_SEGMENT_MAX;

  const submitPersona = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreatePersona(song, {
        name, description: desc, vocalStart: start, vocalEnd: end, style: pStyle,
      });
      setOpen('none');
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้าง persona ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="song-detail" aria-label={`รายละเอียด ${song.title || 'เพลงที่ยังไม่ได้ตั้งชื่อ'}`}>
      <div className="song-detail-head">
        <div className="song-detail-cover"><CoverArt song={song} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="song-detail-title">
            {song.title || <span style={{ color: 'var(--ink-3)' }}>ยังไม่ได้ตั้งชื่อ</span>}
          </h2>
          <p className="song-detail-meta">
            {[song.tags || song.style, fmtDuration(song.duration), song.model]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="ปิดแผงรายละเอียด">
          ✕
        </button>
      </div>

      {parent && (
        <button type="button" className="lineage-link" onClick={() => onSelectSong(parent.id)}>
          ต่อจาก · {parent.title || 'เพลงที่ยังไม่ได้ตั้งชื่อ'}
          {song.continueAt !== null && ` (วินาทีที่ ${fmtDuration(song.continueAt)})`}
        </button>
      )}

      {song.prompt.trim() && (
        <section className="song-detail-lyrics">
          <h3 className="song-detail-section">เนื้อเพลง</h3>
          <pre className="lyrics-body">{song.prompt}</pre>
        </section>
      )}

      <div className="song-detail-actions">
        <button
          type="button"
          className="btn-outline"
          disabled={!canExtend(song)}
          title={canExtend(song) ? undefined : 'เพลงนี้สร้างก่อนระบบเก็บรหัสแทร็ก จึงต่อเพลงไม่ได้'}
          onClick={() => setOpen(open === 'extend' ? 'none' : 'extend')}
        >
          ต่อเพลง
        </button>
        <button
          type="button"
          className="btn-outline btn-outline-pink"
          disabled={!canPersona(song) || alreadyMade}
          title={alreadyMade ? `ทำแล้วในชื่อ “${personaName}”` : blocked ?? undefined}
          onClick={() => setOpen(open === 'persona' ? 'none' : 'persona')}
        >
          ทำ persona
        </button>
      </div>

      {(blocked || alreadyMade) && (
        <p className="song-detail-note">
          {alreadyMade ? `เพลงนี้ทำ persona ไปแล้วในชื่อ “${personaName}”` : blocked}
        </p>
      )}

      {open === 'extend' && (
        <ExtendPanel song={song} onCreated={onExtended} onClose={() => setOpen('none')} />
      )}

      {open === 'persona' && (
        <div className="detail-panel">
          <h4 className="detail-panel-title">ทำ persona จากเพลงนี้</h4>
          <p className="detail-panel-note">
            เลือกช่วงที่ให้ระบบฟัง ยาวได้ {PERSONA_SEGMENT_MIN}–{PERSONA_SEGMENT_MAX} วินาที
            เลือกท่อนที่เป็นตัวแทนของเพลงมากที่สุด
          </p>

          <div>
            <label htmlFor={`pn-${song.id}`} className="field-label">ชื่อ persona</label>
            <input id={`pn-${song.id}`} className="input" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="เสียงฝนเชียงใหม่" />
          </div>

          <div>
            <label htmlFor={`pd-${song.id}`} className="field-label">คำอธิบาย</label>
            <textarea id={`pd-${song.id}`} className="input" rows={3} value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="แนวดนตรี อารมณ์ เครื่องดนตรี ลักษณะเสียงร้อง" />
          </div>

          <div>
            <label htmlFor={`ps-${song.id}`} className="field-label">แท็บแนวเพลง (ไม่บังคับ)</label>
            <input id={`ps-${song.id}`} className="input" value={pStyle}
              onChange={(e) => setPStyle(e.target.value)} placeholder="Dream Pop" />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="field-label" style={{ marginBottom: 0 }}>ช่วงที่ให้ฟัง</span>
              <span className="text-xs tabular-nums"
                style={{ color: spanOk ? 'var(--ink-3)' : 'var(--danger)' }}>
                {fmtDuration(start)} – {fmtDuration(end)} ({Math.round(span)} วินาที)
              </span>
            </div>
            <label htmlFor={`pst-${song.id}`} className="sr-only">จุดเริ่ม</label>
            <input id={`pst-${song.id}`} type="range" min={0} max={Math.max(0, maxTime - PERSONA_SEGMENT_MIN)}
              step={0.5} value={start} className="w-full accent-[#be185d]"
              onChange={(e) => {
                const v = Number(e.target.value);
                setStart(v);
                if (end - v < PERSONA_SEGMENT_MIN) setEnd(Math.min(maxTime, v + PERSONA_SEGMENT_MIN));
                if (end - v > PERSONA_SEGMENT_MAX) setEnd(Math.min(maxTime, v + PERSONA_SEGMENT_MAX));
              }} />
            <label htmlFor={`pe-${song.id}`} className="sr-only">จุดจบ</label>
            <input id={`pe-${song.id}`} type="range" min={PERSONA_SEGMENT_MIN} max={maxTime}
              step={0.5} value={end} className="w-full accent-[#be185d]"
              onChange={(e) => {
                const v = Number(e.target.value);
                setEnd(v);
                if (v - start < PERSONA_SEGMENT_MIN) setStart(Math.max(0, v - PERSONA_SEGMENT_MIN));
                if (v - start > PERSONA_SEGMENT_MAX) setStart(Math.max(0, v - PERSONA_SEGMENT_MAX));
              }} />
          </div>

          {error && (
            <p role="alert" className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" className="btn-assist"
              disabled={busy || !name.trim() || !desc.trim() || !spanOk}
              onClick={() => void submitPersona()}>
              {busy ? 'กำลังสร้าง…' : 'สร้าง persona'}
            </button>
            <button type="button" className="cursor-pointer text-sm"
              style={{ color: 'var(--ink-3)' }} onClick={() => setOpen('none')}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: เพิ่มสไตล์ของแผงรายละเอียด**

เพิ่มท้าย `web/index.css`:

```css
/* แผงรายละเอียดเพลง — เลื่อนทับ grid เข้ามาจากขอบขวา */
.song-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: var(--surface);
  border-left: 1px solid var(--line);
  height: 100%;
  overflow-y: auto;
}
.song-detail-head { display: flex; align-items: flex-start; gap: 12px; }
.song-detail-cover {
  width: 64px; height: 64px; flex: none;
  border-radius: 12px; overflow: hidden; position: relative;
}
.song-detail-title {
  font-family: var(--font-display);
  font-size: 19px; font-weight: 700; line-height: 1.35; margin: 0;
  overflow-wrap: anywhere;
}
.song-detail-meta {
  font-size: 13px; color: var(--ink-3); margin: 4px 0 0;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.song-detail-section {
  font-family: var(--font-display);
  font-size: 13px; font-weight: 600; color: var(--ink-3);
  letter-spacing: 0.04em; margin: 0 0 6px;
}
.lyrics-body {
  font-family: var(--font-body);
  font-size: 14px; line-height: 1.85; white-space: pre-wrap;
  margin: 0; padding: 12px 14px;
  background: var(--surface-2); border-radius: 10px;
  max-height: 260px; overflow-y: auto;
}
.song-detail-actions { display: flex; gap: 8px; }
.song-detail-actions > * { flex: 1; }
.song-detail-note { font-size: 13px; color: var(--ink-3); margin: 0; }
.btn-outline {
  min-height: 40px; border-radius: 10px;
  border: 1px solid var(--line-strong); background: var(--surface);
  color: var(--grape-text); font-size: 14px; font-weight: 600; cursor: pointer;
  transition: background-color 160ms var(--ease), border-color 160ms var(--ease);
}
.btn-outline:hover:not(:disabled) { background: var(--grape-soft); border-color: var(--grape); }
.btn-outline-pink { color: var(--pink); }
.btn-outline-pink:hover:not(:disabled) { background: var(--pink-soft); border-color: var(--pink); }
.btn-outline:disabled { opacity: 0.45; cursor: not-allowed; }
.lineage-link {
  align-self: flex-start;
  font-size: 12px; font-weight: 600;
  padding: 4px 10px; border-radius: 999px;
  background: var(--grape-soft); color: var(--grape-text);
  cursor: pointer; text-align: start;
}
.lineage-link:hover { filter: brightness(0.96); }
```

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/components/SongDetail.tsx web/index.css
git commit -m "feat(web): song detail panel gathering lyrics, extend, persona and lineage

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 13: ที่ทางใหม่ และการ์ดที่ผอมลง

**Files:**
- Modify: `web/App.tsx`
- Modify: `web/components/SongCard.tsx`
- Modify: `web/components/LibraryGrid.tsx`
- Modify: `web/index.css`

**Interfaces:**
- Consumes: `SongDetail` จาก Task 12 · `usePersonas` ที่มีอยู่
- Produces: layout สุดท้าย — ไม่มีอะไรที่ task อื่นต้องใช้ต่อ

- [ ] **Step 1: ถอดแผง persona ออกจาก `SongCard.tsx`**

ลบทั้งหมดนี้ออกจาก `web/components/SongCard.tsx`:
- state ที่ขึ้นต้นด้วย `persona` ทั้ง 6 ตัว (บรรทัด 28-36)
- ฟังก์ชัน `submitPersona` (บรรทัด 38-50)
- ค่า `canPersona` และ `personaPrefill`
- ปุ่ม persona บนปก (บรรทัด 119-135)
- บล็อก `{personaOpen && (...)}` ทั้งก้อน (บรรทัด 162-204)
- prop `onCreatePersona` ออกจาก `Props` และ signature
- import `PersonaIcon`

เพิ่ม prop ใหม่แทน:

```tsx
interface Props {
  song: Song;
  showVariant: boolean;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (song: Song) => void;
  onRetry: (song: Song) => void;
  onOpenDetail: (song: Song) => void;
}
```

- [ ] **Step 2: แก้การแสดงผลของการ์ดตามข้อมูลจริง**

แทนบล็อกข้อความใต้ปก (บรรทัด 138-145) ด้วย:

```tsx
      <div className="min-w-0">
        <button
          type="button"
          className="card-title-btn"
          onClick={() => onOpenDetail(song)}
          style={{ color: isActive ? 'var(--grape-text)' : undefined }}
        >
          {song.title || <span style={{ color: 'var(--ink-3)' }}>ยังไม่ได้ตั้งชื่อ</span>}
        </button>
        {/* คำบรรยายจาก Suno ยาวได้ถึง 420 ตัวอักษร บรรทัดเดียวแล้วไม่เหลือความหมาย */}
        <p className="card-meta">
          {song.tags || song.style || '—'}
        </p>
        <p className="card-sub">
          {success && <span className="tabular-nums">{fmtDuration(song.duration)}</span>}
          {song.parentSongId && <span className="card-chip">ต่อ</span>}
        </p>
```

และเพิ่มสไตล์ท้าย `web/index.css`:

```css
.card-title-btn {
  display: block; width: 100%; text-align: start;
  font-size: 14px; font-weight: 600; line-height: 1.5;
  cursor: pointer; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.card-title-btn:hover { color: var(--grape-text); }
.card-meta {
  margin-top: 2px; font-size: 12px; line-height: 1.5; color: var(--ink-3);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.card-sub {
  margin-top: 3px; display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--ink-3);
}
.card-chip {
  padding: 1px 7px; border-radius: 999px;
  background: var(--grape-soft); color: var(--grape-text);
  font-size: 11px; font-weight: 600;
}
```

- [ ] **Step 3: สถานะคลังน้อยใน `LibraryGrid.tsx`**

หลัง grid ที่มีอยู่ ให้เพิ่มช่องชวนสร้างเมื่อเพลงน้อยกว่า 4 เพลง — เพิ่มเป็นสมาชิกท้าย grid:

```tsx
      {loaded && visible.length > 0 && visible.length < 4 && (
        <div className="empty-slot">
          <p>สร้างเพลงถัดไปได้จากฟอร์มทางซ้าย</p>
        </div>
      )}
```

และเปลี่ยนข้อความตอนคลังว่างสนิทให้ชี้ไปทางซ้าย (แทนข้อความเดิม):

```tsx
      {loaded && visible.length === 0 && !query && (
        <div className="empty-state">
          <h2>ยังไม่มีเพลงในคลัง</h2>
          <p>กรอกฟอร์มทางซ้ายแล้วกดสร้างเพลง ใช้เวลาราวหนึ่งถึงสองนาทีต่อเพลง</p>
        </div>
      )}
```

สไตล์ท้าย `web/index.css`:

```css
.empty-slot {
  aspect-ratio: 1;
  border: 1px dashed var(--line-strong);
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  padding: 16px; text-align: center;
  font-size: 13px; color: var(--ink-3);
}
.empty-state {
  grid-column: 1 / -1;
  padding: 48px 24px; text-align: center;
}
.empty-state h2 {
  font-family: var(--font-display);
  font-size: 20px; font-weight: 600; margin: 0 0 8px;
}
.empty-state p { font-size: 14px; color: var(--ink-3); margin: 0; }
```

- [ ] **Step 4: เปลี่ยน layout ใน `App.tsx`**

- ลบ state `tab` และบล็อก `<div className="seg">…</div>` ทั้งก้อนออก
- เพิ่ม state `detailId` และ handler
- แผงรายละเอียดเป็นชั้นทับ `<main>` ไม่ใช่คอลัมน์ที่สาม

แทนโครง `<div className="flex min-h-0 flex-1 md:flex-row">…</div>` ทั้งก้อนด้วย:

```tsx
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ① ซ้าย = สิ่งที่เราป้อน */}
        <aside className="create-rail">
          <CreatePanel
            personas={personas}
            personasLoaded={personasLoaded}
            onCreated={(created) => {
              upsert(created);
              setActiveId(created[0].id);
              wasPending.current = true;
              setToast('เริ่มสร้างเพลงแล้ว — จะขึ้นในคลังเมื่อเสร็จ');
            }}
          />
        </aside>

        {/* ② ขวา = สิ่งที่ได้กลับมา · ③ รายละเอียดทับเข้ามาจากขอบขวา */}
        <main className="library-main">
          <LibraryGrid
            songs={songs}
            loaded={loaded}
            query={query}
            activeSong={active}
            isPlaying={isPlaying}
            onPlay={play}
            upsert={upsert}
            remove={remove}
            onRetryFailed={setToast}
            onOpenDetail={(s) => setDetailId(s.id)}
          />

          {detail && (
            <>
              <div className="detail-scrim" onClick={() => setDetailId(null)} aria-hidden="true" />
              <div className="detail-layer rise-in">
                <SongDetail
                  song={detail}
                  parent={detail.parentSongId ? songs.find((s) => s.id === detail.parentSongId) ?? null : null}
                  personaName={personas.find((p) => p.songId === detail.id)?.name ?? null}
                  onClose={() => setDetailId(null)}
                  onSelectSong={(id) => setDetailId(id)}
                  onExtended={(created) => {
                    upsert(created);
                    setDetailId(null);
                    setToast('เริ่มต่อเพลงแล้ว — จะขึ้นในคลังเมื่อเสร็จ');
                  }}
                  onCreatePersona={async (song, input) => {
                    const out = await api<{ persona: Persona }>('/api/personas', {
                      method: 'POST',
                      body: JSON.stringify({ songId: song.id, ...input }),
                    });
                    addPersona(out.persona);
                    setToast(`เพิ่ม persona “${out.persona.name}” แล้ว`);
                  }}
                />
              </div>
            </>
          )}
        </main>
      </div>
```

พร้อม state และ import ที่เพิ่ม:

```tsx
import { SongDetail } from './components/SongDetail';
import { api, songAudioUrl, type Persona, type Song } from './lib/api';
// ...
const [detailId, setDetailId] = useState<string | null>(null);
const detail = detailId ? songs.find((s) => s.id === detailId) ?? null : null;
```

- [ ] **Step 5: สไตล์ของ layout**

เพิ่มท้าย `web/index.css` แล้ว**ลบ** `.seg`, `.seg-btn`, `.aside-divider`, `.persona-panel` ที่ไม่ใช้แล้วออก:

```css
/* ① ราวซ้าย — สิ่งที่เราป้อน คงอยู่ถาวรบนจอกว้าง */
.create-rail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  background: var(--surface);
}
@media (min-width: 1024px) {
  .create-rail {
    width: 380px;
    flex: none;
    border-right: 1px solid var(--line);
  }
}

/* ② คลัง */
.library-main {
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  padding: 24px 16px;
}
@media (min-width: 1024px) {
  .library-main { padding: 32px 24px; }
}

/* ③ แผงรายละเอียด — ทับ grid ไม่ไปแย่งที่ราวซ้าย */
.detail-scrim {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(23, 18, 43, 0.28);
}
.detail-layer {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  z-index: 21;
  width: min(440px, 100%);
  box-shadow: -12px 0 32px -18px rgba(23, 18, 43, 0.45);
}
/* จอแคบ — ขึ้นจากด้านล่างแทนการเลื่อนจากข้าง */
@media (max-width: 1023px) {
  .detail-layer {
    inset-block: auto 0;
    inset-inline: 0;
    width: 100%;
    max-height: 82%;
    border-radius: 18px 18px 0 0;
    overflow: hidden;
  }
  .song-detail { border-left: none; border-top: 1px solid var(--line); }
}
```

- [ ] **Step 6: ส่ง prop ใหม่ผ่าน `LibraryGrid.tsx`**

แทน prop `onPersonaCreated` ด้วย `onOpenDetail: (song: Song) => void` แล้วส่งต่อให้ `SongCard`
ลบ handler ที่เรียก `/api/personas` ออกจาก `LibraryGrid` ทั้งหมด (ย้ายไป `App.tsx` แล้ว)

- [ ] **Step 7: typecheck แล้วดูของจริง**

```bash
npx tsc --noEmit
npm run dev
```

ตรวจให้ครบ:
- ฟอร์มสร้างอยู่ซ้าย คลังอยู่ขวา ไม่มีแท็บ "สร้าง / คลัง"
- คลิกชื่อเพลงแล้วแผงรายละเอียดเลื่อนทับ grid เข้ามาจากขวา ฟอร์มซ้ายยังอยู่
- กด ✕ หรือคลิกพื้นที่มืดแล้วแผงปิด
- เพลงที่ไม่มีชื่อขึ้นว่า "ยังไม่ได้ตั้งชื่อ" ไม่ใช่ "Untitled"
- คำบรรยายยาว ๆ ขึ้นสองบรรทัดแล้วตัด
- ปุ่มต่อเพลงกับ persona ของเพลงที่ไม่มี `sunoId` ขึ้นแบบกดไม่ได้ พร้อมข้อความอธิบายใต้ปุ่ม
- ที่ความกว้าง 800px ราวซ้ายอยู่บนคลัง และแผงรายละเอียดขึ้นจากด้านล่าง

- [ ] **Step 8: รันทั้งชุด**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add web/App.tsx web/components/SongCard.tsx web/components/LibraryGrid.tsx web/index.css
git commit -m "feat(web): left-to-right layout with a detail layer over the grid

ซ้ายคือสิ่งที่ป้อน ขวาคือสิ่งที่ได้กลับมา แผงรายละเอียดเป็นขั้นที่สามที่ทับ grid
เข้ามาจากขอบขวา ไม่ไปแย่งที่ฟอร์ม — เลิกใช้แท็บที่ทำให้คลังหายไปทั้งจอ

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 14: ปรับ design system ให้ตรงของจริง

`design-system/song-auto/MASTER.md` ยังระบุจานสีเก่า Variance 3/10 และ Page Pattern
ที่ไม่ตรงกับโค้ดตั้งแต่ก่อนเริ่มงานนี้ ถ้าไม่แก้ รอบหน้าจะขัดกันเอง

**Files:**
- Modify: `design-system/song-auto/MASTER.md`

**Interfaces:**
- Consumes: token จาก Task 8
- Produces: ไม่มี (เอกสาร)

- [ ] **Step 1: แทนตาราง Color Palette**

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#6D28D9` | `--grape` |
| On Primary | `#FFFFFF` | — |
| Secondary | `#BE185D` | `--pink` |
| On Secondary | `#FFFFFF` | — |
| Background | `#FAF7FF` | `--ground` |
| Surface | `#FFFFFF` | `--surface` |
| Foreground | `#17122B` | `--ink` |
| Muted Foreground | `#6E6690` | `--ink-3` |
| Border | `#E7DCFB` | `--line` |
| Destructive | `#DC2626` | `--danger` |

Color Notes: พื้นสว่างอมม่วง ปกเพลงเป็นตัวเดินสี · ม่วง = การกระทำของระบบ · ชมพู = สิ่งที่ AI แต่งให้ · ทุกคู่ผ่าน WCAG AA

- [ ] **Step 2: แทนหัวข้อ Typography**

- Heading Font: Chakra Petch (มีอักขระไทย)
- Body Font: Anuphan (มีอักขระไทย ตัวแปรน้ำหนัก 100–700)
- Mono: JetBrains Mono
- Google Fonts URL: `https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Anuphan:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap`
- กติกาไทย: `line-height` ของเนื้อความไม่ต่ำกว่า 1.75 · ไม่ใช้ขนาดต่ำกว่า 13px กับข้อความไทย · ห้าม `text-align: justify`

- [ ] **Step 3: แก้ Design Dials และ Page Pattern**

- Design Dials: `Variance 6/10 (Expressive) | Motion 4/10 (Standard) | Density 5/10 (Standard)`
  — ค่าเดิม 3/10 หมายถึงเรียบและอยู่กลางจอ ซึ่งขัดกับทิศทางที่เลือกไว้
- Page Pattern → **"Create Left, Library Right"**
  - Structure: หัวจอ (ชื่อแอป · ค้นหา) → ราวซ้ายคือฟอร์มสร้าง (≥1024px) → คลังเป็น grid ทางขวา → แถบเล่นเพลงติดก้นจอ
  - Detail: แผงรายละเอียดเลื่อนทับ grid จากขอบขวา (≥1024px) / ขึ้นจากด้านล่าง (<1024px)
  - Grid: 2 คอลัมน์ <640px · 3 คอลัมน์ 640–1024px · 4 คอลัมน์ >1024px
  - ทิศทาง: ซ้าย = สิ่งที่ป้อน ขวา = สิ่งที่ได้กลับมา

- [ ] **Step 4: Commit**

```bash
git add design-system/song-auto/MASTER.md
git commit -m "docs(design-system): align tokens and page pattern with the real app

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

---

## Task 15: ตรวจของจริงในเบราว์เซอร์ทั้งสามความกว้าง

CSS ไม่มี unit test ในโปรเจกต์นี้ ขั้นนี้คือด่านสุดท้าย — ห้ามข้าม

**Files:** ไม่มีไฟล์ใหม่ แก้เท่าที่พบปัญหา

- [ ] **Step 1: รันแอปแล้วเก็บภาพสามความกว้าง**

```bash
npm run dev
```
ใช้ Playwright MCP เปิด `http://localhost:5173` แล้วถ่ายที่ **375 · 768 · 1440** px

- [ ] **Step 2: ไล่ตรวจตามรายการนี้ทุกความกว้าง**

- ไม่มีการเลื่อนแนวนอนของทั้งหน้า
- ทุกข้อความไทยเป็นฟอนต์ Anuphan และวรรณยุกต์ไม่ชนบรรทัดบน
- ที่ 375px: ฟอร์มอยู่บน คลังอยู่ล่าง แผงรายละเอียดขึ้นจากด้านล่างและไม่บังแถบเล่นเพลง
- ที่ 768px: เหมือน 375px แต่ grid เป็น 3 คอลัมน์
- ที่ 1440px: ราวซ้าย 380px คลัง 4 คอลัมน์ แผงรายละเอียดกว้าง 440px ทับขอบขวา
- ปุ่มทุกปุ่มมีสถานะ focus ที่มองเห็น (กด Tab ไล่)
- การ์ดเพลงที่ไม่มีชื่อและมีคำบรรยายยาว แสดงผลได้โดยไม่ล้นกรอบ
- แถบเล่นเพลงไม่บังเนื้อหาส่วนล่างของคลัง

- [ ] **Step 3: แก้เท่าที่พบ แล้ว commit**

```bash
git add -A
git commit -m "fix(web): responsive corrections found in browser review

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GTAuK8UtrrcD5nRiwWSpKy"
```

- [ ] **Step 4: ตรวจครั้งสุดท้ายแล้ว deploy**

```bash
npx vitest run && npx tsc --noEmit && npm run build
```
Expected: PASS ทั้งสาม

แล้วรายงานผู้ใช้ก่อน deploy — `npm run deploy` เป็นการเผยแพร่ของจริง **ต้องถามก่อน**
