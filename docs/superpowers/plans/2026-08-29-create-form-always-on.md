# Always-on Create Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เอาฟอร์มสร้างเพลงออกจาก modal มาค้างบนหน้าจอถาวร (คอลัมน์ซ้ายบน desktop / แท็บบนมือถือ) และจำค่าที่กรอกไว้ข้ามการสร้างและข้ามการรีเฟรช

**Architecture:** ตรรกะ draft แยกเป็นโมดูลบริสุทธิ์ `web/lib/draft.ts` ทดสอบได้ด้วย vitest ที่มีอยู่ · `CreatePanel` ถือ state เป็นก้อน `Draft` ก้อนเดียวและซิงก์ลง localStorage ผ่าน `useEffect` · `App.tsx` เปลี่ยนจาก modal เป็น layout สองคอลัมน์ที่ mount ทั้งสองฝั่งเสมอ แล้วซ่อนด้วย CSS บนจอแคบ เพื่อไม่ให้ state หายตอนสลับแท็บ

**Tech Stack:** React 19 + TypeScript strict + Tailwind CSS v4 + Vite · vitest (environment: node) · ไม่เพิ่ม dependency ใหม่

**Spec:** `docs/superpowers/specs/2026-08-29-create-form-always-on-design.md`

## Global Constraints

- ไม่เพิ่ม dependency ใหม่ใน `package.json` — โปรเจกต์ไม่มีเครื่องมือทดสอบ React component และแผนนี้ไม่เพิ่ม
- ไม่แตะ worker หรือ API — `/api/generate` และ payload ที่ส่งต้องเหมือนเดิมทุกฟิลด์
- `tsconfig.json` เปิด `strict`, `noUnusedLocals`, `noUnusedParameters` — import หรือตัวแปรที่ไม่ได้ใช้จะทำให้ `npm run typecheck` ล้มเหลว
- vitest ตั้ง `environment: 'node'` และ `include: ['tests/**/*.test.ts']` — เทสต์ต้องอยู่ใน `tests/` นามสกุล `.ts` และ **ไม่มี `localStorage` ให้ใช้** ต้อง stub เอง
- สีและ token ทั้งหมดใช้ตัวแปร CSS ที่มีอยู่ (`--bg`, `--surface-2`, `--border`, `--text`, `--text-2`, `--accent`, `--ease`) ห้าม hardcode สีใหม่
- ข้อความ UI ที่ผู้ใช้เห็นเป็นภาษาไทย ยกเว้นชื่อฟิลด์เดิมที่เป็นอังกฤษอยู่แล้ว (Lyrics, Style of music, Title, Instrumental, Exclude styles) — คงไว้ตามเดิม
- breakpoint เดียวที่ใช้คือ `md` (768px) ให้ตรงกับที่โปรเจกต์ใช้อยู่

---

## File Structure

| ไฟล์ | หน้าที่ | สถานะ |
|------|---------|-------|
| `web/lib/draft.ts` | โหลด/บันทึกค่าฟอร์มลง localStorage — ตรรกะล้วน ไม่มี React | สร้างใหม่ |
| `tests/draft.test.ts` | เทสต์ของ `draft.ts` | สร้างใหม่ |
| `web/components/CreatePanel.tsx` | ฟอร์ม: state จาก draft, ไม่ล้างค่าหลังสร้าง, ปุ่มปักหมุดล่าง | แก้ |
| `web/App.tsx` | layout สองคอลัมน์ + สลับแท็บบนมือถือ, ตัด modal ออก | แก้ |
| `web/components/AppHeader.tsx` | เหลือแบรนด์ + ช่องค้นหา (ปุ่มสร้างถูกตัด) | แก้ |
| `web/index.css` | เพิ่ม `.seg`, `.seg-btn`, `.form-footer` · ลบ CSS ของ slide-over | แก้ |
| `web/components/SlideOver.tsx` | กลายเป็น dead code | ลบ |

**เปลี่ยนจาก spec 2 จุด (ตั้งใจ):**

1. spec เขียนว่าใช้ `role="tablist"/"tab"/aria-selected` — แผนนี้ใช้ปุ่มธรรมดา 2 ปุ่มพร้อม `aria-pressed` แทน เพราะบน desktop ทั้งสองฝั่งแสดงพร้อมกัน จึงไม่ใช่รูปแบบ tab จริง การประกาศ `role="tabpanel"` ค้างไว้บน desktop จะทำให้ screen reader อ่านผิดความจริง
2. spec เขียนว่าปุ่ม "สร้างเพลง" ใน header ยังอยู่บนมือถือเพื่อพาไปแท็บสร้าง — แผนนี้ตัดปุ่มทิ้ง เพราะแถบสลับแท็บอยู่ใต้ header อยู่แล้ว ปุ่มจะทำหน้าที่ซ้ำ

---

### Task 1: โมดูล draft (localStorage)

**Files:**
- Create: `web/lib/draft.ts`
- Test: `tests/draft.test.ts`

**Interfaces:**
- Consumes: ไม่มี (task แรก)
- Produces:
  - `interface Draft { lyrics: string; style: string; title: string; instrumental: boolean; negativeTags: string }`
  - `const EMPTY_DRAFT: Draft`
  - `function loadDraft(): Draft`
  - `function saveDraft(draft: Draft): void`

- [ ] **Step 1: เขียนเทสต์ที่ยังล้มเหลว**

สร้าง `tests/draft.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadDraft, saveDraft, EMPTY_DRAFT, type Draft } from '../web/lib/draft';

const KEY = 'song-auto:draft';

/** in-memory stand-in — vitest runs in node, where localStorage does not exist */
function fakeStorage(over: Partial<Storage> = {}): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
    ...over,
  } as Storage;
}

const useStorage = (s: Storage | undefined) => {
  Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true, writable: true });
};

const filled: Draft = {
  lyrics: '[Verse 1]\nฝนตกที่หน้าต่าง',
  style: 'dream pop, ethereal',
  title: 'สายฝน',
  instrumental: true,
  negativeTags: 'heavy metal',
};

describe('draft', () => {
  beforeEach(() => useStorage(fakeStorage()));
  afterEach(() => useStorage(undefined));

  it('reads back everything it saved', () => {
    saveDraft(filled);
    expect(loadDraft()).toEqual(filled);
  });

  it('returns an empty draft when nothing was saved', () => {
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
  });

  it('returns an empty draft when the stored value is not valid JSON', () => {
    globalThis.localStorage.setItem(KEY, '{not json');
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
  });

  it('returns an empty draft when the stored value is not an object', () => {
    globalThis.localStorage.setItem(KEY, '"just a string"');
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
  });

  it('drops fields of the wrong type but keeps the valid ones', () => {
    globalThis.localStorage.setItem(
      KEY,
      JSON.stringify({ lyrics: 42, style: 'lo-fi', instrumental: 'yes' }),
    );
    expect(loadDraft()).toEqual({ ...EMPTY_DRAFT, style: 'lo-fi' });
  });

  it('does not throw when storage refuses to write', () => {
    useStorage(fakeStorage({ setItem: () => { throw new Error('QuotaExceededError'); } }));
    expect(() => saveDraft(filled)).not.toThrow();
  });

  it('works when there is no storage at all', () => {
    useStorage(undefined);
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
    expect(() => saveDraft(filled)).not.toThrow();
  });
});
```

- [ ] **Step 2: รันเทสต์ ให้เห็นว่าล้มเหลว**

รัน: `npx vitest run tests/draft.test.ts`
คาดหวัง: FAIL — `Failed to resolve import "../web/lib/draft"`

- [ ] **Step 3: เขียน implementation ให้น้อยที่สุด**

สร้าง `web/lib/draft.ts`:

```ts
/** ค่าที่ผู้ใช้กรอกในฟอร์มสร้างเพลง — เก็บไว้ข้ามการสร้างและข้ามการรีเฟรช */
export interface Draft {
  lyrics: string;
  style: string;
  title: string;
  instrumental: boolean;
  negativeTags: string;
}

const KEY = 'song-auto:draft';

export const EMPTY_DRAFT: Draft = {
  lyrics: '',
  style: '',
  title: '',
  instrumental: false,
  negativeTags: '',
};

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** อ่าน draft ที่เก็บไว้ ทุกความล้มเหลว (ไม่มี storage / JSON พัง / ชนิดผิด) คืน EMPTY_DRAFT */
export function loadDraft(): Draft {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_DRAFT;
    const d = parsed as Record<string, unknown>;
    return {
      lyrics: str(d.lyrics),
      style: str(d.style),
      title: str(d.title),
      instrumental: d.instrumental === true,
      negativeTags: str(d.negativeTags),
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

/** บันทึก draft — storage ใช้ไม่ได้ (โหมดส่วนตัว / quota เต็ม) ไม่ถือเป็น error */
export function saveDraft(draft: Draft): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(draft));
  } catch {
    // ไม่มีที่เก็บ — ฟอร์มยังทำงานได้ปกติ แค่ไม่จำ
  }
}
```

- [ ] **Step 4: รันเทสต์ ให้ผ่าน**

รัน: `npx vitest run tests/draft.test.ts`
คาดหวัง: PASS ทั้ง 7 เคส

- [ ] **Step 5: typecheck**

รัน: `npm run typecheck`
คาดหวัง: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add web/lib/draft.ts tests/draft.test.ts
git commit -m "feat(web): persist create-form draft in localStorage"
```

---

### Task 2: CreatePanel ใช้ draft และไม่ล้างค่าหลังสร้าง

**Files:**
- Modify: `web/components/CreatePanel.tsx` (เขียนทับทั้งไฟล์)
- Modify: `web/index.css` (เพิ่ม `.form-footer` ต่อท้ายบล็อก `.field-label`)

**Interfaces:**
- Consumes: `loadDraft`, `saveDraft`, `EMPTY_DRAFT`, `type Draft` จาก `web/lib/draft.ts` (Task 1)
- Produces: `CreatePanel` ยังรับ prop เดิม `{ onCreated: (song: Song) => void }` — `App.tsx` (Task 3) ไม่ต้องเปลี่ยนวิธีเรียก

- [ ] **Step 1: เพิ่ม CSS ปุ่มปักหมุด**

เปิด `web/index.css` หาบล็อกนี้ (ราวบรรทัด 171):

```css
.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
}
```

แทรกต่อท้ายทันที:

```css
/* ปุ่มสร้างปักหมุดที่ก้นฟอร์ม — ช่อง Lyrics สูง ปุ่มต้องไม่ตกจอ */
.form-footer {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  padding-top: 12px;
  padding-bottom: 4px;
  background: var(--bg);
}
```

- [ ] **Step 2: เขียน `CreatePanel.tsx` ใหม่ทั้งไฟล์**

```tsx
import { useEffect, useState } from 'react';
import { api, type GenerateBody, type Song } from '../lib/api';
import { loadDraft, saveDraft, type Draft } from '../lib/draft';
import { SpinnerIcon } from './icons';

const LYRICS_MAX = 5000;
const STYLE_MAX = 1000;
const TITLE_MAX = 80;

interface Props {
  onCreated: (song: Song) => void;
}

export function CreatePanel({ onCreated }: Props) {
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { lyrics, style, title, instrumental, negativeTags } = draft;

  // the draft is the only thing worth persisting — everything else is transient
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSubmit = Boolean(style.trim() && title.trim() && (instrumental || lyrics.trim())) && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const body: GenerateBody = {
        // our own /api/generate row always stores a prompt (possibly empty);
        // kieGenerate (server-side) is what decides whether to forward it to kie.ai
        prompt: instrumental ? '' : lyrics,
        style,
        title,
        instrumental,
        model: 'V5',
        ...(negativeTags ? { negativeTags } : {}),
      };
      const created = await api<{ id: string; status: 'PENDING' }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated({
        id: created.id,
        taskId: '',
        title,
        prompt: lyrics,
        style,
        tags: '',
        model: 'V5',
        instrumental: instrumental ? 1 : 0,
        status: 'PENDING',
        error: null,
        r2Key: null,
        imageKey: null,
        duration: null,
        createdAt: new Date().toISOString(),
      });
      // the form deliberately keeps its values: tweak a word, create again
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างเพลงไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex min-h-full flex-col gap-6 p-6">
      {/* Instrumental */}
      <label className="flex cursor-pointer items-center gap-2.5 text-sm" style={{ color: 'var(--text-2)' }}>
        <input
          type="checkbox"
          checked={instrumental}
          onChange={(e) => set('instrumental', e.target.checked)}
          className="h-4 w-4 accent-[#22c55e]"
        />
        Instrumental — ไม่มีคำร้อง
      </label>

      {/* Lyrics */}
      {!instrumental && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="lyrics" className="field-label" style={{ marginBottom: 0 }}>Lyrics</label>
            <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
              {lyrics.length.toLocaleString()} / {LYRICS_MAX.toLocaleString()}
            </span>
          </div>
          <textarea
            id="lyrics"
            className="input"
            value={lyrics}
            onChange={(e) => set('lyrics', e.target.value)}
            rows={10}
            maxLength={LYRICS_MAX}
            placeholder={'[Verse 1]\n…\n\n[Chorus]\n…'}
          />
        </div>
      )}

      <div className="h-px shrink-0" style={{ background: 'var(--border)' }} />

      {/* Style */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="style" className="field-label" style={{ marginBottom: 0 }}>Style of music</label>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {style.length} / {STYLE_MAX}
          </span>
        </div>
        <input
          id="style"
          className="input"
          value={style}
          onChange={(e) => set('style', e.target.value)}
          maxLength={STYLE_MAX}
          placeholder="dream pop, ethereal, lush reverb"
        />
      </div>

      {/* Title */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="title" className="field-label" style={{ marginBottom: 0 }}>Title</label>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {title.length} / {TITLE_MAX}
          </span>
        </div>
        <input
          id="title"
          className="input"
          value={title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="ชื่อเพลง"
        />
      </div>

      {/* Exclude styles — collapsed */}
      <details className="text-sm">
        <summary className="cursor-pointer select-none list-none" style={{ color: 'var(--text-3)' }}>
          Exclude styles (optional)
        </summary>
        <input
          aria-label="Exclude styles"
          className="input mt-3"
          value={negativeTags}
          onChange={(e) => set('negativeTags', e.target.value)}
          placeholder="heavy metal, upbeat drums"
        />
      </details>

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
          {error}
        </p>
      )}

      <div className="form-footer">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary inline-flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            'Create song'
          )}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: typecheck**

รัน: `npm run typecheck`
คาดหวัง: ไม่มี error (ถ้าเจอ `'EMPTY_DRAFT' is declared but never used` แปลว่าเผลอ import เกิน — ไฟล์นี้ import แค่ `loadDraft`, `saveDraft`, `type Draft`)

- [ ] **Step 4: เทสต์เดิมยังผ่าน**

รัน: `npm test`
คาดหวัง: ทุกไฟล์ PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/CreatePanel.tsx web/index.css
git commit -m "feat(web): create form keeps its values and restores the saved draft"
```

---

### Task 3: layout สองคอลัมน์ + สลับแท็บบนมือถือ

**Files:**
- Modify: `web/App.tsx` (เขียนทับทั้งไฟล์)
- Modify: `web/components/AppHeader.tsx` (เขียนทับทั้งไฟล์)
- Modify: `web/index.css` (เพิ่ม `.seg` / `.seg-btn`)

**Interfaces:**
- Consumes: `CreatePanel` prop `{ onCreated }` (Task 2, ไม่เปลี่ยน)
- Produces:
  - `AppHeader` เหลือ prop `{ query: string; onQueryChange: (q: string) => void }` — prop `onCreate` ถูกลบ
  - `App` ถือ state `tab: 'create' | 'library'` ใช้เฉพาะจอ < 768px

- [ ] **Step 1: เพิ่ม CSS ของแถบสลับ**

เปิด `web/index.css` แล้วแทรกต่อท้ายบล็อก `.form-footer` ที่เพิ่มไว้ใน Task 2:

```css
/* แถบสลับ สร้าง / คลัง — เห็นเฉพาะจอแคบ */
.seg {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
}
.seg-btn {
  flex: 1;
  min-height: 38px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  transition: background-color 160ms var(--ease), color 160ms var(--ease);
}
.seg-btn[aria-pressed='true'] {
  background: var(--surface-2);
  color: var(--text);
}

/* เส้นแบ่งฟอร์มกับคลัง — มีเฉพาะตอนสองคอลัมน์อยู่คู่กัน
   (ใช้ CSS ไม่ใช่ Tailwind `md:border-r` เพราะ Tailwind v4 ตั้ง border สีเริ่มต้นเป็น currentColor) */
@media (min-width: 768px) {
  .aside-divider {
    border-right: 1px solid var(--border);
  }
}
```

- [ ] **Step 2: เขียน `AppHeader.tsx` ใหม่ทั้งไฟล์**

```tsx
import { SearchIcon } from './icons';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
}

export function AppHeader({ query, onQueryChange }: Props) {
  return (
    <header
      className="sticky top-0 z-20 shrink-0"
      style={{ background: 'rgba(13,13,15,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex h-14 w-full items-center gap-3 px-4 md:gap-5 md:px-6">
        <span className="shrink-0 text-[15px] font-semibold tracking-tight">
          Song<span style={{ color: 'var(--accent)' }}>-</span>Auto
        </span>

        <div className="relative min-w-0 flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--text-3)' }}
          />
          <label htmlFor="search" className="sr-only">ค้นหาเพลง</label>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="ค้นหาเพลง…"
            className="input"
            style={{ paddingLeft: 38, minHeight: 40 }}
          />
        </div>
      </div>
    </header>
  );
}
```

หมายเหตุ: `PlusIcon` ไม่ถูกใช้ในไฟล์นี้แล้ว (ตรวจแล้วว่า header เป็นที่เดียวที่ใช้ — จะไปลบตัว export ทิ้งใน Task 4) · `max-w-6xl mx-auto` ถูกถอดออกด้วย เพราะ layout ใหม่กินเต็มความกว้าง

- [ ] **Step 3: เขียน `App.tsx` ใหม่ทั้งไฟล์**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { AuthGate } from './components/AuthGate';
import { CreatePanel } from './components/CreatePanel';
import { LibraryGrid } from './components/LibraryGrid';
import { PlayerBar } from './components/PlayerBar';
import { Toast } from './components/Toast';
import { songAudioUrl, type Song } from './lib/api';
import { filterSongs } from './lib/filter';
import { useSongs } from './hooks/useSongs';

export default function App() {
  const { songs, loaded, authNeeded, refresh, upsert } = useSongs();
  const [query, setQuery] = useState('');
  // only meaningful under 768px — both panels are visible side by side above it
  const [tab, setTab] = useState<'create' | 'library'>('library');
  const [toast, setToast] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasPending = useRef(false);

  // the song list the transport walks — what the user can actually see
  const visible = useMemo(() => filterSongs(songs, query), [songs, query]);
  const active = activeId ? songs.find((s) => s.id === activeId) ?? null : null;

  const play = useCallback((song: Song) => {
    const url = songAudioUrl(song);
    const el = audioRef.current;
    if (!url || !el) return;
    if (activeId === song.id && el.src.includes(song.r2Key!)) {
      if (el.paused) void el.play();
      else el.pause();
      return;
    }
    el.src = url;
    setActiveId(song.id);
    void el.play();
  }, [activeId]);

  // autoplay a song that was pending when the user selected it
  useEffect(() => {
    if (!active) return;
    if (active.status === 'PENDING') wasPending.current = true;
    if (wasPending.current && active.status === 'SUCCESS' && audioRef.current) {
      wasPending.current = false;
      audioRef.current.src = songAudioUrl(active)!;
      void audioRef.current.play();
    }
  }, [active]);

  const index = active ? visible.findIndex((s) => s.id === active.id) : -1;
  const playableAt = (i: number): Song | null => {
    const s = visible[i];
    return s && s.status === 'SUCCESS' && songAudioUrl(s) ? s : null;
  };
  const prev = index > 0 ? playableAt(index - 1) : null;
  const next = index >= 0 && index < visible.length - 1 ? playableAt(index + 1) : null;

  if (loaded && authNeeded) {
    return <AuthGate onAuthed={() => void refresh()} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (next) play(next);
        }}
      />

      <AppHeader query={query} onQueryChange={setQuery} />

      {/* narrow screens can't show both panels — switch between them */}
      <div className="seg md:hidden">
        <button type="button" className="seg-btn" aria-pressed={tab === 'create'} onClick={() => setTab('create')}>
          สร้าง
        </button>
        <button type="button" className="seg-btn" aria-pressed={tab === 'library'} onClick={() => setTab('library')}>
          คลัง
        </button>
      </div>

      {/* both panels stay mounted: switching tabs must not throw away form state */}
      <div className="flex min-h-0 flex-1 md:flex-row">
        <aside
          className={`aside-divider ${tab === 'create' ? 'flex' : 'hidden'} min-h-0 w-full flex-col overflow-y-auto md:flex md:w-[380px] md:shrink-0`}
        >
          <CreatePanel
            onCreated={(song) => {
              upsert(song);
              setActiveId(song.id);
              wasPending.current = true;
              // on desktop the library is already in view; on mobile show the new card
              setTab('library');
              setToast('เริ่มสร้างเพลงแล้ว — จะขึ้นในคลังเมื่อเสร็จ');
            }}
          />
        </aside>

        <main className={`${tab === 'library' ? 'block' : 'hidden'} min-h-0 w-full flex-1 overflow-y-auto px-4 py-6 md:block md:px-6 md:py-8`}>
          <LibraryGrid
            songs={songs}
            loaded={loaded}
            query={query}
            activeSong={active}
            isPlaying={isPlaying}
            onPlay={play}
            upsert={upsert}
            onRetryFailed={setToast}
          />
        </main>
      </div>

      <PlayerBar
        song={active}
        isPlaying={isPlaying}
        audioRef={audioRef}
        onPrev={() => prev && play(prev)}
        onNext={() => next && play(next)}
        hasPrev={Boolean(prev)}
        hasNext={Boolean(next)}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
```

- [ ] **Step 4: typecheck**

รัน: `npm run typecheck`
คาดหวัง: ไม่มี error — ถ้าเห็น `Property 'onCreate' is missing` แปลว่ายังแก้ `AppHeader` ไม่ครบ

- [ ] **Step 5: เทสต์เดิมยังผ่าน**

รัน: `npm test`
คาดหวัง: ทุกไฟล์ PASS

- [ ] **Step 6: ตรวจด้วยตาบนเบราว์เซอร์**

รัน: `npm run dev` แล้วเปิด `http://localhost:5173`

ตรวจ 6 ข้อ:
1. Desktop กว้าง ≥768px: ฟอร์มอยู่ซ้ายกว้าง 380px คลังอยู่ขวา · เลื่อนคลังแล้วฟอร์มไม่ขยับ · เลื่อนฟอร์มแล้วคลังไม่ขยับ
2. Desktop: ปุ่ม Create song ยังเห็นอยู่ที่ก้นฟอร์มแม้เลื่อนขึ้นไปบนสุด
3. ย่อจอต่ำกว่า 768px: แถบ `สร้าง | คลัง` โผล่ ค่าเริ่มต้นอยู่ที่ "คลัง"
4. จอแคบ: พิมพ์ในฟอร์ม → สลับไป "คลัง" → กลับมา "สร้าง" → ค่ายังอยู่ครบ
5. รีเฟรชหน้า → ค่าที่พิมพ์ยังอยู่
6. กด Tab ไล่จากช่องค้นหาลงมาจนถึงปุ่ม Create แล้วออกไปคลังได้ ไม่มีจุดที่ Tab วนติดอยู่ที่เดิม

- [ ] **Step 7: Commit**

```bash
git add web/App.tsx web/components/AppHeader.tsx web/index.css
git commit -m "feat(web): always-on create form — two-column desktop, tab switch on mobile"
```

---

### Task 4: เก็บกวาด modal ที่ไม่ใช้แล้ว

**Files:**
- Delete: `web/components/SlideOver.tsx`
- Modify: `web/index.css` (ลบ CSS ของ slide-over + `@keyframes fadeIn`)
- Modify: `web/components/icons.tsx` (ลบ `PlusIcon`)

**Interfaces:**
- Consumes: Task 3 ต้องเสร็จก่อน — หลัง Task 3 ไม่มีไฟล์ไหน import `SlideOver` แล้ว
- Produces: ไม่มี

- [ ] **Step 1: ยืนยันว่าไม่มีใครใช้แล้ว**

รัน: `grep -rn "SlideOver\|slide-over" web tests src`
คาดหวัง: เจอเฉพาะใน `web/components/SlideOver.tsx` และบล็อก CSS ใน `web/index.css` เท่านั้น ถ้าเจอที่อื่นให้หยุดและรายงาน

- [ ] **Step 2: ลบไฟล์ component**

```bash
git rm web/components/SlideOver.tsx
```

- [ ] **Step 3: ลบ CSS ที่คู่กัน**

เปิด `web/index.css` ลบตั้งแต่คอมเมนต์ `/* slide-over: right panel on desktop, bottom sheet on mobile */` ไปจนจบบล็อก `@media (min-width: 768px) { .slide-over { … } }` ซึ่งครอบคลุม:

- `@keyframes slideInRight`
- `@keyframes slideInUp`
- `@keyframes fadeIn` — ตรวจแล้วว่ามีที่ใช้ที่เดียวคือ `.slide-over-backdrop` ที่กำลังลบ
- `.slide-over-backdrop`
- `.slide-over`
- `@media (min-width: 768px) { .slide-over { … } }`

ยืนยันหลังลบด้วย `grep -rn "fadeIn\|slideIn" web` — ต้องไม่เหลืออะไรเลย

- [ ] **Step 4: ลบ `PlusIcon` ที่ไม่มีใครใช้แล้ว**

`AppHeader` เป็นที่เดียวที่เคยใช้ `PlusIcon` (ตรวจแล้วตอนเขียนแผน) หลัง Task 3 มันจึงเป็น export ที่ตายแล้ว

เปิด `web/components/icons.tsx` ลบบล็อก `export const PlusIcon = …` ทั้งก้อน (เริ่มที่บรรทัดราว 50)

ยืนยัน: `grep -rn "PlusIcon" web` ต้องไม่เจออะไรเลย

- [ ] **Step 5: typecheck + build + test ครบชุด**

```bash
npm run typecheck
npm test
npm run build
```

คาดหวัง: ผ่านทั้ง 3 คำสั่ง — `npm run build` ต้องขึ้น `built in …` โดยไม่มี error

- [ ] **Step 6: ตรวจซ้ำบนเบราว์เซอร์ว่า CSS ไม่พัง**

รัน: `npm run dev` เปิดหน้าเว็บ ตรวจว่าไม่มีอะไรเพี้ยนหลังลบ CSS (ฟอร์ม คลัง PlayerBar Toast ยังหน้าตาปกติ)

- [ ] **Step 7: Commit**

```bash
git add -A web/index.css web/components
git commit -m "chore(web): drop SlideOver and its dead CSS/icon"
```

---

## เสร็จแล้วตรวจอะไรบ้าง (Definition of Done)

- `npm test` ผ่านทั้งหมด รวมเทสต์ใหม่ 7 เคสใน `tests/draft.test.ts`
- `npm run typecheck` และ `npm run build` ผ่าน
- ฟอร์มอยู่บนหน้าจอโดยไม่ต้องกดปุ่มใดๆ ทั้ง desktop และมือถือ
- สร้างเพลงแล้วค่าที่กรอกยังอยู่ครบ
- รีเฟรชหน้าแล้วค่ายังอยู่
- ไม่มี `SlideOver` เหลือในโค้ดเบส
