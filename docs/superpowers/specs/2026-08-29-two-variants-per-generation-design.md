# สองเวอร์ชันต่อการสร้างหนึ่งครั้ง (Two Variants per Generation)

**วันที่:** 2026-08-29
**สถานะ:** อนุมัติดีไซน์แล้ว รอแผน implementation
**สเปกถัดไปที่พึ่งอันนี้:** persona (ต้องใช้ `suno_id` ที่สเปกนี้เริ่มเก็บ)

## ปัญหา

kie.ai/Suno สร้าง **2 แทร็ก** ต่อหนึ่ง `taskId` และคืนมาใน `sunoData[]` (ดู `docs/suno-api.md`
หัวข้อ *Get Music Task Details*) แต่ `kiePollTask` หยิบ `sunoData[0]` ตัวเดียว (`src/worker/kie.ts:141`)
แทร็กที่สองถูกทิ้งทุกครั้ง ทั้งที่จ่ายเครดิตไปแล้ว

นอกจากนั้นสถานะ `FIRST_SUCCESS` (แทร็กแรกเสร็จ ส่วนที่สองยังทำอยู่) ถูก map เป็น PENDING เฉยๆ
(`src/worker/kie.ts:135`) โดยไม่แตะ `sunoData` ผู้ใช้จึงต้องรอจนครบทั้งสองแทร็กก่อนได้ฟังอะไรเลย

## เป้าหมาย

หนึ่งครั้งที่กดสร้าง = 2 การ์ดในคลัง · การ์ดไหนเสร็จก่อนเล่นได้ก่อน · เก็บ `suno_id` ของแต่ละแทร็ก
ไว้ให้สเปก persona ใช้ต่อ

## ไม่อยู่ในขอบเขต

- persona ทุกส่วน (สเปกแยก ทำต่อจากอันนี้)
- ตัวเลือกโมเดล, `vocalGender`, `styleWeight`, `weirdnessConstraint`, `audioWeight`
- simple mode — ตัดออกตามที่เจ้าของตัดสินใจแล้ว ฟอร์มบังคับ style + title ต่อไป
  (ตรงกับที่ docs ระบุว่า `customMode: true` ⇒ style และ title required ทั้งคู่)
- ไม่เพิ่ม dependency ใหม่

## ดีไซน์

### 1. ฐานข้อมูล

เพิ่ม 2 คอลัมน์ใน `songs`:

| คอลัมน์ | ชนิด | ความหมาย |
|---------|------|----------|
| `suno_id` | `TEXT` (null ได้) | id ของแทร็กฝั่ง Suno (`sunoData[i].id`) — persona จะใช้ค่านี้เป็น `audioId` |
| `variant` | `INTEGER NOT NULL DEFAULT 1` | 1 หรือ 2 — บอกว่าแถวนี้ยึด `sunoData` ตัวไหน |

พร้อม `CREATE UNIQUE INDEX ON songs (task_id, variant)` — กันการสร้างแถวซ้ำเมื่อ poll ซ้อนกัน

แถวเก่าที่มีอยู่ได้ `variant = 1` และ `suno_id = NULL` โดยอัตโนมัติ ไม่ต้อง backfill

### 2. ตอนกดสร้าง

`createSong` (`src/worker/routes.ts`) เรียก kie ครั้งเดียวได้ `taskId` มาเหมือนเดิม
แล้ว **insert 2 แถว** ด้วย `DB.batch([...])` (D1 ไม่มีทรานแซกชันแบบเปิด/ปิดเอง — `batch` คือวิธีที่ทำให้สองคำสั่งไปด้วยกัน):

- id คนละตัว (`nanoid()` แยกกัน) · `task_id` เดียวกัน · `variant` 1 กับ 2
- ฟิลด์ที่เหลือ (title, prompt, style, model, instrumental, created_at) เหมือนกันทั้งคู่
- สถานะ PENDING ทั้งคู่

Response เปลี่ยนจาก `{ id, status }` เป็น `{ songs: SongRow[] }` — คืนแถวเต็มทั้งสองใบ
(เหตุผลอยู่ในหัวข้อ 5)

### 3. ตอน poll

`getTask` อ่านแถวจาก id เหมือนเดิม แล้ว poll `record-info` ด้วย `task_id` ของแถวนั้น
จากนั้น **หยิบ `sunoData[variant - 1]`** — แต่ละแถวสนใจแค่แทร็กของตัวเอง

`kiePollTask` ต้องเปลี่ยนสัญญา: เดิมคืน track เดียวจาก `sunoData[0]` ให้เปลี่ยนเป็นคืน
`tracks: TrackInfo[]` (ทั้งอาเรย์ตามที่ kie ส่งมา) พร้อม `taskStatus` ดิบ แล้วให้ `getTask`
เลือกตัวที่ตรง `variant` เอง — ตรรกะ "แถวไหนเอาแทร็กไหน" อยู่ที่เดียวคือ `getTask`

`TrackInfo` เพิ่มฟิลด์ `sunoId: string` (จาก `sunoData[i].id`)

ตารางพฤติกรรม (`s` = สถานะจาก kie, `n` = จำนวนไอเทมใน `sunoData`):

| s | n | แถว v1 | แถว v2 |
|---|---|--------|--------|
| `PENDING` / `TEXT_SUCCESS` | 0 | PENDING ต่อ | PENDING ต่อ |
| `FIRST_SUCCESS` | 1 | โหลดไฟล์ → SUCCESS | PENDING ต่อ |
| `SUCCESS` | 2 | โหลดไฟล์ → SUCCESS | โหลดไฟล์ → SUCCESS |
| `SUCCESS` | 1 | โหลดไฟล์ → SUCCESS | **ลบแถวทิ้ง** |
| FAILED enum ใดๆ | – | FAILED + errorMessage | **ลบแถวทิ้ง** |

การโหลด mp3 + ปก + ที่เก็บ R2 (`${id}.mp3` / `${id}.jpg`) และการ retry ดาวน์โหลด ≤3 ครั้ง
ใช้ของเดิมทุกอย่าง เพราะ key ผูกกับ id ของแถว ซึ่งแยกกันอยู่แล้ว

**กันงานซ้ำ:** ก่อนโหลดไฟล์ ถ้าแถวนั้น `status = 'SUCCESS'` และมี `r2_key` แล้ว ให้คืนแถวเดิม
โดยไม่โหลดซ้ำ

### 4. การยุบการ์ดที่ไม่ได้ใช้

เมื่อแถวถูกลบ (ตามตารางข้างบน) `GET /api/tasks/:id` ตอบ `{ status: 'GONE' }` พร้อม HTTP 200
หน้าเว็บเห็นค่านี้แล้วเอาการ์ดออกจากคลัง

เลือก 200 + สถานะในเนื้อ ไม่ใช่ 404 เพราะ `api()` ใน `web/lib/api.ts` โยน `ApiError` ทุก non-2xx
ซึ่ง `pollOnePending` กลืนไว้เงียบๆ (`.catch()`) การ์ดจะค้างตลอดกาล

### 5. หน้าเว็บ

**`web/lib/api.ts`** — `Song` เพิ่ม `variant: number` และ `sunoId: string | null`

**`POST /api/generate` คืนแถวเต็ม** เพื่อให้ `CreatePanel` เลิกประกอบ object เพลง 14 ฟิลด์ขึ้นเอง
อย่างที่ทำอยู่ทุกวันนี้ — โค้ดชุดนั้นเปราะ (schema เปลี่ยนแล้วลืมแก้ = การ์ดแสดงข้อมูลผิดจนกว่าจะรีเฟรช)
และตอนนี้จะต้องประกอบ 2 ก้อนพร้อมกันซึ่งแย่กว่าเดิม

| ไฟล์ | เปลี่ยนอะไร |
|------|-------------|
| `web/hooks/useSongs.ts` | `upsert` รับ `Song \| Song[]` · เพิ่ม `remove(id)` · `pollOnePending` เจอ `GONE` → `remove` |
| `web/components/CreatePanel.tsx` | `onCreated(songs: Song[])` · ใช้แถวที่เซิร์ฟเวอร์คืนมาตรงๆ |
| `web/App.tsx` | upsert ทั้ง 2 แถว · `setActiveId(songs[0].id)` |
| `web/components/LibraryGrid.tsx` | ปุ่มลองใหม่: `remove(song.id)` แล้ว upsert 2 แถวใหม่ |
| `web/components/SongCard.tsx` | ป้าย `v1`/`v2` มุมปก |

**กติกาป้าย:** แสดงเมื่อมีเพลงอื่นใน list ที่ `taskId` เดียวกัน (คำนวณใน `LibraryGrid` ส่งลงมาเป็น prop
`showVariant: boolean`) — เพลงเก่าที่ไม่มีคู่จึงไม่มีป้ายเอง ไม่ต้องเขียนเงื่อนไขให้ข้อมูลเก่า

**ไม่ต้องแตะ:** `PlayerBar`, ปุ่มก่อนหน้า/ถัดไป, ช่องค้นหา, `filterSongs` — 2 เวอร์ชันคือเพลง 2 เพลง
ตามปกติในสายตาโค้ดเดิม

### 6. การ poll ที่ถี่ขึ้น

`useSongs` poll ทีละหนึ่งแถว PENDING ทุก 10 วินาที มี 2 แถว = แต่ละแถวถูก poll ทุก 20 วินาที
kie จำกัด 3 requests/วินาที/task — ห่างจากเพดานมาก ไม่ต้องแก้จังหวะ polling

## การทดสอบ

**ต้องรู้ก่อน:** `tests/api.test.ts` มี D1 ปลอมที่ parse SQL จริงและผูกกับจำนวน bind แบบตายตัว
(`INSERT INTO songs` = 13 binds) การเพิ่ม 2 คอลัมน์ทำให้มันพังทันที — การอัปเดต D1 ปลอมเป็น
**ส่วนหนึ่งของงาน** ไม่ใช่ผลข้างเคียงที่ค่อยไปเจอตอนรันเทสต์

เทสต์ที่เพิ่ม (vitest ที่มีอยู่ ไม่เพิ่ม dependency):

1. สร้าง 1 ครั้ง → 2 แถว `task_id` เดียวกัน `variant` 1 และ 2 · response มี `songs` 2 ก้อน
2. `FIRST_SUCCESS` + `sunoData` 1 ตัว → v1 SUCCESS, v2 ยัง PENDING
3. `SUCCESS` + 2 ตัว → ทั้งคู่ SUCCESS และ `suno_id` คนละค่า
4. `SUCCESS` + 1 ตัว → v2 ถูกลบ ตอบ `{ status: 'GONE' }`
5. FAILED → v1 FAILED พร้อม errorMessage, v2 ถูกลบ
6. poll ซ้ำหลัง SUCCESS → ไม่ insert ซ้ำ ไม่โหลดไฟล์ซ้ำ (นับจำนวนครั้งที่ fetch ถูกเรียก)

บวก `npm run typecheck` · `npm run build` · ตรวจด้วยตา: กดสร้างแล้วขึ้น 2 การ์ดทันที,
การ์ดแรกเล่นได้ก่อนการ์ดที่สองเสร็จ, ป้าย v1/v2 ขึ้นถูกใบ, เพลงเก่าไม่มีป้าย
