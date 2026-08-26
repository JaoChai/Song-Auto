# Song-Auto — Design Spec

Date: 2026-08-26
Status: Approved (design reviewed in chat 2026-08-26)

## Goal

Internal web app ("Suno clone") for personal/team use: generate AI music via the KIE.AI Suno API, listen to results, and keep a library of generated songs. No users, no billing, no public sign-up.

Non-goals (MVP): lyrics endpoint, extend, cover, replace-section, stems, persona, mashup, multi-user auth, credit tracking.

## Constraints & Decisions

| Decision | Choice | Reason |
|---|---|---|
| Hosting | Cloudflare only — Workers + Static Assets + D1 + R2 | User wants everything in one Cloudflare account |
| Backend | Hono on Workers | Small, TS-first, works with Static Assets |
| Frontend | React + Vite SPA served as Worker static assets | Single-page Suno-like layout |
| Task completion | **Polling proxy** (not webhook) | No public callback endpoint needed; internal tool has few concurrent tasks; kie.ai polling limit is 3 req/s per task |
| Audio storage | Download mp3 into R2 at SUCCESS; serve from R2 | Survives kie.ai link expiry/outage |
| Auth | Single shared password via env var → signed cookie | Internal tool, lightweight |
| Layout | One page: left create panel / right library grid / bottom player bar | Matches Suno UI per user request |

## Architecture

```
Browser (React SPA)
   │  fetch (same origin)
   ▼
Worker (Hono)
   ├── POST /api/auth        → check APP_PASSWORD, set signed cookie
   ├── POST /api/generate    → call kie POST /api/v1/generate → insert D1 row (PENDING)
   ├── GET  /api/tasks/:id   → proxy kie record-info; on SUCCESS: fetch audioUrl,
   │                            R2.put(key, bytes), update row (SUCCESS, r2Key, duration, tags)
   ├── GET  /api/songs       → list songs from D1 (newest first)
   └── GET  /audio/:key      → stream object from R2 (Range support for seeking)
```

External dependency: `https://api.kie.ai` with `Authorization: Bearer $KIE_API_KEY`.

## Data

D1 table `songs`:

```sql
CREATE TABLE songs (
  id TEXT PRIMARY KEY,            -- nanoid
  task_id TEXT NOT NULL,          -- kie.ai taskId
  title TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  instrumental INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,           -- PENDING | SUCCESS | FAILED
  error TEXT,                     -- kie errorMessage / our failure note
  r2_key TEXT,                    -- R2 object key when SUCCESS
  duration REAL,                  -- seconds
  created_at TEXT NOT NULL        -- ISO datetime
);
```

R2 bucket `song-audio`, key pattern `{songId}.mp3`. Cover images are not stored in MVP (use `imageUrl` from kie directly in the card while available; fall back to gradient placeholder).

## API Details

### POST /api/generate
Request body: `{ prompt: string, style?: string, title?: string, instrumental: boolean, model: string, negativeTags?: string }`

Worker maps to kie payload:
- Always sends `prompt`, `instrumental`, `model`, `callBackUrl` omitted (polling mode), and:
- If `style` or `title` provided → `customMode: true` (+ those fields), else `customMode: false`.
- Validation: prompt ≤3000 chars (simple) / ≤5000 custom V4_5+; style ≤1000; title ≤80.

Response: `{ id, status: "PENDING" }`. kie errors (401/402/429/5xx) → HTTP error with message; nothing inserted if create fails.

### GET /api/tasks/:id
Proxy to `GET /api/v1/generate/record-info?taskId=`. Map kie statuses:
- `PENDING`/`TEXT_SUCCESS`/`FIRST_SUCCESS` → `{status:"PENDING"}` (FIRST_SUCCESS may include partial sunoData but we wait for full SUCCESS)
- `SUCCESS` → download first track's `audioUrl` → store R2 → update D1 → `{status:"SUCCESS", song}`
- `CREATE_TASK_FAILED`, `GENERATE_AUDIO_FAILED`, `SENSITIVE_WORD_ERROR`, `CALLBACK_EXCEPTION` → update D1 FAILED with `errorMessage` → `{status:"FAILED", error}`
- Network/5xx from kie → keep PENDING in D1, return transient error so UI retries later.

Polling client-side every ~10s until terminal state.

### GET /api/songs
Rows ordered by `created_at DESC`. Include `r2_key` presence; frontend builds audio URL as `/audio/{key}`.

### GET /audio/:key
Stream R2 object with `Content-Type: audio/mpeg`, pass through `Range` header (R2 `get(..., {range})`) so seek works.

## Frontend (single page)

- Left panel "Create":
  - Simple mode: Prompt (textarea), Instrumental toggle.
  - Advanced toggle reveals: Style, Title, Model select (V3_5/V4/V4_5/V4_5PLUS/V5), Negative tags.
  - Submit → disabled while generating; new card appears in grid with spinner state.
- Right area "Library": responsive card grid — cover image (or placeholder), title, tags, duration, status badge (PENDING spinner / FAILED with error tooltip / playable).
- Bottom player bar (sticky): play/pause, seek slider, current time/duration, title. Single global `<audio>` element; clicking a card loads it.
- Theme: dark background with purple accent, Suno-like.
- Auth gate: any `/api/*` 401 → show password screen; after success set cookie and reload data.

## Error Handling

- kie create failure → toast with kie `msg`.
- Generation failed states → card shows FAILED badge + error text; offer "Retry" which calls `/api/generate` again (new task).
- Worker fetch-to-R2 download failure at SUCCESS → mark row FAILED? No — retry download up to 3 times; if still failing, leave PENDING so next poll retries (kie URLs live long enough for internal use).
- Expired/invalid cookie → all protected routes return 401.

## Config (wrangler vars/secrets)

- `KIE_API_KEY` (secret)
- `APP_PASSWORD` (secret)
- Bindings: `DB` (D1), `AUDIO` (R2 bucket)

## Testing

1. Unit (vitest): route handlers with mocked kie/R2/D1 — generate happy path, create-failure, poll mapping for each kie status, range streaming header logic.
2. Deploy smoke test (real): generate one short instrumental track end-to-end on production, verify audio plays from R2 URL, library persists across reload.

## Deployment

Single `wrangler deploy` from repo root; GitHub Actions optional follow-up (not in MVP scope). Branch: `main`.
