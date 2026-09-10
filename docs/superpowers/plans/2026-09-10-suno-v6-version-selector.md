# Suno V6 Support and Version Selector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน Song-Auto จากโมเดล Suno ที่ถูกปลดระวางแล้ว มาใช้ V6 family พร้อมให้ผู้ใช้เลือกรุ่นและตั้งความยาวเพลงได้เอง

**Architecture:** ชุดโมเดลถูกนิยามไว้จุดเดียวต่อฝั่ง (`KIE_MODELS` ใน worker, `MODELS` ใน web) ทั้งสามรุ่นของ V6 มีความสามารถเหมือนกันหมด จึงไม่มี capability matrix การเลือกรุ่นและความยาวเก็บใน draft เดียวกับฟิลด์อื่นของฟอร์ม แล้วส่งขึ้น `POST /api/generate` เป็นฟิลด์ธรรมดา

**Tech Stack:** TypeScript, Hono (Cloudflare Workers), D1, React 19, Vite, Tailwind v4, Vitest

**Spec:** `docs/superpowers/specs/2026-09-10-suno-v6-version-selector-design.md`

## Global Constraints

- ชุดโมเดลที่รองรับคือ `V6`, `V6_WILD`, `V6_MINI` เท่านั้น — ค่าตั้งต้นคือ `V6`
- `duration` มีหน่วยเป็นวินาที ช่วงที่ยอมรับคือ **10 ถึง 360** และส่งไป kie ได้เฉพาะเมื่อ `customMode: true`
- ขีดจำกัดตัวอักษรคงเดิม: `prompt` 5000 (custom) / 3000 (non-custom), `style` 1000, `title` 80 — **ห้ามแก้**
- ห้ามเขียน `duration` ที่ผู้ใช้ขอลงคอลัมน์ `songs.duration` คอลัมน์นั้นเก็บความยาวจริงที่ poll กลับมา
- ห้ามแตะ schema ฐานข้อมูล ไม่มี migration ในแผนนี้
- ค่าใน draft ที่เป็นตัวเลขไม่บังคับ เก็บเป็น **สตริง** เสมอ ค่าว่างแปลว่า "ไม่ส่งไป kie"
- ข้อความที่ผู้ใช้เห็นเป็นภาษาไทย คอมเมนต์ในโค้ดเขียนภาษาไทยตามแบบไฟล์ที่กำลังแก้
- ทุก task จบด้วย commit ที่รันเทสต์ผ่านแล้ว

---

## File Structure

| ไฟล์ | หน้าที่หลังแก้ |
|---|---|
| `src/worker/kie.ts` | นิยาม `KIE_MODELS` (V6 family), ช่วงของ `duration`, และ validate/ส่ง body ทั้ง generate และ extend |
| `src/worker/routes.ts` | ไม่ต้องแก้ — แคสต์ body ทั้งก้อนเป็น `GenerateInput` อยู่แล้ว `duration` จึงไหลผ่านเอง |
| `web/lib/api.ts` | `MODELS`, ชนิด `KieModel`, และ `GenerateBody.duration` |
| `web/lib/draft.ts` | เก็บ `model` กับ `duration` ใน draft พร้อมตัวกรองค่าที่อ่านจาก localStorage |
| `web/components/TuningSlider.tsx` | สไลเดอร์ค่าที่ไม่บังคับ รองรับช่วงค่าและรูปแบบการแสดงผลที่กำหนดเองได้ |
| `web/components/ModelPicker.tsx` | **ไฟล์ใหม่** — การ์ด radio สามใบสำหรับเลือกรุ่นโมเดล |
| `web/components/CreatePanel.tsx` | ประกอบฟอร์ม ส่ง `model` และ `duration` ขึ้น API |
| `web/components/LibraryGrid.tsx` | ปุ่มลองใหม่ใช้ `song.model` |
| `web/index.css` | สไตล์ของ `.model-pick` / `.model-card` |

---

### Task 1: เปลี่ยนชุดโมเดลใน worker เป็น V6 family

**Files:**
- Modify: `src/worker/kie.ts:6-8`
- Modify: `src/worker/kie.ts` — บล็อกตรวจ persona ใน `validateExtend`
- Test: `tests/kie.test.ts`, `tests/extend.test.ts`

**Interfaces:**
- Consumes: ไม่มี — task แรก
- Produces: `KIE_MODELS` เป็น `readonly ['V6', 'V6_WILD', 'V6_MINI']`; `PERSONA_CAPABLE_MODELS` **ถูกลบ** จึงไม่มี export หรือ symbol นี้ให้ task หลังอ้างถึงอีก

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

เพิ่มลงท้าย `tests/kie.test.ts`:

```ts
describe('ชุดโมเดล V6', () => {
  const custom: GenerateInput = {
    prompt: 'a calm piano song', style: 'lo-fi', title: 'Rain', instrumental: false, model: 'V6',
  };

  it('ยอมรับ V6, V6_WILD, V6_MINI', () => {
    expect(validateGenerate({ ...custom, model: 'V6' })).toBeNull();
    expect(validateGenerate({ ...custom, model: 'V6_WILD' })).toBeNull();
    expect(validateGenerate({ ...custom, model: 'V6_MINI' })).toBeNull();
  });

  it('ปฏิเสธโมเดลที่ถูกปลดระวางแล้ว', () => {
    expect(validateGenerate({ ...custom, model: 'V5' })).toMatch(/unsupported model/);
    expect(validateGenerate({ ...custom, model: 'V4_5PLUS' })).toMatch(/unsupported model/);
    expect(validateGenerate({ ...custom, model: 'V3_5' })).toMatch(/unsupported model/);
  });

  it('ยอมรับ persona บน V6 ทุกรุ่นตอนต่อเพลง', () => {
    const withPersona = {
      audioId: 'a1',
      defaultParamFlag: false,
      personaId: 'p1',
      personaModel: 'style_persona',
    };
    expect(validateExtend({ ...withPersona, model: 'V6' })).toBeNull();
    expect(validateExtend({ ...withPersona, model: 'V6_WILD' })).toBeNull();
    expect(validateExtend({ ...withPersona, model: 'V6_MINI' })).toBeNull();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run tests/kie.test.ts -t 'ชุดโมเดล V6'`
Expected: FAIL — `validateGenerate` คืน `unsupported model 'V6'` เพราะ V6 ยังไม่อยู่ในรายการ

- [ ] **Step 3: แก้ `src/worker/kie.ts`**

แทนที่บรรทัด 6-8:

```ts
const KIE_MODELS = ['V6', 'V6_WILD', 'V6_MINI'] as const;
const PERSONA_MODELS = ['style_persona', 'voice_persona'] as const;
```

(บรรทัด `PERSONA_CAPABLE_MODELS` หายไปทั้งบรรทัด — V6 ทุกรุ่นรองรับ persona การเช็คจึงไม่มีความหมายอีก)

ใน `validateExtend` ลบสองบรรทัดนี้ทิ้ง:

```ts
  if (input.personaModel && !(PERSONA_CAPABLE_MODELS as readonly string[]).includes(input.model)) {
    return `persona requires model V5 (got '${input.model}')`;
  }
```

- [ ] **Step 4: อัปเดต fixture ในเทสต์เดิมที่ยังใช้โมเดลเก่า**

ใน `tests/kie.test.ts` เปลี่ยน `model: 'V5'` เป็น `model: 'V6'` ทุกจุดที่ค่านั้นถูกส่งเข้า `validateGenerate`, `kieGenerate`, `validateExtend` หรือ `kieExtend` และเปลี่ยนค่าที่ assert กลับมาให้ตรงกัน:

```bash
# ดูทุกจุดก่อนแก้
grep -n "'V5'" tests/kie.test.ts
```

ลบเทสต์ที่ตรวจข้อจำกัดที่หายไปแล้วออกทั้งบล็อก:

```ts
  it('ปฏิเสธ persona กับโมเดลที่ต่ำกว่า V5', () => {
    const withPersona = { ...baseExtend, personaId: 'p1', personaModel: 'style_persona' };
    expect(validateExtend({ ...withPersona, model: 'V4_5' })).toMatch(/V5/);
    expect(validateExtend({ ...withPersona, model: 'V5' })).toBeNull();
  });
```

ใน `tests/extend.test.ts` บรรทัด ~57 เทสต์ชื่อ `'ใช้ model ของเพลงต้นทางเสมอ แม้ผู้เรียกจะส่งค่าอื่นมา'` ใช้ `songRow({ model: 'V4_5' })` ซึ่งใช้ไม่ได้แล้ว เปลี่ยนเป็นรุ่นที่ยังใช้ได้แต่ไม่ใช่ค่าตั้งต้น เพื่อให้เทสต์ยังพิสูจน์ประเด็นเดิม:

```ts
    const { env } = makeEnv([songRow({ model: 'V6_MINI' }) as never]);
    ...
    expect(sent.model).toBe('V6_MINI');
```

ใน `tests/api.test.ts` บรรทัด 82 `baseInput` เป็น body ที่ถูกส่งเข้า route จริงจึงผ่าน `validateGenerate` ต้องเปลี่ยนด้วย:

```ts
const baseInput = { prompt: 'a calm piano song', instrumental: true, model: 'V6' };
```

**หมายเหตุ:** fixture ที่เป็นแค่แถวข้อมูลใน DB ไม่ต้องแก้ ค่านั้นไม่เคยผ่าน validate — ได้แก่ `rowFixture` ใน `tests/api.test.ts`, และไฟล์ `tests/api-client.test.ts`, `tests/filter.test.ts`, `tests/personas.test.ts` ทั้งไฟล์

วิธีแยกให้ถูก: ถ้าค่านั้นถูกส่งเข้า `validateGenerate` / `validateExtend` / `app.request(...)` ต้องเปลี่ยน ถ้ามันเป็นแถวที่แกล้งว่าอ่านมาจาก D1 ปล่อยไว้

- [ ] **Step 5: รันเทสต์ทั้งชุด**

Run: `npm test`
Expected: PASS ทั้งหมด

- [ ] **Step 6: Commit**

```bash
git add src/worker/kie.ts tests/kie.test.ts tests/extend.test.ts tests/api.test.ts
git commit -m "feat(worker): switch to the Suno V6 model family

kie.ai marks V4 through V5_5 discontinued and defaults to V6. Every V6
model supports personas, so the PERSONA_CAPABLE_MODELS check is gone."
```

---

### Task 2: รับพารามิเตอร์ `duration` ใน worker

**Files:**
- Modify: `src/worker/kie.ts` — `GenerateInput`, `validateGenerate`, `kieGenerate`
- Test: `tests/kie.test.ts`

**Interfaces:**
- Consumes: `KIE_MODELS` จาก Task 1
- Produces: `GenerateInput.duration?: number` — worker ส่งต่อเป็น `body.duration` เฉพาะใน custom mode

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

เพิ่มลงท้าย `tests/kie.test.ts`:

```ts
describe('duration', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const custom: GenerateInput = {
    prompt: 'a calm piano song', style: 'lo-fi', title: 'Rain', instrumental: false, model: 'V6',
  };

  it('ยอมรับค่าที่ขอบและตรงกลางของช่วง', () => {
    expect(validateGenerate({ ...custom, duration: 10 })).toBeNull();
    expect(validateGenerate({ ...custom, duration: 180 })).toBeNull();
    expect(validateGenerate({ ...custom, duration: 360 })).toBeNull();
  });

  it('ปฏิเสธค่านอกช่วงและค่าที่ไม่ใช่ตัวเลขจำกัด', () => {
    expect(validateGenerate({ ...custom, duration: 9 })).toMatch(/duration/);
    expect(validateGenerate({ ...custom, duration: 361 })).toMatch(/duration/);
    expect(validateGenerate({ ...custom, duration: Number.NaN })).toMatch(/duration/);
  });

  it('ปฏิเสธ duration เมื่อไม่ใช่ custom mode', () => {
    expect(validateGenerate({ prompt: 'a song', instrumental: false, model: 'V6', duration: 120 }))
      .toMatch(/duration/);
  });

  it('ส่ง duration ขึ้น kie เมื่อระบุมา', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { taskId: 't1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await kieGenerate(env, { ...custom, duration: 150 });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.duration).toBe(150);
  });

  it('ไม่ใส่คีย์ duration เลยเมื่อไม่ได้ระบุ', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, msg: 'success', data: { taskId: 't1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await kieGenerate(env, custom);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect('duration' in body).toBe(false);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run tests/kie.test.ts -t 'duration'`
Expected: FAIL — TypeScript ไม่รู้จักฟิลด์ `duration` ใน `GenerateInput`

- [ ] **Step 3: เพิ่มค่าคงที่และฟิลด์**

ใน `src/worker/kie.ts` ต่อจากบล็อกค่าคงที่ที่มีอยู่ (ใกล้ `TITLE_LIMIT`):

```ts
// kie รับ duration เป็นวินาที และมีผลเฉพาะ custom mode บนตระกูล V6
const DURATION_MIN = 10;
const DURATION_MAX = 360;
```

ใน `interface GenerateInput` เพิ่มบรรทัดท้ายสุด:

```ts
  duration?: number;
```

- [ ] **Step 4: เพิ่มการตรวจใน `validateGenerate`**

เพิ่มก่อน `return (` ที่ท้ายฟังก์ชัน:

```ts
  if (input.duration !== undefined) {
    if (!custom) return 'duration requires custom mode (style or title)';
    if (!Number.isFinite(input.duration) || input.duration < DURATION_MIN || input.duration > DURATION_MAX) {
      return `duration must be between ${DURATION_MIN} and ${DURATION_MAX} seconds`;
    }
  }
```

(ตัวแปร `custom` ถูกประกาศไว้แล้วต้นฟังก์ชัน)

- [ ] **Step 5: ส่งขึ้น body ใน `kieGenerate`**

ในบล็อก `if (custom) { ... }` เพิ่มบรรทัดต่อจาก `if (input.title) body.title = input.title;`:

```ts
    if (typeof input.duration === 'number') body.duration = input.duration;
```

- [ ] **Step 6: รันเทสต์**

Run: `npm test`
Expected: PASS ทั้งหมด

- [ ] **Step 7: Commit**

```bash
git add src/worker/kie.ts tests/kie.test.ts
git commit -m "feat(worker): accept a duration parameter for V6 generations

kie only honours duration in custom mode, so an out-of-mode value is
rejected at the edge rather than silently dropped downstream."
```

---

### Task 3: พิสูจน์ว่า `duration` เดินทางถึง kie ผ่าน route

**Files:**
- Test: `tests/api.test.ts`
- Modify: `src/worker/routes.ts` — **คาดว่าไม่ต้องแก้** ดู Step 1

**Interfaces:**
- Consumes: `GenerateInput.duration` จาก Task 2
- Produces: ไม่มี symbol ใหม่ — task นี้ตรึงพฤติกรรมที่มีอยู่ด้วยเทสต์

**สิ่งที่ต้องรู้ก่อนเริ่ม:** `createSong` ใน `src/worker/routes.ts:54-56` แคสต์ JSON body
ทั้งก้อนเป็น `GenerateInput` แล้วส่งเข้า `validateGenerate` และ `kieGenerate` ตรง ๆ
ไม่มีการแมปทีละฟิลด์ **ดังนั้นเมื่อ Task 2 เพิ่ม `duration` ลงในชนิดแล้ว ค่านั้นจะไหลผ่านเอง
โดยไม่ต้องแก้ route** task นี้จึงมีไว้เพื่อตรึงพฤติกรรมนั้นด้วยเทสต์ ไม่ใช่เพื่อเพิ่มโค้ด
— ถ้าเทสต์ผ่านตั้งแต่ยังไม่แก้อะไร นั่นคือผลที่ถูกต้อง ไม่ใช่เทสต์ที่เขียนผิด

- [ ] **Step 1: ยืนยันว่า route ส่งผ่านทั้งก้อนจริง**

Run: `sed -n '52,70p' src/worker/routes.ts`

ต้องเห็น `body = (await ctx.req.json()) as GenerateInput;` แล้วส่ง `body` เข้า `kieGenerate(ctx.env, body)`
ถ้าโครงเปลี่ยนไปจากนี้ (มีการแมปทีละฟิลด์) ให้เพิ่ม `duration` เข้าไปในแมปนั้นตามแบบของ `styleWeight`

- [ ] **Step 2: เขียนเทสต์**

เพิ่มลงใน `describe('API routes', ...)` ของ `tests/api.test.ts` ต่อจากเทสต์ happy path:

```ts
  it('POST /api/generate: ส่ง duration ต่อไปให้ kie', async () => {
    const { env } = makeEnv();
    const cookie = await cookieFor('pw');
    const { mock } = stubKieAndMp3({ taskId: 't', status: 'PENDING', response: { sunoData: [] } });
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseInput, style: 'lo-fi', title: 'Rain', duration: 150 }),
    }, env);
    expect(res.status).toBe(201);
    const sent = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.duration).toBe(150);
  });

  it('POST /api/generate: ปฏิเสธ duration นอกช่วงด้วย 400', async () => {
    const { env } = makeEnv();
    const cookie = await cookieFor('pw');
    stubKieAndMp3({ taskId: 't', status: 'PENDING', response: { sunoData: [] } });
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseInput, style: 'lo-fi', title: 'Rain', duration: 900 }),
    }, env);
    expect(res.status).toBe(400);
  });
```

`baseInput` เป็น `instrumental: true` อยู่แล้ว การเติม `style` กับ `title` ทำให้เข้าโหมด custom
ซึ่งเป็นเงื่อนไขที่ `duration` ต้องการ

- [ ] **Step 3: รันเทสต์**

Run: `npx vitest run tests/api.test.ts -t 'duration'`
Expected: PASS ทั้งสองเคสโดยไม่ต้องแก้ `routes.ts` เลย

ถ้า FAIL ที่เคสแรกด้วย `sent.duration` เป็น `undefined` แปลว่าสมมติฐานใน Step 1 ผิด
ให้กลับไปเพิ่มการแมปฟิลด์ใน `routes.ts` ตามที่ Step 1 บอก แล้วรันใหม่

- [ ] **Step 4: รันเทสต์ทั้งชุด**

Run: `npm test`
Expected: PASS ทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add tests/api.test.ts
git commit -m "test(api): pin duration pass-through and range rejection on generate"
```

---

### Task 4: เพิ่ม `model` และ `duration` ในชนิดฝั่งเว็บและ draft

**Files:**
- Modify: `web/lib/api.ts:74` และ `interface GenerateBody`
- Modify: `web/lib/draft.ts`
- Test: `tests/draft.test.ts`

**Interfaces:**
- Consumes: ไม่มีจาก task ก่อนหน้า (คนละฝั่ง)
- Produces:
  - `export const MODELS = ['V6', 'V6_WILD', 'V6_MINI'] as const`
  - `export type KieModel = (typeof MODELS)[number]`
  - `GenerateBody.duration?: number`
  - `Draft.model: KieModel` และ `Draft.duration: string`
  - `EMPTY_DRAFT.model === 'V6'`, `EMPTY_DRAFT.duration === ''`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ใน `tests/draft.test.ts` เพิ่มสองฟิลด์ลงใน fixture `filled`:

```ts
const filled: Draft = {
  lyrics: '[Verse 1]\nฝนตกที่หน้าต่าง',
  style: 'dream pop, ethereal',
  title: 'สายฝน',
  instrumental: true,
  negativeTags: 'heavy metal',
  personaId: 'persona_123',
  personaModel: 'voice_persona',
  vocalGender: 'f',
  styleWeight: '0.65',
  weirdnessConstraint: '0.2',
  audioWeight: '0.8',
  model: 'V6_WILD',
  duration: '180',
};
```

และเพิ่มเทสต์ใหม่ท้ายบล็อก `describe('draft', ...)`:

```ts
  it('ตกกลับเป็น V6 เมื่อ draft เก่าไม่มีคีย์ model', () => {
    globalThis.localStorage.setItem(
      KEY,
      JSON.stringify({ lyrics: 'a', style: 'b', title: 'c', instrumental: false }),
    );
    const d = loadDraft();
    expect(d.model).toBe('V6');
    expect(d.duration).toBe('');
  });

  it('ตกกลับเป็น V6 เมื่อ model ที่เก็บไว้ใช้ไม่ได้แล้ว', () => {
    globalThis.localStorage.setItem(KEY, JSON.stringify({ model: 'V5' }));
    expect(loadDraft().model).toBe('V6');
  });

  it('เก็บ model ที่ยังใช้ได้ไว้ตามเดิม', () => {
    globalThis.localStorage.setItem(KEY, JSON.stringify({ model: 'V6_MINI' }));
    expect(loadDraft().model).toBe('V6_MINI');
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run tests/draft.test.ts`
Expected: FAIL — TypeScript ไม่รู้จัก `model` / `duration` ใน `Draft`

- [ ] **Step 3: แก้ `web/lib/api.ts`**

แทนบรรทัด 74:

```ts
export const MODELS = ['V6', 'V6_WILD', 'V6_MINI'] as const;
export type KieModel = (typeof MODELS)[number];
```

ใน `interface GenerateBody` เพิ่มบรรทัดท้ายสุด:

```ts
  duration?: number;
```

- [ ] **Step 4: แก้ `web/lib/draft.ts`**

เพิ่ม import และตัวกรอง แล้วต่อฟิลด์เข้าไปในทั้งสามที่ (`interface Draft`, `EMPTY_DRAFT`, `loadDraft`):

```ts
import { MODELS, type KieModel } from './api';
```

ใน `interface Draft` ต่อท้าย:

```ts
  model: KieModel;
  /** วินาที เก็บเป็นสตริงเหมือน slider — ค่าว่างแปลว่าไม่ส่งไป kie */
  duration: string;
```

ใน `EMPTY_DRAFT` ต่อท้าย:

```ts
  model: 'V6',
  duration: '',
```

เพิ่มตัวกรองข้าง ๆ `vocalGender()` ที่มีอยู่:

```ts
// draft ที่บันทึกไว้ก่อนย้ายมา V6 อาจถือ 'V5' ที่ kie ไม่รับแล้ว — ตกกลับเป็นค่าตั้งต้น
const kieModel = (value: unknown): KieModel =>
  (MODELS as readonly string[]).includes(value as string) ? (value as KieModel) : 'V6';
```

ใน `loadDraft` ต่อท้ายอ็อบเจกต์ที่ return:

```ts
      model: kieModel(d.model),
      duration: str(d.duration),
```

- [ ] **Step 5: รันเทสต์**

Run: `npm test && npm run typecheck`
Expected: PASS ทั้งคู่

- [ ] **Step 6: Commit**

```bash
git add web/lib/api.ts web/lib/draft.ts tests/draft.test.ts
git commit -m "feat(web): carry the model choice and duration in the form draft

A draft saved before the V6 move can hold a model kie no longer accepts,
so loadDraft falls back to the default rather than shipping it."
```

---

### Task 5: ให้ `TuningSlider` รองรับช่วงค่าและรูปแบบการแสดงผลที่กำหนดเองได้

**Files:**
- Modify: `web/components/TuningSlider.tsx`

**Interfaces:**
- Consumes: ไม่มี
- Produces: `TuningSlider` รับ props เพิ่ม 4 ตัว ทั้งหมด **ไม่บังคับ** และมีค่าตั้งต้นตรงกับพฤติกรรมเดิมเป๊ะ:
  - `min?: number` (ตั้งต้น `0`)
  - `max?: number` (ตั้งต้น `1`)
  - `step?: number` (ตั้งต้น `0.01`)
  - `format?: (value: number) => string` (ตั้งต้น แสดงเป็นเปอร์เซ็นต์ปัดเศษ)

  จุดเรียกเดิมทั้งสามที่ใน `CreatePanel.tsx` ไม่ต้องแก้แม้แต่บรรทัดเดียว

- [ ] **Step 1: เขียนไฟล์ใหม่ทั้งไฟล์**

แทนที่เนื้อไฟล์ `web/components/TuningSlider.tsx` ด้วย:

```tsx
import { useId } from 'react';
import { InfoIcon } from './icons';

interface Props {
  label: string;
  hint: string;
  /** '' = ยังไม่ได้ตั้งค่า (ไม่ส่งไป kie — ให้ kie ใช้ค่าเริ่มต้นของมันเอง) */
  value: string;
  onChange: (value: string) => void;
  /** ช่วงค่า ตั้งต้นเป็น 0–1 ตามพารามิเตอร์ที่ไม่บังคับของ kie */
  min?: number;
  max?: number;
  step?: number;
  /** แปลงค่าเป็นข้อความมุมขวา ตั้งต้นเป็นเปอร์เซ็นต์ */
  format?: (value: number) => string;
}

const TICKS = Array.from({ length: 11 });

const asPercent = (value: number): string => `${Math.round(value * 100)}%`;

/** สไลเดอร์แบบมีขีดบอกตำแหน่ง ใช้สำหรับพารามิเตอร์ที่ไม่บังคับของ kie.ai */
export function TuningSlider({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format = asPercent,
}: Props) {
  const id = useId();
  const isSet = value !== '';
  // ยังไม่ตั้งค่า = วาง thumb กลางช่วงไว้เฉย ๆ ค่านั้นไม่ถูกส่งไปไหน
  const midpoint = (min + max) / 2;
  const current = isSet ? Number(value) : midpoint;

  return (
    <div className="tune-slider" data-set={isSet}>
      <div className="tune-slider-head">
        <label htmlFor={id} className="tune-slider-label">
          {label}
          <span className="tune-slider-info" title={hint} aria-label={hint}>
            <InfoIcon className="h-3.5 w-3.5" />
          </span>
        </label>
        <span className="tune-slider-pct">{isSet ? format(current) : 'อัตโนมัติ'}</span>
      </div>
      <div className="tune-slider-track-wrap">
        <div className="tune-slider-ticks" aria-hidden="true">
          {TICKS.map((_, i) => (
            <span key={i} />
          ))}
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="tune-slider-input"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ยืนยันว่าจุดเรียกเดิมยังทำงานเหมือนเดิม**

Run: `npm run typecheck && npm test`
Expected: PASS — ไม่มีจุดเรียกไหนต้องแก้

- [ ] **Step 3: Commit**

```bash
git add web/components/TuningSlider.tsx
git commit -m "refactor(web): let TuningSlider take a range and a display format

Defaults reproduce the current 0-1 percentage behaviour exactly, so the
three existing call sites are untouched."
```

---

### Task 6: สร้าง `ModelPicker` และสไตล์ของมัน

**Files:**
- Create: `web/components/ModelPicker.tsx`
- Modify: `web/index.css` (ต่อท้ายบล็อก `.tune-slider-*`)

**Interfaces:**
- Consumes: `MODELS`, `KieModel` จาก Task 4
- Produces:
  ```ts
  export function ModelPicker(props: {
    value: KieModel;
    onChange: (model: KieModel) => void;
  }): JSX.Element
  ```

- [ ] **Step 1: เพิ่มสไตล์ลง `web/index.css`**

ต่อท้ายบล็อกสไลเดอร์ (หลังบรรทัด `.tune-slider-input:focus-visible::-moz-range-thumb`):

```css
/* ตัวเลือกรุ่นโมเดล — การ์ด radio ทรงเดียวกับการ์ดสไลเดอร์ */
.model-pick {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.model-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  cursor: pointer;
}
.model-card:hover { background: var(--surface-hover); }
.model-card[data-on='true'] {
  background: var(--grape-soft);
  border-color: var(--grape);
}
.model-card:has(input:focus-visible) {
  outline: 2px solid var(--grape);
  outline-offset: 2px;
}
.model-card-name {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-2);
}
.model-card[data-on='true'] .model-card-name { color: var(--grape-text); }
.model-card-desc {
  font-size: 11px;
  line-height: 1.45;
  color: var(--ink-3);
}
@media (max-width: 420px) {
  .model-pick { grid-template-columns: minmax(0, 1fr); }
}
```

- [ ] **Step 2: เขียน `web/components/ModelPicker.tsx`**

```tsx
import { MODELS, type KieModel } from '../lib/api';

interface Props {
  value: KieModel;
  onChange: (model: KieModel) => void;
}

/** คำอธิบายสั้น ๆ ของแต่ละรุ่น อ้างจากหน้า generate-music ของ kie.ai */
const DESCRIPTIONS: Record<KieModel, string> = {
  V6: 'มาตรฐาน เสียงร้องเป็นธรรมชาติ รายละเอียดแน่น',
  V6_WILD: 'กล้าและมีเอกลักษณ์กว่า เหมาะกับงานทดลอง',
  V6_MINI: 'เร็วและเบา แลกกับรายละเอียดที่น้อยลง',
};

export function ModelPicker({ value, onChange }: Props) {
  return (
    <div className="model-pick" role="radiogroup" aria-label="รุ่นของโมเดล">
      {MODELS.map((model) => (
        <label key={model} className="model-card" data-on={value === model}>
          <input
            type="radio"
            name="kieModel"
            className="sr-only"
            checked={value === model}
            onChange={() => onChange(model)}
          />
          <span className="model-card-name">{model}</span>
          <span className="model-card-desc">{DESCRIPTIONS[model]}</span>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: ตรวจชนิด**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/components/ModelPicker.tsx web/index.css
git commit -m "feat(web): add a model version picker built from the existing card style"
```

---

### Task 7: ประกอบทุกอย่างเข้า `CreatePanel`

**Files:**
- Modify: `web/components/CreatePanel.tsx`

**Interfaces:**
- Consumes: `ModelPicker` (Task 6), `TuningSlider` props ใหม่ (Task 5), `Draft.model` / `Draft.duration` (Task 4), `GenerateBody.duration` (Task 4)
- Produces: ฟอร์มส่ง `model` และ `duration` ที่ผู้ใช้เลือก

- [ ] **Step 1: เพิ่ม import และดึงฟิลด์ใหม่ออกจาก draft**

เพิ่ม `fmtDuration` เข้าไปใน import จาก `../lib/api` และเพิ่ม import ใหม่:

```tsx
import { ModelPicker } from './ModelPicker';
```

ในบล็อก destructure ของ draft เพิ่ม `model, duration`:

```tsx
  const {
    lyrics, style, title, instrumental, negativeTags, personaId, personaModel,
    vocalGender, styleWeight, weirdnessConstraint, audioWeight, model, duration,
  } = draft;
```

- [ ] **Step 2: ส่ง `model` จาก draft และเพิ่ม `duration` ใน body**

ใน `submit` แทน `model: 'V5',` ด้วย:

```tsx
        model,
```

และเพิ่มต่อจากบรรทัด `audioWeight`:

```tsx
        ...(numOrUndefined(duration) !== undefined ? { duration: numOrUndefined(duration) } : {}),
```

- [ ] **Step 3: วางตัวเลือกรุ่นไว้บนสุดของฟอร์ม**

แทรกก่อนบล็อก `{/* Title */}`:

```tsx
      {/* Model version */}
      <div>
        <label className="field-label">รุ่นของโมเดล</label>
        <ModelPicker value={model} onChange={(v) => set('model', v)} />
      </div>
```

- [ ] **Step 4: เพิ่มสไลเดอร์ความยาวเพลงในกลุ่มปรับแต่งสไตล์**

ในบล็อก `{/* Style tuning */}` เพิ่มเป็นสไลเดอร์ตัวแรกก่อน "ยึดสไตล์":

```tsx
          <TuningSlider
            label="ความยาวเพลง"
            hint="ความยาวโดยประมาณของเพลงที่ต้องการ เป็นวินาที — ไม่ตั้งค่าแล้วปล่อยให้ kie ตัดสินใจเอง"
            value={duration}
            onChange={(v) => set('duration', v)}
            min={10}
            max={360}
            step={5}
            format={fmtDuration}
          />
```

- [ ] **Step 5: ย้าย `audioWeight` ให้แสดงเฉพาะเมื่อเลือก persona**

ลบบล็อก `<TuningSlider ... label="น้ำหนักเสียงอ้างอิง" ... />` ออกจากกลุ่ม "ปรับแต่งสไตล์"
แล้วนำไปวางไว้ **ภายในบล็อก `{personaId && ( ... )}`** ของส่วน persona ต่อจาก radio
"เอาแนวดนตรี / เอาเสียงร้อง":

```tsx
              <div className="mt-3">
                <TuningSlider
                  label="น้ำหนักเสียงอ้างอิง"
                  hint="สัดส่วนอิทธิพลของ persona เสียงอ้างอิง เทียบกับปัจจัยอื่น"
                  value={audioWeight}
                  onChange={(v) => set('audioWeight', v)}
                />
              </div>
```

**หมายเหตุ:** ปล่อยให้ค่าที่ผู้ใช้เคยตั้งไว้ค้างใน draft ตามเดิม ไม่ต้องล้างเมื่อยกเลิก persona
— ถ้าไม่มี `personaId` ค่านั้นจะถูกส่งไป kie แต่ไม่มีผล และการล้างทิ้งจะทำให้ผู้ใช้เสียค่าที่ตั้งไว้
เมื่อสลับ persona ไปมา

- [ ] **Step 6: ตรวจชนิดและรัน**

Run: `npm run typecheck && npm test`
Expected: PASS ทั้งคู่

- [ ] **Step 7: เปิดดูของจริง**

Run: `npm run dev`

ตรวจด้วยตา:
- การ์ดสามใบเรียงกันบนสุด `V6` ถูกเลือกไว้ตั้งแต่แรก
- คลิกการ์ดอื่นแล้วเปลี่ยนสีตาม รีเฟรชหน้าแล้วยังจำรุ่นที่เลือกไว้
- สไลเดอร์ความยาวแสดง "อัตโนมัติ" ตอนยังไม่แตะ และแสดงเป็น `m:ss` เมื่อลาก
- สไลเดอร์ "น้ำหนักเสียงอ้างอิง" ไม่ปรากฏจนกว่าจะเลือก persona
- ที่ความกว้างจอโทรศัพท์ การ์ดเรียงลงเป็นคอลัมน์เดียว

- [ ] **Step 8: Commit**

```bash
git add web/components/CreatePanel.tsx
git commit -m "feat(web): let the create form pick a model version and song length

audioWeight moves under the persona block: it only has an effect when
reference audio exists, which in this app means a persona is selected."
```

---

### Task 8: ปุ่มลองใหม่ใช้โมเดลของเพลงเดิม

**Files:**
- Modify: `web/components/LibraryGrid.tsx:25`

**Interfaces:**
- Consumes: `Song.model` (มีอยู่แล้ว เป็น `string`)
- Produces: ไม่มีอะไรให้ task หลังใช้ — task สุดท้ายของฝั่งโค้ด

- [ ] **Step 1: แก้บรรทัดเดียว**

ใน `retry` แทน `model: 'V5',` ด้วย:

```tsx
      model: song.model,
```

- [ ] **Step 2: ตรวจชนิดและรัน**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/components/LibraryGrid.tsx
git commit -m "fix(web): retry a failed song with the model it was created with"
```

---

### Task 9: ทดสอบกับ kie จริงและวัดพฤติกรรมของ `duration`

**Files:**
- Modify: `docs/superpowers/plans/2026-09-10-suno-v6-version-selector.md` (บันทึกผลที่วัดได้ลงในส่วนท้ายของ task นี้)

**Interfaces:**
- Consumes: ระบบทั้งหมดจาก Task 1-8
- Produces: ผลการวัดที่ตัดสินว่าต้องตั้งค่าตั้งต้นของความยาวหรือไม่

**เหตุผลที่ต้องมี task นี้:** schema ของ kie ระบุ `duration` เป็น `default: 20` ถ้าค่านั้นมีผลจริง
เมื่อไม่ได้ส่งฟิลด์ไป เพลงที่สร้างโดยไม่ตั้งความยาวจะยาวแค่ 20 วินาที ซึ่งทำให้ค่าว่าง
เป็นค่าตั้งต้นที่ผิด เอกสารไม่ได้บอกว่าค่านี้มีผลเมื่อ "ไม่ส่งฟิลด์" หรือเฉพาะตอน
"ส่งฟิลด์มาแต่เป็นค่าว่าง" จึงต้องวัดเอา

- [ ] **Step 1: สร้างเพลงโดยไม่ตั้งความยาว**

Run: `npm run dev`

สร้างเพลงหนึ่งเพลงด้วยรุ่น `V6` โดยเว้นสไลเดอร์ความยาวไว้ที่ "อัตโนมัติ" รอจนสถานะเป็น SUCCESS

- [ ] **Step 2: อ่านความยาวจริงที่ได้กลับมา**

```bash
npx wrangler d1 execute song-auto-db --local \
  --command "SELECT title, model, duration FROM songs ORDER BY created_at DESC LIMIT 2"
```

(ถ้าทดสอบกับฐานข้อมูลจริง ใช้ `--remote` แทน `--local`)

- [ ] **Step 3: ตัดสินจากตัวเลขที่วัดได้**

- ถ้า `duration` ราว **120-240 วินาที** → ค่าตั้งต้นในสเปกไม่มีผลเมื่อไม่ส่งฟิลด์ ปล่อยค่าว่างไว้ได้ ไปต่อ Step 5
- ถ้า `duration` ราว **20 วินาที** → ค่าตั้งต้นมีผลจริง ต้องทำ Step 4

- [ ] **Step 4: (ทำเฉพาะเมื่อได้ 20 วินาที) ตั้งค่าตั้งต้นของความยาว**

ใน `web/lib/draft.ts` เปลี่ยน `EMPTY_DRAFT.duration` จาก `''` เป็น `'180'`
และแก้เทสต์ใน `tests/draft.test.ts` ที่ยืนยันว่า draft เก่าให้ `duration` เป็น `''`
ให้คาดหวัง `'180'` แทน พร้อมแก้คอมเมนต์ในนิยาม `Draft.duration` ให้ตรงกับความจริงใหม่

จากนั้นรัน `npm test` ให้ผ่าน แล้ว commit:

```bash
git add web/lib/draft.ts tests/draft.test.ts
git commit -m "fix(web): default the song length to 180s

Measured: a V6 generation with no duration field comes back at ~20s, so
an unset value is not a safe default."
```

- [ ] **Step 5: สร้างเพลงอีกเพลงโดยตั้งความยาวเอง**

ตั้งสไลเดอร์ที่ราว 2:30 แล้วสร้าง ตรวจว่าความยาวที่ได้กลับมาใกล้เคียงค่าที่ขอ

- [ ] **Step 6: ทดสอบ persona บน V6**

เลือก persona ที่มีอยู่ (หรือสร้างใหม่จากเพลงที่เพิ่งได้) แล้วสร้างเพลงอีกเพลง
ยืนยันว่าไม่ติด error เรื่องโมเดล และสไลเดอร์ "น้ำหนักเสียงอ้างอิง" ปรากฏขึ้น

- [ ] **Step 7: บันทึกผลลงในแผน**

เพิ่มหัวข้อท้ายไฟล์แผนนี้:

```markdown
## ผลการวัดจริง (Task 9)

- ไม่ส่ง `duration` → ได้เพลงยาว ___ วินาที
- ส่ง `duration: 150` → ได้เพลงยาว ___ วินาที
- persona บน V6 → ผ่าน / ไม่ผ่าน: ___
```

กรอกตัวเลขจริงลงไป แล้ว commit:

```bash
git add docs/superpowers/plans/2026-09-10-suno-v6-version-selector.md
git commit -m "docs: record the measured duration behaviour on V6"
```

---

## เกณฑ์ว่าเสร็จทั้งแผน

1. `npm run typecheck` ผ่าน
2. `npm test` ผ่านทั้งชุด
3. ไม่มีสตริง `'V5'` เหลืออยู่ในโค้ดที่รันจริง — ตรวจด้วย
   `grep -rn "'V5'" src web --include='*.ts' --include='*.tsx'` แล้วต้องไม่เจออะไร
4. สร้างเพลงจริงด้วย V6 ได้ครบทั้งขั้นตอนจนได้ไฟล์เสียง
5. พฤติกรรมของ `duration` ถูกวัดและบันทึกไว้ในแผนแล้ว

## ผลการวัดจริง (Task 9)

วัดเมื่อ 2026-09-10 กับ kie.ai จริง ผ่าน `npm run dev` (D1 local) โมเดล `V6` custom mode
เพลงบรรเลง สไตล์ `lo-fi chill hop, warm vinyl crackle, mellow piano`

- ไม่ส่ง `duration` → ได้เพลงยาว **164 วินาที**
  → `default: 20` ในสเปกของ kie **ไม่มีผลเมื่อไม่ส่งฟิลด์** ค่าว่างจึงเป็นค่าตั้งต้นที่ปลอดภัย
  **ไม่ต้องทำ Step 4** — `EMPTY_DRAFT.duration` คงเป็น `''` ตามเดิม
- ส่ง `duration: 150` → ได้เพลงยาว **150 วินาที** (ตรงเป๊ะ)
- persona บน V6 → **ผ่าน** สร้าง persona จากเพลง V6 ได้ (`personaId` 93c9a495…) แล้วสร้างเพลงใหม่
  ด้วย `personaModel: style_persona` + `audioWeight: 0.65` สำเร็จ ยาว 164.76 วินาที ไม่มี error
  เรื่องโมเดล — ยืนยันว่าการลบข้อจำกัด `PERSONA_CAPABLE_MODELS = ['V5']` ใน Task 1 ถูกต้อง

ทั้งสามเพลงไหลครบวงจร PENDING → SUCCESS ได้ไฟล์ `.wav` ใน R2
