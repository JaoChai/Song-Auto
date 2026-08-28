# Song-Auto UI Redesign — "Library First"

**Date:** 2026-08-28
**Status:** Approved (design)
**Supersedes (UI only):** the split-panel layout introduced in `d99117f` (v3 Bento Clean)

## Problem

The current UI is a permanent two-column split: a create form (380px) on the left, library grid on the right. Three things are wrong with it:

1. **The form occupies half the viewport permanently**, even though creating a song is a rare action compared to browsing and listening. The library — the thing the user actually returns for — gets the leftovers.
2. **It breaks on mobile.** `App.tsx` wraps `<aside className="w-full shrink-0 md:w-[380px]">` and `<main>` in a plain `flex` container with no `flex-col` at small widths, so below `md` the form takes the full width and crushes the library beside it.
3. **Songs have no cover art.** kie returns `imageUrl` for every generated track (`docs/suno-api.md:61`) and the original spec planned to use it, but `TrackInfo` in `kie.ts` never reads the field, so every card shows the same grey music-note glyph.

Alongside these, four usability gaps surfaced during code review, all of which live in the UI layer:

- Generated songs **cannot be downloaded** — there is no download affordance anywhere.
- The **30-day session cookie is useless**: `App.tsx` initialises `authed` to `false`, so a valid cookie still lands the user on the password screen every reload.
- **Instrumental mode always fails.** `CreatePanel.tsx` sends `prompt: ''` when instrumental is checked; `validateGenerate` rejects an empty prompt with 400. Per `docs/suno-api.md:39`, `prompt` carries lyrics only when `customMode:true` **and** `instrumental:false` — an instrumental request in custom mode needs `style` and `title` alone, so the validator is wrong, not the form.
- There is **no search** and no sense of progress while a song generates.

## Goals

- Make the library the primary surface; make creating a song a deliberate, focused action.
- Give every song real cover art.
- Close the four usability gaps above.
- Keep the existing visual language (dark OLED, Inter, single green accent) — refine it, don't replace it.

## Non-Goals

- Playlists, favourites, user-defined tags, audio visualisers.
- Changing the polling architecture (browser-driven `GET /api/tasks/:id` stays as-is).
- Multi-user support.
- Adding an animation library — motion stays CSS-only.

## Design

### Layout

Three regions, top to bottom:

```
┌──────────────────────────────────────────────────────────┐
│  Song-Auto              [search…]         [+ New song]   │  56px, sticky
├──────────────────────────────────────────────────────────┤
│   cover grid — 2 / 3 / 4 columns                         │  scrolls
├──────────────────────────────────────────────────────────┤
│  [art] Title · style   ⏮ ▶ ⏭   ──●──── 1:24   ⬇  vol    │  72px, sticky
└──────────────────────────────────────────────────────────┘
```

The create form moves into a **slide-over panel** anchored to the right edge (desktop) or a full-height sheet rising from the bottom (mobile), opened by the header's primary button and dismissed by Escape, backdrop click, or a close button.

**Breakpoints** (Tailwind defaults): `< 640px` 2 columns · `640–1024px` 3 columns · `> 1024px` 4 columns, container `max-w-6xl`.

### Cover art

Cards are square-cropped cover images with the title and style beneath. Where no cover exists, a deterministic gradient placeholder derived from the song `id` fills the square — the same song always gets the same gradient.

kie's `imageUrl` expires like `audioUrl` does, so the cover is copied into R2 at the same moment the mp3 is, and served through the same authenticated route.

### Visual system

Inherits `design-system/song-auto/MASTER.md` unchanged in palette and typography. Refinements:

- **Accent discipline.** `--accent` (`#22c55e`) is reserved for the primary button and the currently-playing indicator. Everything else uses neutral surface and text tokens. (Today the accent also appears on retry links, checkboxes, and the wordmark.)
- **Cover-led colour.** Colour on the page comes from the artwork, not from the chrome — matching the `Music Streaming` guidance (`Dark #121212 + album art colours`).
- **Motion.** Durations 150–250ms on `--ease`. All motion wrapped in a `@media (prefers-reduced-motion: reduce)` block that disables transforms and animations — currently absent entirely.
- **Focus.** Every interactive element gets a visible `:focus-visible` ring in the accent colour.

### Components

| Component | Responsibility |
|---|---|
| `AppHeader` | wordmark, search input, "New song" button |
| `SongCard` | one cover tile: art, title, style, status, hover play/download |
| `CoverArt` | resolves cover URL or renders the id-derived gradient placeholder |
| `LibraryGrid` | responsive grid, loading skeletons, empty state, filtering by query |
| `CreatePanel` | the form, now rendered inside `SlideOver` |
| `SlideOver` | generic right-panel / bottom-sheet shell: backdrop, Escape, focus trap |
| `PlayerBar` | transport, prev/next, seek, download, volume |
| `Toast` | transient success/error messages |
| `AuthGate` | unchanged in behaviour, restyled to match |

`App.tsx` keeps ownership of the single `<audio>` element and the active-song state; prev/next resolve against the filtered, visible song list so the player follows what the user is looking at.

### Backend changes (minimal, UI-driven)

1. **Migration `0002_add_image_key.sql`** — `ALTER TABLE songs ADD COLUMN image_key TEXT;`
2. **`kie.ts`** — `TrackInfo` gains `imageUrl: string | null`, read from `sunoData[0].imageUrl`.
3. **`routes.ts` `getTask`** — after the mp3 is stored, attempt the cover: fetch `imageUrl`, `PUT` to R2 as `{id}.jpg`, and set `image_key` in the same `UPDATE`. A failed cover fetch is **not** an error: the song still becomes `SUCCESS` with `image_key` left `NULL`, and the placeholder covers it.
4. **`routes.ts` `toSongRow`** — map `image_key` → `imageKey`.
5. **`audio.ts`** — no change needed. The route already serves any R2 key behind auth and already reads `obj.httpMetadata?.contentType`, so a cover stored with `contentType: 'image/jpeg'` is served correctly as-is.

### Usability fixes

| Fix | Location | Change |
|---|---|---|
| Download | `SongCard`, `PlayerBar` | anchor to `/audio/{r2Key}` with `download={title}.mp3` |
| Session persistence | `App.tsx` | drop the local `authed` flag; derive auth state from `useSongs` — show `AuthGate` only when a request returned 401 |
| Instrumental | `kie.ts` + `CreatePanel` | `validateGenerate` stops requiring `prompt` when `instrumental` is true in custom mode; `kieGenerate` omits `prompt` from the body in that case; the form disables and clears the lyrics field |
| Mobile layout | new layout | grid + slide-over replace the broken flex split |
| Search | `AppHeader` + `LibraryGrid` | case-insensitive substring match over `title`, `style`, `tags`; client-side, no request |
| Pending progress | `SongCard` | shimmer over the cover square + elapsed time since `createdAt` |
| Submit feedback | `Toast` | success closes the panel and toasts; failure keeps the panel open with the error inline |

## Data flow

Unchanged. `POST /api/generate` → `PENDING` row → the browser polls one pending song every 10s → on kie `SUCCESS` the worker stores mp3 (and now cover) and flips the row to `SUCCESS`.

The only new data is `image_key`, which travels with the song row and is resolved to a URL client-side exactly as `r2Key` is today.

## Error handling

- **Cover fetch fails** → song still succeeds, placeholder renders. Never surfaced to the user.
- **Audio download fails** (existing behaviour) → row stays `PENDING`, next poll retries.
- **Generate fails** → panel stays open, error shown inline beneath the submit button.
- **401 on any request** → `AuthGate` replaces the app.
- **Missing cover in R2** (`404` from `/audio/:key`) → the `<img>` `onError` handler falls back to the gradient placeholder.

## Testing

Existing tests must keep passing (`tests/api.test.ts`, `kie.test.ts`, `audio.test.ts`, `auth.test.ts`, `smoke.test.ts`).

New worker tests:

- `kiePollTask` extracts `imageUrl` from `sunoData[0]`, and yields `null` when absent.
- `getTask` stores the cover and sets `image_key` on success.
- `getTask` still returns `SUCCESS` with `image_key = NULL` when the cover fetch throws.
- `/audio/:key` serves a stored cover with the correct `Content-Type`.
- `validateGenerate` accepts an instrumental custom-mode request with no prompt, and still rejects a non-instrumental one.
- `kieGenerate` omits `prompt` from the request body for an instrumental custom-mode request.

Manual verification: 375px / 768px / 1024px / 1440px widths; keyboard-only pass through header → grid → panel → player; reload with a valid cookie lands in the library, not the password screen.

## Pre-delivery checklist

- [ ] No emoji used as icons — inline SVG only, one consistent set
- [ ] `cursor-pointer` on every clickable element
- [ ] Transitions 150–250ms on all state changes
- [ ] Text contrast ≥ 4.5:1 against its surface
- [ ] `:focus-visible` rings present and visible
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive at 375 / 768 / 1024 / 1440
- [ ] No horizontal scroll at any width
- [ ] Icon-only buttons carry `aria-label`
- [ ] Every input has a visible `<label>`
