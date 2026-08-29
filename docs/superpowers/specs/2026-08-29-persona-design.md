# Persona — สร้างจากเพลงที่ทำแล้ว แล้วใช้สร้างเพลงใหม่

**วันที่:** 2026-08-29
**สถานะ:** อนุมัติดีไซน์แล้ว รอแผน implementation
**สเปกก่อนหน้าที่อันนี้พึ่ง:** `2026-08-29-two-variants-per-generation-design.md` (เป็นตัวที่เริ่มเก็บ `suno_id`)

## ที่มา

kie.ai/Suno มี Persona — "ตัวตนทางดนตรี" ที่สกัดจากเพลงที่สร้างไว้แล้ว ใช้ซ้ำเพื่อให้เพลงใหม่
มีสไตล์หรือเสียงร้องใกล้เคียงของเดิม (ดู `docs/suno-api.md` หัวข้อ *Generate Persona*)
โปรเจกต์ยังไม่ได้แตะฟีเจอร์นี้เลย

**ข้อเท็จจริงสองข้อที่กำหนดรูปร่างของงานนี้** (ตรวจจาก `docs/suno-extract.md` และ `docs/extend-music.txt`):

1. **kie ไม่มี endpoint ดึงรายการ persona** — สร้างแล้วได้ `personaId` คืนมาก้อนเดียว
   ถ้าเราไม่เก็บเอง มันหายทันที
2. **การสร้าง persona ต้องใช้ `audioId` ของแทร็ก** (`suno_id` ในฐานเรา) ซึ่งเพิ่งเริ่มเก็บในสเปกก่อนหน้า
   เพลงที่สร้างก่อนหน้านั้นมี `suno_id = NULL` จึงใช้สร้าง persona ไม่ได้

ข้อจำกัดจาก API ที่เข้ากับของเดิมพอดี: `personaId` ใช้ได้เฉพาะ `customMode: true` และ
`personaModel` ใช้ได้เฉพาะโมเดล V5/V5_5 — โปรเจกต์นี้ส่ง custom mode และ V5 อยู่แล้วเสมอ

## เป้าหมาย

กดปุ่มบนการ์ดเพลงเพื่อทำ persona จากเพลงนั้น แล้วเลือก persona นั้นตอนสร้างเพลงใหม่ได้

## ไม่อยู่ในขอบเขต

- แก้ชื่อ / ลบ persona (kie เองก็ไม่มี endpoint ลบ) — ถ้ารายการรกค่อยว่ากันทีหลัง
- `vocalStart` / `vocalEnd` (เลือกช่วงวินาทีที่ใช้สกัดเสียง) — ใช้ค่าเริ่มต้นของ kie (0–30 วินาที)
- ตัวเลือกโมเดล, พารามิเตอร์ปรับเสียง (`vocalGender`, `styleWeight`, ...), simple mode
- ฟีเจอร์ persona ใน extend / upload-cover — สเปกนี้แตะเฉพาะ generate
- ไม่เพิ่ม dependency ใหม่

## ดีไซน์

### 1. ฐานข้อมูล

ตารางใหม่:

```sql
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  song_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_personas_created ON personas (created_at DESC);
```

| คอลัมน์ | ความหมาย |
|---------|----------|
| `id` | id ของเรา (`nanoid()`) |
| `persona_id` | `personaId` ที่ kie คืนมา — ตัวที่ส่งกลับไปตอน generate |
| `name` / `description` | ที่ผู้ใช้กรอก (kie บังคับทั้งคู่) |
| `song_id` | เพลงต้นทาง (`songs.id` ของเรา) — ไว้บอกที่มา |
| `created_at` | ISO string |

`song_id` ไม่ใส่ foreign key เพื่อให้ persona อยู่รอดถ้าเพลงต้นทางถูกลบภายหลัง

### 2. Endpoints

**`POST /api/personas`** — body `{ songId: string, name: string, description: string }`

1. ตรวจ `name` และ `description` ต้องไม่ว่าง → ไม่ผ่าน = 400
2. อ่านแถวเพลงจาก `songId` → ไม่เจอ = 404
3. แถวนั้น `suno_id` เป็น null = **400** พร้อมข้อความไทยว่าเพลงนี้สร้างก่อนระบบเก็บข้อมูลที่ persona ต้องใช้
   (ไม่เรียก kie เลยในเคสนี้ — ไม่เสียเครดิต)
4. เรียก `POST https://api.kie.ai/api/v1/generate/generate-persona` ด้วย
   `{ taskId: <task_id ของแถว>, audioId: <suno_id ของแถว>, name, description }`
   → envelope code ≠ 200 หรือ network error = **502** ไม่มีแถวค้างในตาราง
5. insert แถว persona แล้วคืน `201 { persona }`

**`GET /api/personas`** — `{ personas: PersonaRow[] }` เรียงใหม่สุดก่อน

**`POST /api/generate` รับเพิ่ม 2 ฟิลด์:** `personaId?: string` และ
`personaModel?: 'style_persona' | 'voice_persona'`

- มีทั้งคู่ → ส่งต่อไป kie ทั้งสองฟิลด์
- **มีมาแค่ฟิลด์เดียว → 400** ไม่เรียก kie (สองฟิลด์นี้ไม่มีความหมายเมื่ออยู่ลำพัง)
- ไม่มีเลย → body ที่ส่งไป kie ต้อง**ไม่มีสองคีย์นี้อยู่เลย** ไม่ใช่ส่งค่า `undefined`
  (ตามรูปแบบเดิมของ `kieGenerate` ที่ใส่ `negativeTags` เฉพาะเมื่อมีค่า)
- `personaModel` ที่ไม่ใช่สองค่านี้ → 400

### 3. หน้าตา

**การ์ดเพลง (`SongCard`)**

ปุ่มไอคอนที่มุมขวาบนของปก ข้างปุ่มดาวน์โหลด โผล่ตอน hover/โฟกัสเหมือนกัน
แสดงเฉพาะเพลงที่ `status === 'SUCCESS'` **และ** `sunoId !== null` — เพลงเก่าจึงไม่มีปุ่มนี้เอง
ไม่ต้องเขียนเงื่อนไขพิเศษให้ข้อมูลเก่า

กดแล้ว **ใต้ชื่อเพลงในการ์ดเดิมกางออก** (ไม่ใช่ modal — โปรเจกต์นี้เอา modal ออกไปแล้วโดยตั้งใจ):

- ช่องชื่อ persona — ว่าง
- ช่องคำอธิบาย — **เติมไว้ให้ล่วงหน้า** จาก `tags` และ `style` ของเพลงนั้น ผู้ใช้แก้ได้
  (kie ระบุว่าคำอธิบายยิ่งละเอียดยิ่งจับลักษณะดนตรีได้ดี)
- ปุ่ม "สร้าง" และ "ยกเลิก"

สำเร็จ → ส่วนที่กางหุบ + toast · ล้มเหลว → ข้อความ error ในส่วนที่กางอยู่ ค่าที่กรอกไม่หาย
การ์ดใบอื่นไม่ขยับ คลังยังมองเห็นได้เต็มตา

**ฟอร์มสร้างเพลง (`CreatePanel`)**

ช่องเลือก persona อยู่ใต้ Title:

- **ยังไม่มี persona สักอัน → ไม่แสดงอะไรเลย** ฟอร์มหน้าตาเหมือนเดิมทุกประการ
- มีแล้ว → dropdown ค่าเริ่มต้น "ไม่ใช้ persona"
- เลือก persona แล้ว → โผล่ตัวเลือก 2 อันใต้มัน: **"เอาแนวดนตรี"** (`style_persona`, ค่าเริ่มต้น)
  และ **"เอาเสียงร้อง"** (`voice_persona`)
- ทั้งสองค่าเข้าไปอยู่ใน draft ที่จำใน localStorage เหมือนช่องอื่น
  **draft เก่าที่ไม่มีสองฟิลด์นี้ต้องอ่านได้ตามปกติ** (ถือว่าไม่ใช้ persona) —
  `loadDraft` มี guard ต่อฟิลด์อยู่แล้ว ขยายให้ครอบสองฟิลด์ใหม่

**การโหลดรายการ**

hook ใหม่ `usePersonas` — ยิง `GET /api/personas` ครั้งเดียวตอนเปิดหน้า และเพิ่มรายการใหม่
เข้า state ทันทีเมื่อสร้างสำเร็จ (ไม่ยิงซ้ำ) แยกจาก `useSongs` เพราะคนละเรื่อง และ `useSongs`
มี logic polling ที่ไม่ควรพันกับของใหม่

### 4. ไฟล์ที่กระทบ

| ไฟล์ | ทำอะไร |
|------|--------|
| `migrations/0004_personas.sql` | **สร้างใหม่** — ตาราง + index |
| `src/worker/types.ts` | `PersonaRow` ใหม่ |
| `src/worker/kie.ts` | `kieCreatePersona()` ใหม่ · `GenerateInput` += `personaId`/`personaModel` · validate สองฟิลด์นี้ · ส่งต่อใน `kieGenerate` |
| `src/worker/personas.ts` | **สร้างใหม่** — `createPersona` / `listPersonas` (แยกไฟล์ ไม่ยัดเพิ่มใน `routes.ts` ที่มี logic เพลงอยู่แล้ว) |
| `src/worker/index.ts` | ผูก 2 route ใหม่ |
| `web/lib/api.ts` | `Persona` type · `GenerateBody` += 2 ฟิลด์ |
| `web/lib/draft.ts` | `Draft` += `personaId`, `personaModel` พร้อม guard |
| `web/hooks/usePersonas.ts` | **สร้างใหม่** |
| `web/components/SongCard.tsx` | ปุ่ม + ส่วนที่กางออก |
| `web/components/CreatePanel.tsx` | dropdown + ตัวเลือกโหมด |
| `web/App.tsx` | ต่อ `usePersonas` เข้ากับ `CreatePanel` และ `LibraryGrid` |
| `web/components/LibraryGrid.tsx` | ส่ง callback สร้าง persona ลง `SongCard` |
| `web/index.css` | สไตล์ของส่วนที่กางออก |
| `tests/personas.test.ts` | **สร้างใหม่** |
| `tests/api.test.ts` | D1 ปลอมต้องรู้จักตาราง `personas` · เทสต์ persona ใน generate |

## การทดสอบ

**ต้องรู้ก่อน:** D1 ปลอมใน `tests/api.test.ts` parse SQL จริงและมีสมมติฐานว่าทุก query คุยกับตาราง
`songs` ตารางเดียว การเพิ่ม `personas` ต้องขยายมันให้แยกตารางได้ — เป็นส่วนหนึ่งของงาน ไม่ใช่
ผลข้างเคียงที่ค่อยไปเจอ

เทสต์ที่เพิ่ม (vitest ที่มีอยู่ ไม่เพิ่ม dependency):

1. `POST /api/personas` สำเร็จ → เรียก kie ครั้งเดียวด้วย `taskId` + `audioId` ที่ตรงกับแถวเพลง
   และบันทึก `persona_id` ที่ kie คืนมา
2. เพลงที่ `suno_id` เป็น null → 400 และ**ไม่เรียก kie เลย**
3. `songId` ไม่มีในฐาน → 404
4. kie ตอบ envelope code ≠ 200 → 502 และไม่มีแถวค้างในตาราง
5. `name` หรือ `description` ว่าง → 400 ไม่เรียก kie
6. `GET /api/personas` → คืนรายการเรียงใหม่สุดก่อน
7. `POST /api/generate` พร้อม `personaId` + `personaModel` → body ที่ไปถึง kie มีสองฟิลด์ครบ
8. ส่งมาแค่ฟิลด์เดียว (อย่างใดอย่างหนึ่ง) → 400 ไม่เรียก kie
9. `personaModel` เป็นค่าอื่น → 400
10. ไม่ส่งเลย → body ที่ไปถึง kie **ไม่มีคีย์ `personaId`/`personaModel`**

บวก `npm run typecheck` · `npm run build` · ตรวจด้วยตา: ปุ่มโผล่เฉพาะเพลงที่มี `suno_id` ·
กางแล้วคำอธิบายถูกเติมมาให้ · สร้างแล้ว dropdown ในฟอร์มมีตัวเลือกเพิ่ม · เลือกแล้วรีเฟรชค่ายังอยู่ ·
เพลงเก่า 2 เพลงไม่มีปุ่ม
