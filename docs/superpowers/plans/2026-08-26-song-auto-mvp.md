# Song-Auto MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internal single-page web app to generate AI music via KIE.AI Suno API, listen to results, and browse a persistent library — hosted entirely on Cloudflare (Workers + D1 + R2).

**Architecture:** Hono Worker serving `/api/*` routes + Vite React SPA as static assets. Generation uses polling proxy (`GET /api/tasks/:id`) — no public webhook. On kie `SUCCESS` the Worker downloads the mp3 into R2 and records metadata in D1; audio streams from R2 with Range support.

**Tech Stack:** TypeScript, Hono 4, Cloudflare Workers (Static Assets), D1, R2, Vitest, React 18 + Vite + Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-08-26-song-auto-design.md`
**Design System:** `design-system/song-auto/MASTER.md`

## Global Constraints

- Base URL of kie API: `https://api.kie.ai`, auth header `Authorization: Bearer ${KIE_API_KEY}` (verbatim from spec).
- Response envelope contract: `{ code: 200, msg, data }` — treat `code !== 200` as failure.
- kie polling limit: **max 3 requests/second per taskId** — client polls every 10s, one task at a time.
- Models enum (exact strings): `V3_5`, `V4`, `V4_5`, `V4_5PLUS`, `V4_5ALL`, `V5`.
- Character limits enforced server-side: prompt ≤3000 (simple mode), ≤5000 custom; style ≤1000; title ≤80.
- Task status mapping: `PENDING|TEXT_SUCCESS|FIRST_SUCCESS → PENDING`; `SUCCESS → SUCCESS`; `CREATE_TASK_FAILED|GENERATE_AUDIO_FAILED|SENSITIVE_WORD_ERROR|CALLBACK_EXCEPTION → FAILED`.
- Callback payload uses snake_case (`audio_url`); record-info uses camelCase (`audioUrl`). We only use record-info.
- All secrets via wrangler secrets (`KIE_API_KEY`, `APP_PASSWORD`); never in git.
- UI follows `design-system/song-auto/MASTER.md`: bg `#0F0F23`, accent `#22C55E`, primary `#1E1B4B`, secondary `#4338CA`, muted `#27273B`, border `#312E81`, destructive `#EF4444`, fg `#F8FAFC`, font Inter. No emoji icons — Lucide SVG only. Hover transitions 150–300ms. Respect `prefers-reduced-motion`.
- Every commit passes `tsc --noEmit` and `vitest run`.

---

### Task 1: Project scaffold (worker + web + wrangler config)

**Files:**
- Create: `package.json`, `tsconfig.json`, `wrangler.jsonc`, `vite.config.ts`
- Create: `src/worker/index.ts`, `index.html`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `src/worker/index.ts` exporting `app` (Hono instance) and default `{ fetch: app.fetch }`. Later tasks register routes on sub-apps mounted into it.
- Bindings type (used by every later task):
```ts
export type Env = {
  DB: D1Database;
  AUDIO: R2Bucket;
  KIE_API_KEY: string;
  APP_PASSWORD: string;
};
```
(live in `src/worker/types.ts`)

- [ ] **Step 1: Init npm project and install deps**

```bash
cd /Users/jaochai/code/Song-Auto
npm init -y
npm i hono nanoid
npm i -D wrangler vitest typescript @cloudflare/workers-types \
  react react-dom @types/react @types/react-dom @vitejs/plugin-react tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Write config files**

`wrangler.jsonc`:
```jsonc
{
  "name": "song-auto",
  "main": "src/worker/index.ts",
  "compatibility_date": "2026-08-22",
  "assets": {
    "directory": "./dist/client",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "song-auto-db", "database_id": "PLACEHOLDER_CREATED_IN_TASK_11", "migrations_dir": "migrations" }
  ],
  "r2_buckets": [
    { "binding": "AUDIO", "bucket_name": "song-audio" }
  ],
  "observability": { "enabled": true }
}
```
(Context7-verified pattern: `/api/*` requests match no static file, so they fall through to the Worker; unknown SPA routes get index.html via `not_found_handling`. No `run_worker_first` needed.)

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist/client', emptyOutDir: true },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/audio': 'http://127.0.0.1:8787',
    },
  },
});
```

`web/index.html` (Vite root is `web/`):
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Song-Auto</title></head>
  <body><div id="root"></div><script type="module" src="/main.tsx"></script></body>
</html>
```

`src/worker/index.ts`:
```ts
import { Hono } from 'hono';
import type { Env } from './types';

export const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true }));

export default { fetch: app.fetch };
```

`src/worker/types.ts`: the `Env` type above plus shared types:
```ts
export type SongStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export interface SongRow {
  id: string; taskId: string; title: string; prompt: string; style: string;
  tags: string; model: string; instrumental: number; status: SongStatus;
  error: string | null; r2Key: string | null; duration: number | null; createdAt: string;
}
```

- [ ] **Step 3: Write failing smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { app } from '../src/worker/index';

describe('health', () => {
  it('responds ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

Run: `npx vitest run tests/smoke.test.ts`
Expected: PASS (route already written — this validates the harness).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. Fix until clean.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "chore: scaffold worker+web+wrangler"
```

---

### Task 2: D1 schema migration

**Files:**
- Create: `migrations/0001_init.sql`

**Interfaces:**
- Produces: table `songs` matching `SongRow` (snake_case columns: `id, task_id, title, prompt, style, tags, model, instrumental, status, error, r2_key, duration, created_at`).

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  instrumental INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('PENDING','SUCCESS','FAILED')),
  error TEXT,
  r2_key TEXT,
  duration REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_songs_created ON songs (created_at DESC);
CREATE INDEX idx_songs_task ON songs (task_id);
```

- [ ] **Step 2: Apply locally and verify**

```bash
npx wrangler d1 migrations apply song-auto-db --local
npx wrangler d1 execute song-auto-db --local --command "INSERT INTO songs (id,task_id,model,status,created_at) VALUES ('t1','k1','V4_5','PENDING',datetime('now')); SELECT id,status FROM songs;"
```
Expected: row returned, then delete the test row.

- [ ] **Step 3: Commit**
```bash
git add migrations && git commit -m "feat: d1 songs schema"
```

---

### Task 3: Auth — password gate with signed cookie

**Files:**
- Create: `src/worker/auth.ts`
- Modify: `src/worker/index.ts` (mount middleware)
- Test: `tests/auth.test.ts`

**Interfaces:**
- Produces: `export async function authMiddleware(c, next)` — Hono middleware; sets `session` signed cookie name `"sa_session"` signed with `APP_PASSWORD` value; returns 401 JSON `{error:"unauthorized"}` when missing/invalid.
- `POST /api/auth` body `{ password }` → 200 `{ok:true}` + Set-Cookie, or 401.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../src/worker/auth';
import { setSignedCookie } from 'hono/cookie';

const makeApp = () => {
  const a = new Hono<{ Bindings: { APP_PASSWORD: string } }>();
  a.use('/api/*', authMiddleware);
  a.get('/api/ping', (c) => c.json({ ok: true }));
  return a;
};

describe('auth', () => {
  it('401 without cookie', async () => {
    const res = await makeApp().request('/api/ping');
    expect(res.status).toBe(401);
  });

  it('200 with valid signed cookie (set via helper like the login route does)', async () => {
    const secret = 'pw';
    const c: any = { req: { url: 'http://x/', headers: new Headers() }, res: undefined };
    // simulate what POST /api/auth does:
    const app = new Hono<{ Bindings: { APP_PASSWORD: string } }>();
    app.post('/login', async (ctx) => {
      await setSignedCookie(ctx, 'sa_session', 'ok', ctx.env.APP_PASSWORD, { httpOnly: true, sameSite: 'Lax', path: '/' });
      return ctx.json({ ok: true });
    });
    const loginRes = await app.request('/login', { method: 'POST' }, { APP_PASSWORD: secret });
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0];
    const res = await makeApp().request('/api/ping', { headers: { cookie } }, { APP_PASSWORD: secret });
    expect(res.status).toBe(200);
  });

  it('401 with tampered cookie', async () => {
    const res = await makeApp().request('/api/ping', { headers: { cookie: 'sa_session=tampered.sig' } }, { APP_PASSWORD: 'pw' });
    expect(res.status).toBe(401);
  });
});
```

Run: `npx vitest run tests/auth.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 2: Implement `src/worker/auth.ts`**

```ts
import type { Context, Next } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { Env } from './types';

export const COOKIE_NAME = 'sa_session';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const ok = await getSignedCookie(c, c.env.APP_PASSWORD, COOKIE_NAME);
  if (!ok) return c.json({ error: 'unauthorized' }, 401);
  await next();
}

export async function issueSession(c: Context<{ Bindings: Env }>) {
  await setSignedCookie(c, COOKIE_NAME, 'ok', c.env.APP_PASSWORD, {
    httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
}
```

Wire into `src/worker/index.ts`:
```ts
import { authMiddleware, issueSession } from './auth';
import type { Env } from './types';
// ...
app.post('/api/auth', async (c) => {
  const { password } = await c.req.json<{ password?: string }>().catch(() => ({ password: '' }));
  if (!password || password !== c.env.APP_PASSWORD) return c.json({ error: 'unauthorized' }, 401);
  await issueSession(c);
  return c.json({ ok: true });
});
app.use('/api/*', async (c, next) =>
  c.req.path === '/api/auth' || c.req.path === '/api/health' ? next() : authMiddleware(c, next)
);
```

- [ ] **Step 3: Run tests** — `npx vitest run tests/auth.test.ts` Expected: PASS.

- [ ] **Step 4: Commit** — `git commit -am "feat: password auth with signed cookie"`

---

### Task 4: KIE client module

**Files:**
- Create: `src/worker/kie.ts`
- Test: `tests/kie.test.ts`

**Interfaces:**
- Produces:
```ts
export interface GenerateInput {
  prompt: string; style?: string; title?: string; instrumental: boolean;
  model: string; negativeTags?: string;
}
export function validateGenerate(input: GenerateInput): string | null; // returns error msg or null
export async function kieGenerate(env: Env, input: GenerateInput): Promise<string>; // -> taskId
export type KiePoll =
  | { kind: 'PENDING' }
  | { kind: 'FAILED'; error: string }
  | { kind: 'TRANSIENT'; note: string };
export interface TrackInfo { audioUrl: string; duration: number | null; tags: string | null }
export async function kiePollTask(env: Env, taskId: string): Promise<KiePoll & { track?: TrackInfo }>;
```
- Status mapping lives ONLY here (single source): PENDING/TEXT_SUCCESS/FIRST_SUCCESS→PENDING; SUCCESS→extract first `response.sunoData[]` item's `audioUrl`,`duration`,`tags`; the four FAILED enums→FAILED with `errorMessage`; HTTP non-200 envelope or network throw→TRANSIENT.

- [ ] **Step 1: Write failing tests** covering: validate rejects empty prompt / >3000 simple prompt / >80 title; kieGenerate throws on `code!==200` envelope; kiePollTask maps each status class correctly (mock `fetch` via `vi.stubGlobal`); SUCCESS extracts `data.response.sunoData[0].audioUrl` (camelCase!).
- [ ] **Step 2: Run** `npx vitest run tests/kie.test.ts` — FAIL.
- [ ] **Step 3: Implement** minimal module per Interfaces (fetch with `Authorization` header; envelope check `code !== 200 → TRANSIENT` for poll, throw for generate).
- [ ] **Step 4: Run tests** — PASS. Also `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `feat: kie api client`

---

### Task 5: POST /api/generate + GET /api/tasks/:id + GET /api/songs

**Files:**
- Create: `src/worker/routes.ts`
- Modify: `src/worker/index.ts` (mount)
- Test: `tests/api.test.ts`

**Interfaces:**
- Consumes: `kieGenerate`, `kiePollTask`, `validateGenerate` from Task 4; `authMiddleware` from Task 3; `SongRow` from Task 1.
- Produces REST contract used by frontend (Tasks 7–10):
  - `POST /api/generate` body `{prompt, style?, title?, instrumental, model, negativeTags?}` → 201 `{id, status:'PENDING'}`; validation error → 400 `{error}`; kie create fail → 502 `{error}` (nothing inserted).
  - `GET /api/tasks/:id` (id = song row id) → `{status:'PENDING'|'SUCCESS'|'FAILED', song?: SongRow, error?}`. On kie SUCCESS: download mp3 (retry ≤3), `AUDIO.put(\`${songId}.mp3\`, bytes)`, update row `r2_key, tags, duration, status='SUCCESS'`. Download failure keeps row PENDING, returns `{status:'PENDING', transient:true}`.
  - `GET /api/songs` → `{songs: SongRow[]}` newest-first.

- [ ] **Step 1: Write failing tests** using `app.request(path, init, mockEnv)` with fake `DB` (in-memory object implementing `prepare(...).bind(...).all()/first()/run()` minimal surface) and fake `R2Bucket` (`put/get` over Map), stubbed global fetch for kie responses. Cases: unauthenticated 401; create happy path inserts PENDING row + returns 201; validation 400; poll PENDING passthrough; poll SUCCESS stores R2 key `{id}.mp3` and updates row; poll FAILED writes error; kie 5xx during create → 502 and no row.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `routes.ts` with `nanoid()` ids, ISO `created_at`, prepared statements.
- [ ] **Step 4: Run tests + tsc** — PASS/clean.
- [ ] **Step 5: Commit** — `feat: generate/task/songs routes`

---

### Task 6: GET /audio/:key — R2 streaming with Range

**Files:**
- Modify: `src/worker/routes.ts` (or new `src/worker/audio.ts`)
- Test: `tests/audio.test.ts`

**Interfaces:**
- Produces: `GET /audio/:key` → R2 `get(key, { range })` when `Range` header present else plain `get`; respond 206 with `Content-Range`/`Content-Length` when ranged, 200 otherwise; `Content-Type: audio/mpeg`; `Accept-Ranges: bytes`; missing object → 404.

- [ ] **Step 1: Failing tests**: full-object 200; ranged request passes offset into R2 get and yields 206 with correct headers; missing key 404. Mock R2 `get` returning `{ body: ReadableStream-ish, size }`.
- [ ] **Step 2: FAIL → Step 3 implement → Step 4 PASS + tsc.**
- [ ] **Step 5: Commit** — `feat: r2 audio streaming with range support`

---

### Task 7: Web scaffold — Tailwind tokens + auth screen

**Files:**
- Create: `web/main.tsx`, `web/App.tsx`, `web/index.css`, `web/lib/api.ts`, `web/components/AuthGate.tsx`
- Test: `tests/web/api.test.ts` (vitest, node — pure functions only)

**Interfaces:**
- Produces `web/lib/api.ts`:
```ts
export async function api<T>(path: string, init?: RequestInit): Promise<T>;
// throws ApiError{status} on !res.ok; 401 surfaces as err.status===401
export interface Song { id: string; title: string; prompt: string; style: string; tags: string;
  model: string; status: 'PENDING'|'SUCCESS'|'FAILED'; error: string|null;
  r2Key: string|null; duration: number|null; createdAt: string; audioUrl?: string }
export const songAudioUrl = (s: Song) => s.r2Key ? `/audio/${s.r2Key}` : null;
```

- [ ] **Step 1: `web/index.css`** — Tailwind v4 import + design tokens as CSS vars (colors from Global Constraints) + Google Fonts Inter import + `@media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }`.
- [ ] **Step 2: AuthGate** — if any api call gets 401 show centered password card (bg `#0F0F23`, border `#312E81`, accent button `#22C55E`); submit → `POST /api/auth` → retry load. Error message inline under field (visible label, not placeholder-only).
- [ ] **Step 3: Minimal App shell renders `<AuthGate>` wrapping placeholder grid; vite dev proxies verified manually later.**
- [ ] **Step 4: `npx tsc --noEmit && npx vitest run`** all green; **Commit** — `feat(web): tokens+auth gate`

---

### Task 8: Create panel (left)

**Files:**
- Create: `web/components/CreatePanel.tsx`
- Test: none beyond types (form logic covered by integration smoke in Task 11) — keep logic trivial.

**Interfaces:**
- Props: `onCreated(song: Song): void`
- State: prompt, instrumental (default false), advanced toggle (style, title, model select default `V4_5`, negativeTags). Client-side char counters (prompt/style/title limits from Global Constraints) shown as `n/max`.
- Submit → disable button, spinner, call `POST /api/generate`, `onCreated(newSong)`, reset form. Errors → inline toast text near button (destructive color).

Layout per MASTER.md: panel bg `#27273B`-tinted card, rounded-xl, labels visible 16px, focus ring `#22C55E`, inputs min-height 44px, hover transitions 150ms.

- [ ] Steps: implement → `tsc` clean → visual check via `npm run dev` → **Commit** `feat(web): create panel`

---

### Task 9: Library grid + polling

**Files:**
- Create: `web/components/LibraryGrid.tsx`, `web/hooks/useSongs.ts`

**Interfaces:**
- `useSongs()` → `{ songs, refresh, upsert(song) }`; initial `GET /api/songs`.
- Polling: every 10s, for each song with `status==='PENDING'` (one at a time, sequential — respects 3req/s limit) call `GET /api/tasks/:id`; apply returned song to state. Stop polling when no PENDING remain.
- Card: cover image area (gradient placeholder `#1E1B4B→#312E81`), title, tags line, duration mm:ss, status badge: PENDING=animated pulse dot, FAILED=red badge + error tooltip + Retry button (re-posts same params via `POST /api/generate`), SUCCESS shows play button overlay.
- Grid: responsive `grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4`. Empty state: "ยังไม่มีเพลง — สร้างเพลงแรกจากแผงด้านซ้าย" with icon (never blank).
- Stagger-in animation 300–450ms once per mount (CSS only; skipped under reduced motion).

- [ ] Steps: implement hooks+grid → `tsc` clean → **Commit** `feat(web): library grid with polling`

---

### Task 10: Player bar (bottom)

**Files:**
- Create: `web/components/PlayerBar.tsx`, modify `App.tsx`

**Interfaces:**
- Single `<audio>` element lifted to App; PlayerBar props: `{ song: Song|null, audioRef }`. Play/pause button (Lucide icons), seek slider bound to `timeupdate`, current/total time, marquee-free truncated title.
- Clicking a SUCCESS card sets active song + autoplay.
- Sticky bottom bar, bg `#1E1B4B`, top border `#312E81`, height 72px.

- [ ] Steps: implement → manual dev-server check (seek works = Range OK through worker) → `tsc` → **Commit** `feat(web): player bar`

---

### Task 11: Build wiring + deploy + production smoke test

**Files:**
- Modify: `package.json` scripts: `"build": "vite build && tsc --noEmit"`, `"deploy": "npm run build && wrangler deploy"`

- [ ] **Step 1: Provision cloud resources** (account anugooltippon@gmail.com):
```bash
npx wrangler r2 bucket create song-audio
npx wrangler d1 create song-auto-db   # put database_id into wrangler.jsonc replacing PLACEHOLDER
npx wrangler d1 migrations apply song-auto-db --remote
npx wrangler secret put KIE_API_KEY    # paste key (from Horoscope .env reuse if same account)
npx wrangler secret put APP_PASSWORD   # ask user for the shared team password
```
- [ ] **Step 2: Deploy** `npm run deploy` → note workers.dev URL.
- [ ] **Step 3: Production smoke test (real)**: open URL → password gate works → generate short instrumental ("calm lo-fi piano, 30 seconds") → card reaches SUCCESS within ~2min → play audio (streams from R2) → reload page → song persists in library. Record result in PR description.
- [ ] **Step 4: Commit + push**: `git push origin main`.

---

## Model Dispatch Table (การจ่ายโมเดล — per user rule 2026-08-23/24)

| งาน | โมเดล | เหตุผล |
|---|---|---|
| Tasks 1–6 (worker code, TS ล้วน, ไฟล์ใหม่, ตัวเลข/limit) | **Qwen** (DGX) | โค้ดล้วน/วิเคราะห์ — ฟรี, พิสูจน์แล้ว |
| Tasks 7–10 (frontend TS/TSX ล้วน) | **Qwen** | ไฟล์ใหม่ทั้งหมด ไม่มี prose ไทยในไฟล์เดิม |
| Copy/UI text ไทย (empty state, tooltips) | **GLM inline** | prose ไทยเป็นชิ้นงานจริง — สั้น ฝัง inline ได้ |
| Review ทุก task + final review | **GLM** | reviewer ต้องแกร่งกว่า implementer |
| Guardrail ทุก dispatch Qwen | — | **ห้าม python/sed แก้ byte ข้อความไทยในไฟล์เดิม — ใช้ patch tool เท่านั้น** |

Wave plan: Wave 1 = Tasks 1–4 (Qwen) → GLM review → Wave 2 = Tasks 5–6 (Qwen) → GLM review → Wave 3 = Tasks 7–10 (Qwen, copy ไทย inline GLM) → GLM review → Task 11 deploy (orchestrator).
