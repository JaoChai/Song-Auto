# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Song-Auto
**Generated:** 2026-08-26 12:06:46
**Updated:** 2026-09-10 — จานสี ตัวอักษร และ Page Pattern ปรับให้ตรงกับที่ทางซ้ายไปขวาจริง
**Category:** Music Streaming
**Design Dials:** Variance 6/10 (Expressive) | Motion 4/10 (Standard) | Density 5/10 (Standard)

---

## Global Rules

### Color Palette

พื้นสว่างอมม่วง — ม่วงคือการกระทำของระบบ ชมพูสงวนไว้เฉพาะสิ่งที่ AI แต่งขึ้นให้
(เนื้อเพลงจาก `/api/lyrics`, persona) ทุกคู่ที่ใช้กับตัวหนังสือผ่าน WCAG AA (>= 4.5:1)

| Role | Hex | CSS Variable | คอนทราสต์ |
|------|-----|--------------|-----------|
| Ground | `#FAF7FF` | `--ground` | — |
| Surface | `#FFFFFF` | `--surface` | — |
| Surface 2 | `#F3EDFD` | `--surface-2` | — |
| Ink (หลัก) | `#17122B` | `--ink` | 17.11 บนพื้น |
| Ink 2 (รอง) | `#4A4363` | `--ink-2` | 8.71 บนพื้น |
| Ink 3 (จางสุด) | `#6E6690` | `--ink-3` | 5.00 บนพื้น · 5.29 บนการ์ด |
| Grape (สีหลัก) | `#6D28D9` | `--grape` | 6.70 บนพื้น · ขาวบนปุ่ม 7.10 |
| Pink (เฉพาะของ AI แต่ง) | `#BE185D` | `--pink` | 5.70 บนพื้น · ขาวบนสี 6.04 |
| Line | `#E7DCFB` | `--line` | — |
| Destructive | `#DC2626` | `--danger` | 4.56 บนพื้น |
| Success | `#047857` | `--ok` | 5.17 บนพื้น |

**Color Notes:** พื้นสว่าง ปกเพลงเป็นตัวเดินสี chrome อยู่เงียบ ๆ · ของเดิม (ดำ+เขียว) มี
`--text-3: #7c7c85` บน surface ได้แค่ 4.37 ซึ่งตกเกณฑ์ AA — เปลี่ยนจานสีทั้งชุดแก้ปัญหานี้ไปด้วย
ยังไม่ได้เขียน token โหมดมืดในโค้ด — สเปกเดิมออกแบบไว้เป็นแนวทางแต่ยังไม่ได้ implement

### Typography

- **Heading Font:** Chakra Petch — มีอักขระไทย เหลี่ยมนิด ๆ แบบเครื่องเสียง ใช้เฉพาะหัวเรื่อง/ชื่อเพลง
- **Body Font:** Anuphan — มีอักขระไทย ตัวแปรน้ำหนัก 100–700 อ่านง่ายที่ขนาดเล็ก
- **Mono:** JetBrains Mono — ตัวเลข ระยะเวลา รหัส
- **Mood:** สดใส เข้าถึงง่าย ทันสมัย อบอุ่นกว่าธีมมืดเดิม
- **Google Fonts:** [Chakra Petch + Anuphan + JetBrains Mono](https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Anuphan:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Anuphan:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
```

**กติกาสำหรับภาษาไทย** (เหตุผลที่ของเดิมพัง — โหลดแค่ Inter ที่ไม่มีอักขระไทย ข้อความไทยทุกบรรทัด
จึงตกไปใช้ฟอนต์ระบบที่น้ำหนัก/ความสูงไม่เข้ากับฟอนต์อังกฤษ):

- `line-height` ของเนื้อความไม่ต่ำกว่า 1.75 — สระบนกับวรรณยุกต์ซ้อนกันสองชั้น ค่า 1.5 แบบอังกฤษทำให้ชนบรรทัดบน
- ไม่ใช้ขนาดต่ำกว่า 13px กับข้อความไทย
- ห้าม `text-align: justify` — ไทยไม่มีช่องว่างระหว่างคำ การยืดบรรทัดจะฉีกคำ

### Spacing Variables

*Density: 5/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button — ม่วง, ตัวขาว */
.btn-primary {
  background: var(--grape);
  color: #ffffff;
  padding: 12px 24px;
  border-radius: 14px;
  font-weight: 600;
  transition: filter 150ms ease, transform 150ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  filter: brightness(1.08);
}

/* Assist Button — ชมพู, เฉพาะสิ่งที่ AI แต่งให้ (เนื้อเพลง, persona) */
.btn-assist {
  background: var(--pink);
  color: #ffffff;
  padding: 10px 16px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

/* Outline Button — ใช้กับปุ่มบนแผงรายละเอียด (ต่อเพลง / ทำ persona) */
.btn-outline {
  background: var(--surface);
  color: var(--grape-text);
  border: 1px solid var(--line-strong);
  padding: 10px 16px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 1px 2px rgba(23, 18, 43, 0.05);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  border-color: var(--line-strong);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  font-size: 16px;
  color: var(--ink);
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: var(--grape);
  outline: none;
  box-shadow: 0 0 0 3px var(--grape-soft);
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Exaggerated Minimalism

**Keywords:** Bold minimalism, oversized typography, high contrast, negative space, loud minimal, statement design

**Best For:** Fashion, architecture, portfolios, agency landing pages, luxury brands, editorial

**Key Effects:** font-size: clamp(3rem 10vw 12rem), font-weight: 900, letter-spacing: -0.05em, massive whitespace

### Page Pattern

**Pattern Name:** Create Left, Library Right

ทิศทางการไหลอ่านจากซ้ายไปขวา — ซ้ายคือสิ่งที่ป้อน ขวาคือสิ่งที่ได้กลับมา
(ของเดิมเขียนไว้ว่าเป็น slide-over แต่โค้ดจริงทำเป็น sidebar ถาวรมาตลอด — รอบนี้แก้ให้เอกสารตรงของจริง)

- **Structure:** sticky header (wordmark · search) → ① ราวซ้าย = ฟอร์มสร้าง (≥1024px คงอยู่ถาวร) →
  ② คลังเป็น grid ทางขวา → sticky player bar ติดก้นจอ
- **Detail layer:** ③ แผงรายละเอียดเพลง (เนื้อเพลง / ต่อเพลง / persona / สายพันธุ์) เลื่อนทับ grid
  เข้ามาจากขอบขวา (≥1024px) หรือขึ้นจากด้านล่างเป็น bottom sheet (<1024px) — ไม่ไปแย่งที่ราวซ้าย
  จึงไม่มีจังหวะที่โชว์สามคอลัมน์เต็มพร้อมกัน
- **Grid:** 2 columns < 640px · 3 columns 640–1024px · 4 columns > 1024px
- **Colour source:** cover artwork carries the colour; chrome stays neutral. `--grape` คือการกระทำ
  ของระบบ (ปุ่มสร้าง แถบเล่นอยู่ โฟกัส) `--pink` สงวนไว้เฉพาะสิ่งที่ AI แต่งขึ้นให้

---

## Motion

**Stagger List** (Standard) — Trigger: load or scroll | Duration: 300-450ms | Easing: `back.out(1.4)`

```js
gsap.from('.grid-item', { opacity: 0, scale: 0.92, y: 16, duration: 0.4, stagger: { each: 0.06, from: 'start', grid: 'auto' }, ease: 'back.out(1.4)' });
```

**Framework notes:** grid: 'auto' lets GSAP infer rows/columns from a CSS grid layout for a natural wave stagger

- ✅ Combine with from: 'center' for a bento-grid layout to draw the eye inward first
- ❌ Don't use back.out on dense data tables; the overshoot reads as sloppy on informational UI
- ⚡ Group DOM writes; avoid interleaving layout reads (getBoundingClientRect) between staggered tweens

---

## Anti-Patterns (Do NOT Use)

- ❌ Cluttered layout
- ❌ Poor audio player UX

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
