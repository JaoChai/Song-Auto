# ฟอร์มสร้างเพลงแบบค้างหน้าจอ (Always-on Create Form)

**วันที่:** 2026-08-29
**สถานะ:** อนุมัติดีไซน์แล้ว รอแผน implementation

## ปัญหา

ปุ่ม "สร้างเพลง" ใน `AppHeader` เปิด `SlideOver` ซึ่งเป็น modal เต็มรูปแบบ
(`role="dialog" aria-modal="true"`, backdrop ทึบ + blur, focus trap, `body.style.overflow = 'hidden'`)
ทับคลังเพลงไว้ แล้วปิดตัวเองทันทีที่สร้างสำเร็จพร้อมล้างค่าทุกช่อง

จุดที่ผู้ใช้รู้สึกขัด 3 จุด:

1. ต้องกดปุ่มเปิดฟอร์มก่อนทุกครั้ง
2. ระหว่างกรอกมองไม่เห็นคลังเพลงเลย
3. สร้างเสร็จฟอร์มปิด + ค่าหายหมด อยากแก้คำนิดเดียวก็ต้องเปิดใหม่แล้วพิมพ์ใหม่ทั้งหมด

## เป้าหมาย

ฟอร์มอยู่บนหน้าจอตลอด ไม่ต้องกดเปิด แต่งเพลงต่อเนื่องหลายเพลงได้โดยไม่เสียบริบทคลังเพลง

## ไม่อยู่ในขอบเขต

- ไม่แตะ API หรือ worker (`/api/generate` เหมือนเดิมทุกอย่าง)
- ไม่เพิ่มปุ่มพับ/ยุบ sidebar (YAGNI)
- ไม่เพิ่ม dependency ใหม่

## ดีไซน์

### 1. Layout

**Desktop (≥768px)** — 2 คอลัมน์ใต้ header:

```
┌──────────────────────────────────────────┐
│ header: Song-Auto  [ค้นหา…]              │  ← ปุ่ม "สร้างเพลง" หายไป
├──────────────┬───────────────────────────┤
│ aside 380px  │  main: LibraryGrid        │
│ CreatePanel  │  (scroll แยกของตัวเอง)     │
│ (scroll แยก) │                           │
│ [ Create ]   │                           │
├──────────────┴───────────────────────────┤
│ PlayerBar (เต็มความกว้าง เหมือนเดิม)      │
└──────────────────────────────────────────┘
```

- `<aside>` กว้างคงที่ ~380px, `overflow-y: auto` ของตัวเอง, มีเส้นแบ่ง `--border` ด้านขวา
- คลังเพลง `overflow-y: auto` แยกต่างหาก — เลื่อนคลังแล้วฟอร์มไม่ขยับ
- ปุ่ม Create ปักหมุด (sticky bottom) ที่ก้น aside ไม่ตกจอเมื่อ Lyrics ยาว

**มือถือ (<768px)** — แท็บสลับ:

```
┌──────────────────────────┐
│ header: Song-Auto [ค้นหา] │
├──────────────────────────┤
│  [ สร้าง ] [ คลัง ]       │  ← tablist
├──────────────────────────┤
│  เนื้อหาของแท็บที่เลือก    │
├──────────────────────────┤
│ PlayerBar                │
└──────────────────────────┘
```

- ค่าเริ่มต้น = แท็บ "คลัง"
- ปุ่ม "สร้างเพลง" ใน header ยังอยู่บนมือถือ แต่เปลี่ยนหน้าที่เป็นตัวพาไปแท็บ "สร้าง"
- **สลับแท็บไม่ทำลาย state ของฟอร์ม** — ทั้งสองแท็บ mount อยู่เสมอ ซ่อนด้วย CSS
  (ไม่ใช่ conditional unmount) เพื่อไม่ให้ค่าและตำแหน่ง scroll หาย
- ใช้ `role="tablist"` / `role="tab"` / `aria-selected` ให้ screen reader อ่านถูก

### 2. Draft persistence

ไฟล์ใหม่ `web/lib/draft.ts` — ตรรกะล้วน ทดสอบได้:

```ts
export interface Draft {
  lyrics: string; style: string; title: string;
  instrumental: boolean; negativeTags: string;
}
export const EMPTY_DRAFT: Draft
export function loadDraft(): Draft   // อ่านจาก localStorage คีย์ 'song-auto:draft'
export function saveDraft(d: Draft): void
```

กติกา:

- ทุกครั้งที่ค่าใน `CreatePanel` เปลี่ยน → `saveDraft`
- ตอน mount → `loadDraft` เป็นค่าตั้งต้นของ state
- ทุกการเข้าถึง `localStorage` ห่อ `try/catch` — โหมดส่วนตัว/quota เต็มต้องไม่ทำหน้าพัง
  แค่เสียความสามารถในการจำ
- JSON พัง / ฟิลด์ขาด / ชนิดผิด → คืน `EMPTY_DRAFT` (merge ทีละฟิลด์ ไม่ใช้ค่าที่ผิดชนิด)

### 3. พฤติกรรมหลังกดสร้าง

- ปุ่มขึ้น "Creating…" + spinner เหมือนเดิม
- สำเร็จ → **ไม่ล้างค่าใดๆ** ในฟอร์ม (ต่างจากเดิมที่ล้างทั้งหมด)
- เพลงใหม่โผล่ในคลังเป็นการ์ด PENDING + toast "เริ่มสร้างเพลงแล้ว…" เหมือนเดิม
- **มือถือเท่านั้น:** สลับไปแท็บ "คลัง" อัตโนมัติ ให้เห็นการ์ดที่กำลังสร้าง
  (ไม่งั้นผู้ใช้จะไม่เห็นผลลัพธ์ของการกดปุ่มเลย) — desktop ไม่ต้องทำอะไร เห็นอยู่แล้ว
- ล้มเหลว → ข้อความ error ในฟอร์มเหมือนเดิม ค่าที่กรอกยังอยู่ครบ

### 4. ของที่ถูกลบ

`SlideOver` ถูกใช้ที่เดียวคือหน้านี้ เมื่อเลิกใช้จะกลายเป็น dead code:

- ลบ `web/components/SlideOver.tsx`
- ลบ CSS ที่คู่กันใน `web/index.css`: `.slide-over`, `.slide-over-backdrop`,
  `@keyframes slideInRight`, `@keyframes slideInUp` (ตรวจก่อนลบว่า `fadeIn` ไม่มีใครใช้ต่อ)
- focus trap / `body` scroll lock ที่อยู่ใน SlideOver หายไปด้วย — ถูกต้องแล้ว
  เพราะฟอร์มไม่ใช่ modal อีกต่อไป Tab ต้องไหลผ่านทั้งหน้าได้ตามปกติ

### 5. ไฟล์ที่กระทบ

| ไฟล์ | ทำอะไร |
|------|--------|
| `web/lib/draft.ts` | **สร้างใหม่** — load/save draft |
| `web/components/CreatePanel.tsx` | ตั้งต้นจาก draft, บันทึกทุกการเปลี่ยน, ไม่ล้างค่าหลังสร้าง, ปุ่ม sticky |
| `web/App.tsx` | ตัด `panelOpen`/`SlideOver` ออก, layout 2 คอลัมน์ + tab state ของมือถือ |
| `web/components/AppHeader.tsx` | ปุ่มสร้างซ่อนบน desktop, บนมือถือพาไปแท็บ "สร้าง" |
| `web/index.css` | เพิ่ม layout/tab styles, ลบ slide-over |
| `web/components/SlideOver.tsx` | **ลบ** |
| `tests/draft.test.ts` | **สร้างใหม่** |

## การทดสอบ

โปรเจกต์นี้ไม่มีเครื่องมือทดสอบ React component (มีแค่ vitest สำหรับ logic + worker)
และดีไซน์นี้ไม่เพิ่ม dependency ใหม่ จึงตรวจดังนี้:

1. `tests/draft.test.ts` — บันทึกแล้วอ่านกลับได้ครบ 5 ฟิลด์ / ไม่มีค่าเดิมคืน EMPTY /
   JSON พังคืน EMPTY / ฟิลด์ผิดชนิดคืนค่า default ของฟิลด์นั้น / `localStorage` โยน error แล้วไม่ crash
2. `npm run typecheck` ผ่าน
3. `npm run build` ผ่าน
4. ตรวจด้วยตาบน `npm run dev`:
   - desktop: 2 คอลัมน์ เลื่อนคลังแล้วฟอร์มนิ่ง / ปุ่ม Create ไม่ตกจอ
   - มือถือ: สลับแท็บไปกลับ ค่าไม่หาย / สร้างเสร็จเด้งไปแท็บคลัง
   - รีเฟรชหน้า ค่ายังอยู่
   - กด Tab ไล่ทั้งหน้าได้ ไม่มีกับดัก focus
   - `prefers-reduced-motion` ยังทำงาน
