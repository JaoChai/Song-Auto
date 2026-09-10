# รองรับ Suno V6 family และให้ผู้ใช้เลือก version ได้

วันที่ 2026-09-10

## ปัญหา

kie.ai ปลดระวางโมเดล Suno รุ่นเก่าไปแล้ว หน้า reference ปัจจุบัน
(`https://docs.kie.ai/suno-api/generate-music` ตรวจสอบเมื่อ 2026-09-10)
ทำเครื่องหมาย **V4, V4_5, V4_5PLUS, V4_5ALL, V5, V5_5 ว่า "Discontinued"** ทั้งหมด
และตั้ง default ของ `model` เป็น **`V6`** โดยมีชุดที่ใช้งานได้จริงคือ
`V6`, `V6_MINI`, `V6_WILD`

Song-Auto ยังล็อกอยู่ที่ชุดเก่าและส่ง `V5` เสมอ อยู่ 5 จุด:

| ไฟล์ | บรรทัด | อาการ |
|---|---|---|
| `src/worker/kie.ts` | 6 | `KIE_MODELS = ['V3_5','V4','V4_5','V4_5PLUS','V4_5ALL','V5']` |
| `src/worker/kie.ts` | 8 | `PERSONA_CAPABLE_MODELS = ['V5']` |
| `web/lib/api.ts` | 74 | `MODELS` ชุดเดียวกับข้างบน |
| `web/components/CreatePanel.tsx` | 67 | ส่ง `model: 'V5'` ตายตัว |
| `web/components/LibraryGrid.tsx` | 25 | ปุ่ม "ลองใหม่" ส่ง `model: 'V5'` ตายตัว |

พร้อมกันนั้น V6 เพิ่มพารามิเตอร์ `duration` (10–360 วินาที) ที่โปรเจกต์ยังไม่ได้ส่ง
schema ของ kie ระบุ `default: 20` ไว้ ซึ่งถ้ามีผลจริงจะได้เพลงยาวแค่ 20 วินาที

## ขอบเขต

**ทำ** — เปลี่ยนชุดโมเดลเป็น V6 family, ให้ผู้ใช้เลือก version ได้ในฟอร์มสร้างเพลง,
เพิ่มตัวคุมความยาวเพลง, และปิดจุดที่พังแน่ ๆ ที่ค้นพบระหว่างออกแบบ

**ไม่ทำ** — migration ฐานข้อมูล, capability matrix ต่อโมเดล, ตัวช่วยเขียน Style string,
ค่าตั้งต้น slider ตามแนวเพลง (แยกเป็น spec ต่างหากถ้าจะทำ)

## การตัดสินใจที่บันทึกไว้

### 1. รองรับเฉพาะ V6 family ไม่มีทางกลับไปใช้ของเก่า

`KIE_MODELS` เหลือ `['V6', 'V6_WILD', 'V6_MINI']` ทั้งชุด ไม่แยก enum สำหรับ
generate กับ extend

**ผลข้างเคียงที่ยอมรับแล้ว:** `routes.ts:308` ยืม `model` จากแถวเพลงต้นทางเวลาต่อเพลง
เพลงทุกแถวใน DB ปัจจุบันเป็น `V5` จึงจะ **ต่อเพลงเก่าไม่ได้อีกต่อไป** และปุ่ม "ลองใหม่"
บนเพลงเก่าที่ล้มเหลวก็จะไม่ผ่านเช่นกัน ข้อมูลชุดปัจจุบันเป็นข้อมูลทดสอบ
เจ้าของโปรเจกต์ยืนยันแล้วว่ายอมทิ้งได้

### 2. ไม่ต้องมี capability matrix

V6, V6_WILD, V6_MINI มีข้อจำกัดและความสามารถเหมือนกันทุกอย่าง — `prompt` 5000
ตัวอักษรใน custom mode / 3000 ใน non-custom, `style` 1000, `title` 80, รองรับ persona
ทั้งสองโหมด, รองรับ `duration` เท่ากัน ค่าคงที่ที่มีอยู่ตอนนี้ตรงกับ V6 อยู่แล้ว
ไม่ต้องแก้

ผลตามมา: `PERSONA_CAPABLE_MODELS` และการตรวจใน `validateExtend` กลายเป็น dead code
ให้ลบทิ้งทั้งคู่ — ทุกโมเดลที่ผ่าน `KIE_MODELS` มาแล้วรองรับ persona เสมอ

### 3. `duration` เป็น control ให้ผู้ใช้ตั้งเอง

เก็บใน draft เป็น **สตริง** ตามแบบเดียวกับ slider ที่มีอยู่ เพื่อแยก "ไม่ระบุ"
(ไม่ส่งไป kie) ออกจากค่าจริง ตรวจช่วง 10–360 ทั้งฝั่ง worker

### 4. ไม่เก็บ duration ที่ขอไว้ในฐานข้อมูล

คอลัมน์ `songs.duration` มีความหมายว่า "ความยาวจริงของแทร็กที่ poll กลับมา"
(`kiePollTask` เขียนค่านี้) การเอาค่าที่ผู้ใช้ขอไปทับจะทำลายความหมายนั้น
และทำให้แถวที่ยัง PENDING ดูเหมือนมีเพลงเสร็จแล้ว จึงส่งผ่านไป kie เฉย ๆ ไม่บันทึก

### 5. `duration` ส่งเฉพาะ custom mode

เอกสาร kie ระบุว่ามีผลเฉพาะเมื่อ `customMode: true` การส่งใน non-custom mode
จะถูกเมินเงียบ ๆ จึงตัดที่ต้นทางเลย ให้พฤติกรรมตรงกับที่เอกสารบอก

### 6. ซ่อน `audioWeight` จนกว่าจะเลือก persona

`audioWeight` คือ "น้ำหนักของฟีเจอร์เสียงเทียบกับปัจจัยอื่น" มีผลเฉพาะเมื่อมี
reference audio เข้ามาในระบบ ซึ่งในโปรเจกต์นี้เกิดขึ้นทางเดียวคือผ่าน persona
ตอนนี้ slider แสดงตลอดเวลา ผู้ใช้ที่ไม่ได้เลือก persona จึงกำลังลากปุ่มที่ไม่มีผลอะไร
ให้ผูกการแสดงผลไว้กับ `personaId` แบบเดียวกับที่ `vocalGender` ผูกกับ `instrumental`

## การเปลี่ยนแปลง

### `src/worker/kie.ts`

```
KIE_MODELS = ['V6', 'V6_WILD', 'V6_MINI']
ลบ PERSONA_CAPABLE_MODELS
เพิ่ม DURATION_MIN = 10, DURATION_MAX = 360
```

- `GenerateInput` เพิ่ม `duration?: number`
- `validateGenerate` ตรวจ `duration` — ต้องเป็นตัวเลขจำกัด อยู่ใน 10–360
  และปฏิเสธเมื่อไม่ใช่ custom mode
- `kieGenerate` ใส่ `body.duration` ในบล็อก `if (custom)` เดียวกับ `style`/`title`
- `validateExtend` ลบบล็อกที่ตรวจ `PERSONA_CAPABLE_MODELS` ออก
  (ข้อความ error `persona requires model V5` หายไปพร้อมกัน)

### `src/worker/routes.ts`

- route `POST /api/generate` ส่ง `duration` จาก body เข้า `GenerateInput`
  แบบเดียวกับ `styleWeight` ที่มีอยู่
- ไม่แตะส่วนที่เขียนลง DB

### `web/lib/api.ts`

- `MODELS = ['V6', 'V6_WILD', 'V6_MINI'] as const`
- `GenerateBody` เพิ่ม `duration?: number`

### `web/lib/draft.ts`

- `Draft` เพิ่ม `model: KieModel` และ `duration: string`
- `EMPTY_DRAFT` ตั้ง `model: 'V6'`, `duration: ''`
- `loadDraft` ต้องกรอง `model` ที่อ่านมาจาก localStorage — draft เก่าที่บันทึกไว้
  ไม่มีคีย์นี้ และถ้ามีก็อาจเป็น `'V5'` ที่ใช้ไม่ได้แล้ว ให้ตกกลับเป็น `'V6'`
  ใช้รูปแบบเดียวกับตัวช่วย `personaModel()` / `vocalGender()` ที่มีอยู่

### `web/components/CreatePanel.tsx`

- ส่ง `model` จาก draft แทนค่าตายตัว และส่ง `duration` เมื่อไม่ว่าง
  โดยใช้ `numOrUndefined` ที่มีอยู่แล้ว
- เพิ่มตัวเลือก version — 3 การ์ดเรียงกัน แต่ละอันมีชื่อโมเดลกับคำอธิบายไทยหนึ่งบรรทัด:
  - `V6` — มาตรฐาน เสียงร้องเป็นธรรมชาติ รายละเอียดแน่น
  - `V6_WILD` — กล้าและมีเอกลักษณ์กว่า
  - `V6_MINI` — เร็วและเบา
- เพิ่มตัวคุมความยาวเพลง วางไว้ในกลุ่ม "ปรับแต่งสไตล์" ที่มีอยู่
- ย้าย slider `audioWeight` ไปอยู่หลังส่วน persona และแสดงเมื่อ `personaId` ไม่ว่าง

### `web/components/LibraryGrid.tsx`

- ปุ่ม "ลองใหม่" ใช้ `song.model` แทน `'V5'` ตายตัว

### UI

ใช้รูปแบบที่โปรเจกต์มีอยู่แล้ว ไม่สร้างภาษาใหม่ — การ์ดแบบ tick-mark ที่ออกแบบไว้ใน
`TuningSlider` (commit 65bb5d9) และ `field-label` / `input` ที่ใช้ทั้งฟอร์ม
ตัวเลือก version เป็น radio group ที่มีลักษณะเดียวกับการ์ด tuning

ตัวคุมความยาวใช้ `TuningSlider` เดิม โดย**เพิ่ม props ที่ไม่บังคับ** `min`, `max`,
`step`, และ `format` ซึ่งมีค่าตั้งต้นเป็น `0`, `1`, `0.01` และการแสดงผลแบบเปอร์เซ็นต์
— ตรงกับพฤติกรรมปัจจุบันทุกอย่าง จุดเรียกเดิมทั้งสามที่จึงไม่ต้องแก้แม้แต่บรรทัดเดียว
ส่วนความยาวเรียกด้วย `min={10} max={360} step={5}` และ `format` ที่คืนค่าเป็น `m:ss`
สถานะยังไม่ได้ตั้งค่ายังคงแสดงว่า "อัตโนมัติ" เหมือน slider ตัวอื่น

เลือกทางนี้แทนการสร้าง component ใหม่เพราะมันคือ slider ที่ไม่บังคับตัวที่สี่ในกลุ่ม
เดียวกัน การทำ component คู่ขนานจะได้ CSS ซ้ำและหน้าตาที่หลุดกันเมื่อแก้ทีหลัง

## การทดสอบ

`tests/kie.test.ts` อ้าง `'V5'` อยู่ราว 8 จุด เปลี่ยนเป็น `'V6'` ทั้งหมด
`tests/api-client.test.ts`, `tests/filter.test.ts`, `tests/personas.test.ts`,
`tests/api.test.ts`, `tests/extend.test.ts`, `tests/draft.test.ts` มี fixture
ที่ใช้ `'V5'` เช่นกัน — fixture ที่เป็นแค่ข้อมูลแถวใน DB ไม่จำเป็นต้องเปลี่ยน
แต่ที่ผ่านเข้า validate ต้องเปลี่ยน

เทสต์ใหม่ที่ต้องเพิ่ม:

- `validateGenerate` รับ `duration` ที่ 10, 360 และค่ากลาง
- `validateGenerate` ปฏิเสธ 9, 361, `NaN`
- `validateGenerate` ปฏิเสธ `duration` เมื่อไม่ใช่ custom mode
- `kieGenerate` ใส่ `duration` ลง body เมื่อ custom mode และไม่ใส่เมื่อไม่ได้ระบุ
- `validateGenerate` / `validateExtend` ปฏิเสธโมเดลนอก V6 family
- `validateExtend` ยอมรับ persona บน V6 ทุกตัว
- `loadDraft` แปลง `model` ที่ไม่รู้จัก (รวม `'V5'` เดิม) เป็น `'V6'`
- `loadDraft` ตกกลับเป็น `'V6'` เมื่อ draft เก่าไม่มีคีย์ `model`
- `TuningSlider` ที่ไม่ส่ง props ช่วงค่า ยังทำงานเป็น 0–1 แบบเปอร์เซ็นต์เหมือนเดิม

## เกณฑ์ว่าเสร็จ

1. `npm run typecheck` ผ่าน
2. `npm test` ผ่านทั้งชุด
3. สร้างเพลงจริงหนึ่งเพลงด้วย V6 แล้วได้ไฟล์เสียงกลับมาครบ
4. **ทดสอบเรื่อง `duration` โดยเฉพาะ** — สร้างเพลงโดยไม่ระบุความยาว แล้วดูว่าได้กี่วินาที
   ถ้าได้ราว 20 วินาที แปลว่า default ในสเปกมีผลจริงและต้องตั้งค่าตั้งต้นให้ผู้ใช้
   ไม่ใช่ปล่อยว่าง บันทึกผลที่วัดได้ลงในแผน
