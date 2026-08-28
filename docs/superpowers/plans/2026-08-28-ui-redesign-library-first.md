# Library First UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent two-column split with a library-led layout where songs show real cover art, creating a song happens in a slide-over panel, and the four UI-layer usability gaps (download, session persistence, instrumental mode, mobile layout) are closed.

**Architecture:** The worker gains one column (`image_key`) and stores kie's cover image in R2 next to the mp3, reusing the existing authenticated `/audio/:key` route. The React app is restructured around a single scrolling grid of cover tiles, with the create form moved into a reusable `SlideOver` shell. Pure logic (gradient derivation, search filtering) is extracted into `web/lib/` so it can be unit-tested; visual work is verified in the browser.

**Tech Stack:** Cloudflare Workers + Hono + D1 + R2 · React 19 + Tailwind v4 + Vite · Vitest

## Global Constraints

- Design tokens come from `design-system/song-auto/MASTER.md` — palette (`--bg #0d0d0f`, `--accent #22c55e`), Inter, no new fonts, no new colour ramps.
- `--accent` is used **only** for the primary button and the currently-playing indicator. Nothing else.
- No new runtime dependencies. No animation library. No component library.
- Transitions 150–250ms using `var(--ease)`. New motion must use `animation`/`transition` so the existing `prefers-reduced-motion` block at `web/index.css:139` continues to cover it.
- Icons are inline SVG, `stroke-width` 1.8, 24×24 viewBox. No emoji.
- Every icon-only button carries `aria-label`. Every input carries a visible `<label>`.
- Interactive elements get `cursor-pointer` and a visible `:focus-visible` ring.
- Breakpoints: 2 columns `< 640px`, 3 columns `640–1024px`, 4 columns `> 1024px`. Container `max-w-6xl`.
- Thai user-facing copy stays Thai; existing Thai strings are preserved verbatim unless a task says otherwise.
- Run `npm run typecheck` before every commit. Run `npm test` on tasks that touch `src/worker/` or `web/lib/`.

## Testing note

The project has no React testing stack (no jsdom, no `@testing-library/react`) and this plan does not add one. Coverage is split:

- **Unit tests (Vitest):** everything in `src/worker/` and the pure functions in `web/lib/`.
- **Manual verification:** component rendering and layout, with the exact steps written into each UI task.

---

## File Structure

**Create:**
- `migrations/0002_add_image_key.sql` — the `image_key` column
- `web/lib/cover.ts` — gradient derivation from a song id
- `web/lib/filter.ts` — search filtering
- `web/components/CoverArt.tsx` — cover image with placeholder fallback
- `web/components/SongCard.tsx` — one library tile
- `web/components/SlideOver.tsx` — right-panel / bottom-sheet shell
- `web/components/AppHeader.tsx` — wordmark, search, new-song button
- `web/components/Toast.tsx` — transient messages
- `web/components/icons.tsx` — the shared inline SVG set
- `tests/cover.test.ts` — gradient determinism
- `tests/filter.test.ts` — search behaviour

**Modify:**
- `src/worker/kie.ts` — `TrackInfo.imageUrl`, instrumental validation
- `src/worker/routes.ts` — store cover, map `image_key`
- `src/worker/types.ts` — `SongRow.imageKey`
- `web/lib/api.ts` — `Song.imageKey`, `songCoverUrl`
- `web/index.css` — new primitives
- `web/App.tsx` — new composition, auth fix
- `web/components/LibraryGrid.tsx` — grid of `SongCard`
- `web/components/CreatePanel.tsx` — instrumental fix, panel-aware
- `web/components/PlayerBar.tsx` — prev/next, download, volume
- `tests/api.test.ts` — fake D1/R2 updated for the new column

---

### Task 1: Worker stores cover art

**Files:**
- Create: `migrations/0002_add_image_key.sql`
- Modify: `src/worker/kie.ts:96-149`, `src/worker/routes.ts:8-21,60-110`, `src/worker/types.ts:8-13`
- Test: `tests/kie.test.ts`, `tests/api.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TrackInfo.imageUrl: string | null` · `SongRow.imageKey: string | null` · R2 objects keyed `{songId}.jpg` with `contentType: 'image/jpeg'`.

- [ ] **Step 1: Write the failing test for imageUrl extraction**

Append to `tests/kie.test.ts`:

```ts
describe('kiePollTask cover art', () => {
  it('extracts imageUrl from the first sunoData item', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({
        code: 200, msg: 'ok',
        data: {
          status: 'SUCCESS',
          response: { sunoData: [{ audioUrl: 'https://x/a.mp3', duration: 120, tags: 'pop', imageUrl: 'https://x/a.jpg' }] },
        },
      })),
    ) as never;
    const res = await kiePollTask({ KIE_API_KEY: 'k' } as never, 'task-1');
    expect(res.track?.imageUrl).toBe('https://x/a.jpg');
  });

  it('yields null imageUrl when the field is absent', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({
        code: 200, msg: 'ok',
        data: { status: 'SUCCESS', response: { sunoData: [{ audioUrl: 'https://x/a.mp3' }] } },
      })),
    ) as never;
    const res = await kiePollTask({ KIE_API_KEY: 'k' } as never, 'task-1');
    expect(res.track?.imageUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/kie.test.ts -t "cover art"`
Expected: FAIL — `res.track.imageUrl` is `undefined`, not the URL.

- [ ] **Step 3: Add imageUrl to TrackInfo**

In `src/worker/kie.ts`, extend the interface:

```ts
export interface TrackInfo {
  audioUrl: string;
  duration: number | null;
  tags: string | null;
  imageUrl: string | null;
}
```

and in `kiePollTask`, inside the `status === 'SUCCESS'` branch:

```ts
    const track: TrackInfo = {
      audioUrl: first?.audioUrl ?? '',
      duration: typeof first?.duration === 'number' ? first.duration : null,
      tags: typeof first?.tags === 'string' ? first.tags : null,
      imageUrl: typeof first?.imageUrl === 'string' ? first.imageUrl : null,
    };
```

The `sunoData` element type at the top of the function must allow the field — it is already `Array<Partial<TrackInfo> & { id?: string }>`, so widening `TrackInfo` is enough.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/kie.test.ts -t "cover art"`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the migration**

Create `migrations/0002_add_image_key.sql`:

```sql
ALTER TABLE songs ADD COLUMN image_key TEXT;
```

- [ ] **Step 6: Add imageKey to the row type and mapper**

In `src/worker/types.ts`, add to `SongRow` after `r2Key`:

```ts
  imageKey: string | null;
```

In `src/worker/routes.ts`, add to `toSongRow` after the `r2Key` line:

```ts
  imageKey: (r.image_key as string | null) ?? null,
```

- [ ] **Step 7: Write the failing test for cover storage**

In `tests/api.test.ts`, the fake D1's SUCCESS-update branch currently destructures 4 binds. Update it to 5 and add `image_key`:

```ts
              // SUCCESS update: (r2Key, imageKey, tags, duration, id)
              const [r2_key, image_key, tags, duration, id] = args as [string, string | null, string | null, number | null, string];
              Object.assign(find(id)!, { status: 'SUCCESS', r2_key, image_key, tags, duration, error: null });
              return { success: true };
```

Then append two tests inside the existing `describe('API routes', ...)` block, using the file's own helpers (`makeEnv` returns `{ env, data, bucket, store }`; `cookieFor` takes the password string; `stubKieAndMp3` routes kie calls and the binary download to one mock):

```ts
  it('GET /api/tasks/:id: SUCCESS — stores the cover as {id}.jpg and sets image_key', async () => {
    const { env, data, store } = makeEnv([rowFixture('s1', 'task-1', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');
    stubKieAndMp3({
      taskId: 'task-1',
      status: 'SUCCESS',
      response: { sunoData: [{ id: 'a1', audioUrl: 'https://cdn/1.mp3', duration: 198.4, tags: 'calm, piano', imageUrl: 'https://cdn/1.jpg' }] },
    });

    const res = await app.request('/api/tasks/s1', { headers: { cookie } }, env);
    const body = await res.json() as { status: string; song: SongRow };

    expect(body.status).toBe('SUCCESS');
    expect(body.song.imageKey).toBe('s1.jpg');
    expect(data[0].image_key).toBe('s1.jpg');
    expect(store.get('s1.jpg')).toBeInstanceOf(Uint8Array);
    expect(store.get('s1.mp3')).toBeInstanceOf(Uint8Array);
  });

  it('GET /api/tasks/:id: SUCCESS — cover fetch failure leaves image_key null but keeps the song', async () => {
    const { env, data, store } = makeEnv([rowFixture('s2', 'task-2', '2026-08-26T00:00:00.000Z')]);
    const cookie = await cookieFor('pw');

    // route record-info to kie, the .jpg to a throw, everything else to the mp3 bytes
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/v1/generate/record-info')) {
        return {
          ok: true, status: 200,
          json: async () => ({
            code: 200, msg: 'success',
            data: {
              taskId: 'task-2', status: 'SUCCESS',
              response: { sunoData: [{ id: 'a2', audioUrl: 'https://cdn/2.mp3', duration: 90, tags: 'pop', imageUrl: 'https://cdn/2.jpg' }] },
            },
          }),
        } as unknown as Response;
      }
      if (u.endsWith('.jpg')) throw new Error('cover unreachable');
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as unknown as Response;
    }));

    const res = await app.request('/api/tasks/s2', { headers: { cookie } }, env);
    const body = await res.json() as { status: string; song: SongRow };

    expect(body.status).toBe('SUCCESS');
    expect(body.song.imageKey).toBeNull();
    expect(data[0].status).toBe('SUCCESS');
    expect(store.get('s2.mp3')).toBeInstanceOf(Uint8Array);
    expect(store.has('s2.jpg')).toBe(false);
  });
```

`rowFixture` produces rows without an `image_key` key; the fake D1's `Object.assign` adds it on update, so no fixture change is needed.

- [ ] **Step 8: Run it and confirm it fails**

Run: `npx vitest run tests/api.test.ts -t "cover"`
Expected: FAIL — `imageKey` is `undefined` and `s1.jpg` is not in R2.

- [ ] **Step 9: Store the cover in getTask**

In `src/worker/routes.ts`, inside `getTask`, replace the block that runs from `const r2Key = ...` through the `return` with:

```ts
    const r2Key = `${id}.mp3`;
    await ctx.env.AUDIO.put(r2Key, bytes, { httpMetadata: { contentType: 'audio/mpeg' } });

    // cover art is best-effort — a failure must not fail the song
    let imageKey: string | null = null;
    if (poll.track.imageUrl) {
      try {
        const coverRes = await fetch(poll.track.imageUrl);
        if (coverRes.ok) {
          const coverBytes = new Uint8Array(await coverRes.arrayBuffer());
          imageKey = `${id}.jpg`;
          await ctx.env.AUDIO.put(imageKey, coverBytes, { httpMetadata: { contentType: 'image/jpeg' } });
        }
      } catch {
        imageKey = null;
      }
    }

    await ctx.env.DB.prepare(`UPDATE songs SET status = 'SUCCESS', r2_key = ?, image_key = ?, tags = ?, duration = ?, error = NULL WHERE id = ?`)
      .bind(r2Key, imageKey, tags ?? '', duration, id).run();
    row.status = 'SUCCESS';
    row.r2_key = r2Key;
    row.image_key = imageKey;
    row.tags = tags ?? '';
    row.duration = duration;
    row.error = null;
    return c(ctx).json({ status: 'SUCCESS', song: toSongRow(row) });
```

The destructure above this block (`const { audioUrl, duration, tags } = poll.track;`) stays exactly as it is — the new code reads `poll.track.imageUrl` directly.

- [ ] **Step 10: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus the four new ones.

- [ ] **Step 11: Apply the migration locally**

Run: `npx wrangler d1 migrations apply song-auto-db --local`
Expected: `0002_add_image_key.sql` reported as applied.

- [ ] **Step 12: Typecheck and commit**

```bash
npm run typecheck
git add migrations/0002_add_image_key.sql src/worker tests
git commit -m "feat(worker): store kie cover art in R2 as image_key"
```

---

### Task 2: Instrumental mode accepts an empty prompt

**Files:**
- Modify: `src/worker/kie.ts:25-45,56-75`
- Test: `tests/kie.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `validateGenerate` returns `null` for `{prompt: '', style: 's', title: 't', instrumental: true, model: 'V5'}` · `kieGenerate` omits `prompt` from the request body in that case.

Per `docs/suno-api.md:39`, `prompt` carries lyrics only when `customMode:true` **and** `instrumental:false`. An instrumental custom-mode request is described by `style` + `title` alone.

- [ ] **Step 1: Write the failing tests**

Append to `tests/kie.test.ts`:

```ts
describe('instrumental mode', () => {
  const base = { style: 'lo-fi', title: 'Rain', model: 'V5' };

  it('accepts an empty prompt when instrumental in custom mode', () => {
    expect(validateGenerate({ ...base, prompt: '', instrumental: true })).toBeNull();
  });

  it('still rejects an empty prompt when not instrumental', () => {
    expect(validateGenerate({ ...base, prompt: '', instrumental: false })).toBe('prompt is required');
  });

  it('still rejects an empty prompt in simple mode even when instrumental', () => {
    expect(validateGenerate({ prompt: '', instrumental: true, model: 'V5' })).toBe('prompt is required');
  });

  it('omits prompt from the request body for instrumental custom mode', async () => {
    let sent: Record<string, unknown> = {};
    globalThis.fetch = vi.fn(async (_url: never, init: never) => {
      sent = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify({ code: 200, msg: 'ok', data: { taskId: 'T1' } }));
    }) as never;

    await kieGenerate({ KIE_API_KEY: 'k' } as never, { ...base, prompt: '', instrumental: true });

    expect(sent.prompt).toBeUndefined();
    expect(sent.style).toBe('lo-fi');
    expect(sent.instrumental).toBe(true);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/kie.test.ts -t "instrumental mode"`
Expected: FAIL — the first test gets `'prompt is required'`.

- [ ] **Step 3: Relax the validator**

In `src/worker/kie.ts`, replace the opening of `validateGenerate`:

```ts
export function validateGenerate(input: GenerateInput): string | null {
  const custom = Boolean(input.style || input.title);
  // kie only treats prompt as lyrics for custom + non-instrumental; an
  // instrumental custom-mode track is described by style + title alone.
  const promptOptional = custom && input.instrumental;
  if (!promptOptional && (!input.prompt || !input.prompt.trim())) return 'prompt is required';
  const promptLimit = custom ? PROMPT_LIMIT_CUSTOM : PROMPT_LIMIT_SIMPLE;
  if (input.prompt && input.prompt.length > promptLimit) {
    return `prompt exceeds ${promptLimit} characters (${custom ? 'custom mode' : 'simple mode'})`;
  }
```

This replaces the original first four lines of the function (the `prompt is required` check, the old `const custom = ...`, `promptLimit`, and the length check). The style / title / model checks below it are untouched — do not leave a second `const custom` declaration behind.

- [ ] **Step 4: Omit prompt in the request body**

In `kieGenerate`, replace the body construction:

```ts
  const custom = Boolean(input.style || input.title);
  const body: Record<string, unknown> = {
    customMode: custom,
    instrumental: input.instrumental,
    model: input.model,
    // kie.ai requires callBackUrl (422 without it) even though we poll record-info instead
    callBackUrl: 'https://song-auto.anugooltippon.workers.dev/api/health',
  };
  if (!(custom && input.instrumental)) body.prompt = input.prompt;
```

The `if (custom) { ... }` block for style/title and the `negativeTags` line below stay exactly as they are.

- [ ] **Step 5: Run and confirm pass**

Run: `npx vitest run tests/kie.test.ts`
Expected: PASS — including the pre-existing kie tests.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck && npm test
git add src/worker/kie.ts tests/kie.test.ts
git commit -m "fix(kie): allow empty prompt for instrumental custom-mode requests"
```

---

### Task 3: Client song type carries the cover

**Files:**
- Modify: `web/lib/api.ts:26-52`
- Create: `web/lib/cover.ts`
- Test: `tests/cover.test.ts`

**Interfaces:**
- Consumes: `SongRow.imageKey` from Task 1.
- Produces: `Song.imageKey: string | null` · `songCoverUrl(song): string | null` · `coverGradient(id): string` returning a CSS `linear-gradient(...)` value.

- [ ] **Step 1: Write the failing gradient test**

Create `tests/cover.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { coverGradient } from '../web/lib/cover';

describe('coverGradient', () => {
  it('is deterministic for the same id', () => {
    expect(coverGradient('abc123')).toBe(coverGradient('abc123'));
  });

  it('differs between ids', () => {
    expect(coverGradient('abc123')).not.toBe(coverGradient('xyz789'));
  });

  it('returns a css linear-gradient value', () => {
    expect(coverGradient('abc123')).toMatch(/^linear-gradient\(/);
  });

  it('handles an empty id without throwing', () => {
    expect(typeof coverGradient('')).toBe('string');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/cover.test.ts`
Expected: FAIL — cannot resolve `../web/lib/cover`.

- [ ] **Step 3: Implement the gradient**

Create `web/lib/cover.ts`:

```ts
/**
 * Deterministic stand-in artwork for songs with no stored cover.
 * The same id always yields the same gradient, so the library doesn't
 * reshuffle colours on every render.
 */
export function coverGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const hue2 = (hue + 48) % 360;
  return `linear-gradient(140deg, hsl(${hue} 42% 26%), hsl(${hue2} 38% 14%))`;
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npx vitest run tests/cover.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Extend the client Song type**

In `web/lib/api.ts`, add to the `Song` interface after `r2Key`:

```ts
  imageKey: string | null;
```

and add next to `songAudioUrl`:

```ts
export const songCoverUrl = (s: Song): string | null => (s.imageKey ? `/audio/${s.imageKey}` : null);
```

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck && npm test
git add web/lib/api.ts web/lib/cover.ts tests/cover.test.ts
git commit -m "feat(web): song cover url + deterministic gradient placeholder"
```

---

### Task 4: Search filtering

**Files:**
- Create: `web/lib/filter.ts`
- Test: `tests/filter.test.ts`

**Interfaces:**
- Consumes: `Song` from Task 3.
- Produces: `filterSongs(songs: Song[], query: string): Song[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/filter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterSongs } from '../web/lib/filter';
import type { Song } from '../web/lib/api';

const song = (over: Partial<Song>): Song => ({
  id: 'x', taskId: '', title: '', prompt: '', style: '', tags: '',
  model: 'V5', instrumental: 0, status: 'SUCCESS', error: null,
  r2Key: 'x.mp3', imageKey: null, duration: 60, createdAt: '2026-08-28T00:00:00Z',
  ...over,
});

describe('filterSongs', () => {
  const songs = [
    song({ id: '1', title: 'Rainy Day', style: 'lo-fi', tags: 'chill, mellow' }),
    song({ id: '2', title: 'Neon Drive', style: 'synthwave', tags: 'retro' }),
  ];

  it('returns everything for an empty query', () => {
    expect(filterSongs(songs, '')).toHaveLength(2);
  });

  it('returns everything for a whitespace-only query', () => {
    expect(filterSongs(songs, '   ')).toHaveLength(2);
  });

  it('matches on title, case-insensitively', () => {
    expect(filterSongs(songs, 'rainy').map((s) => s.id)).toEqual(['1']);
  });

  it('matches on style', () => {
    expect(filterSongs(songs, 'synth').map((s) => s.id)).toEqual(['2']);
  });

  it('matches on tags', () => {
    expect(filterSongs(songs, 'mellow').map((s) => s.id)).toEqual(['1']);
  });

  it('returns nothing when there is no match', () => {
    expect(filterSongs(songs, 'polka')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/filter.test.ts`
Expected: FAIL — cannot resolve `../web/lib/filter`.

- [ ] **Step 3: Implement**

Create `web/lib/filter.ts`:

```ts
import type { Song } from './api';

/** Case-insensitive substring match over title, style and tags. */
export function filterSongs(songs: Song[], query: string): Song[] {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter((s) =>
    `${s.title} ${s.style} ${s.tags}`.toLowerCase().includes(q),
  );
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npx vitest run tests/filter.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm test
git add web/lib/filter.ts tests/filter.test.ts
git commit -m "feat(web): client-side song search filter"
```

---

### Task 5: Icon set and CSS primitives

**Files:**
- Create: `web/components/icons.tsx`
- Modify: `web/index.css`

**Interfaces:**
- Consumes: nothing.
- Produces: named icon components `PlayIcon`, `PauseIcon`, `PrevIcon`, `NextIcon`, `DownloadIcon`, `SearchIcon`, `PlusIcon`, `CloseIcon`, `SpinnerIcon`, `MusicIcon`, `VolumeIcon` — each accepting `{ className?: string }` · CSS classes `.icon-btn`, `.field-label`, `.shimmer`, `.slide-over`, `.slide-over-backdrop`, `.toast`.

- [ ] **Step 1: Create the icon set**

Create `web/components/icons.tsx`:

Every icon takes `className` and `style` so callers can size them with Tailwind and colour them with a CSS variable. **Each `<svg>` below must spread both**: `<svg viewBox="0 0 24 24" className={className} style={style} ...>` — the snippet shows the pattern on the first icon; apply it to all eleven.

```tsx
import type { CSSProperties } from 'react';

type IconProps = { className?: string; style?: CSSProperties };

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const PlayIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const PauseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);

export const PrevIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M6 5h2v14H6zM20 5v14l-11-7z" />
  </svg>
);

export const NextIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
  </svg>
);

export const DownloadIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true">
    <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const SpinnerIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const MusicIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export const VolumeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6" />
  </svg>
);
```

- [ ] **Step 2: Add the CSS primitives**

Append to `web/index.css`, before the `prefers-reduced-motion` block at the end:

```css
/* icon button — square, quiet, accessible focus */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: var(--text-2);
  cursor: pointer;
  transition: background-color 160ms var(--ease), color 160ms var(--ease);
}
.icon-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text);
}
.icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* visible keyboard focus everywhere */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
}

/* pending cover shimmer */
@keyframes shimmer {
  from { background-position: -200% 0; }
  to { background-position: 200% 0; }
}
.shimmer {
  background-image: linear-gradient(
    100deg,
    transparent 20%,
    rgba(255, 255, 255, 0.06) 50%,
    transparent 80%
  );
  background-size: 200% 100%;
  animation: shimmer 1600ms linear infinite;
}

/* slide-over: right panel on desktop, bottom sheet on mobile */
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: none; }
}
@keyframes slideInUp {
  from { transform: translateY(100%); }
  to { transform: none; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.slide-over-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  animation: fadeIn 200ms var(--ease) both;
}
.slide-over {
  position: fixed;
  z-index: 50;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  inset: auto 0 0 0;
  max-height: 92vh;
  border-radius: 20px 20px 0 0;
  animation: slideInUp 240ms var(--ease) both;
}
@media (min-width: 768px) {
  .slide-over {
    inset: 0 0 0 auto;
    width: 440px;
    max-height: none;
    border-radius: 20px 0 0 20px;
    animation: slideInRight 240ms var(--ease) both;
  }
}

/* toast */
.toast {
  position: fixed;
  left: 50%;
  bottom: 96px;
  z-index: 60;
  transform: translateX(-50%);
  padding: 12px 18px;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  font-size: 14px;
  animation: riseIn 240ms var(--ease) both;
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, no CSS errors.

- [ ] **Step 4: Commit**

```bash
npm run typecheck
git add web/components/icons.tsx web/index.css
git commit -m "feat(web): shared icon set and layout primitives"
```

---

### Task 6: CoverArt and SongCard

**Files:**
- Create: `web/components/CoverArt.tsx`, `web/components/SongCard.tsx`

**Interfaces:**
- Consumes: `coverGradient` (Task 3), `songCoverUrl` / `songAudioUrl` / `fmtDuration` (Task 3), icons (Task 5).
- Produces: `<CoverArt song={Song} className?={string} />` · `<SongCard song isActive isPlaying onPlay onRetry />` where `onPlay: (song: Song) => void` and `onRetry: (song: Song) => void`.

- [ ] **Step 1: Write CoverArt**

Create `web/components/CoverArt.tsx`:

```tsx
import { useState } from 'react';
import { songCoverUrl, type Song } from '../lib/api';
import { coverGradient } from '../lib/cover';
import { MusicIcon } from './icons';

/** Square artwork: the stored cover if there is one, else a gradient derived from the song id. */
export function CoverArt({ song, className = '' }: { song: Song; className?: string }) {
  const url = songCoverUrl(song);
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className}`}
      style={{ background: coverGradient(song.id) }}
    >
      <MusicIcon className="h-7 w-7" />
    </div>
  );
}
```

The placeholder icon inherits `color`, so the card sets a muted colour on the wrapper.

- [ ] **Step 2: Write SongCard**

Create `web/components/SongCard.tsx`:

```tsx
import { fmtDuration, songAudioUrl, type Song } from '../lib/api';
import { CoverArt } from './CoverArt';
import { DownloadIcon, PauseIcon, PlayIcon, SpinnerIcon } from './icons';

const elapsed = (iso: string): string => {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs} วินาที`;
  return `${Math.floor(secs / 60)} นาที`;
};

interface Props {
  song: Song;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (song: Song) => void;
  onRetry: (song: Song) => void;
}

export function SongCard({ song, isActive, isPlaying, onPlay, onRetry }: Props) {
  const playable = song.status === 'SUCCESS' && songAudioUrl(song) !== null;
  const pending = song.status === 'PENDING';

  return (
    <article className="group flex flex-col gap-3">
      <div
        onClick={() => playable && onPlay(song)}
        role={playable ? 'button' : undefined}
        tabIndex={playable ? 0 : undefined}
        aria-label={playable ? `เล่น ${song.title || 'Untitled'}` : undefined}
        onKeyDown={(e) => {
          if (playable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onPlay(song);
          }
        }}
        className={`relative aspect-square overflow-hidden rounded-2xl ${playable ? 'cursor-pointer' : ''}`}
        style={{
          color: 'var(--text-3)',
          boxShadow: isActive ? '0 0 0 2px var(--accent)' : undefined,
        }}
      >
        <CoverArt song={song} />

        {pending && <div className="shimmer absolute inset-0" />}

        {/* hover/active overlay */}
        {playable && (
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'var(--accent)', color: '#052e12' }}
            >
              {isActive && isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
            </span>
          </div>
        )}

        {pending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <SpinnerIcon className="h-5 w-5 animate-spin" style={{ color: 'var(--text-2)' }} />
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>
              กำลังสร้าง · {elapsed(song.createdAt)}
            </span>
          </div>
        )}

        {playable && (
          <a
            href={songAudioUrl(song)!}
            download={`${song.title || 'song'}.mp3`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`ดาวน์โหลด ${song.title || 'Untitled'}`}
            className="icon-btn absolute right-1.5 top-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
            style={{ background: 'rgba(0,0,0,0.55)', color: 'var(--text)' }}
          >
            <DownloadIcon className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium" style={{ color: isActive ? 'var(--accent-text)' : undefined }}>
          {song.title || 'Untitled'}
        </h3>
        <p className="mt-0.5 flex items-center gap-2 truncate text-xs" style={{ color: 'var(--text-3)' }}>
          <span className="truncate">{song.tags || song.style || '—'}</span>
          {song.status === 'SUCCESS' && <span className="tabular-nums">{fmtDuration(song.duration)}</span>}
        </p>
        {song.status === 'FAILED' && (
          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-xs" style={{ color: '#f87171' }} title={song.error ?? ''}>
              {song.error || 'สร้างไม่สำเร็จ'}
            </span>
            <button
              type="button"
              onClick={() => onRetry(song)}
              className="shrink-0 cursor-pointer text-xs font-medium underline-offset-2 hover:underline"
              style={{ color: 'var(--accent-text)' }}
            >
              ลองใหม่
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
```

`SpinnerIcon` is passed a `style` here — Task 5 already gave every icon that prop, so nothing extra is needed.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/CoverArt.tsx web/components/SongCard.tsx
git commit -m "feat(web): cover art and song card components"
```

---

### Task 7: LibraryGrid rebuilt around SongCard

**Files:**
- Modify: `web/components/LibraryGrid.tsx` (full rewrite)

**Interfaces:**
- Consumes: `SongCard` (Task 6), `filterSongs` (Task 4).
- Produces: `<LibraryGrid songs loaded query activeSong isPlaying onPlay upsert />` where `query: string`.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `web/components/LibraryGrid.tsx`:

```tsx
import { api, type GenerateBody, type Song } from '../lib/api';
import { filterSongs } from '../lib/filter';
import { SongCard } from './SongCard';

interface Props {
  songs: Song[];
  loaded: boolean;
  query: string;
  activeSong: Song | null;
  isPlaying: boolean;
  onPlay: (song: Song) => void;
  upsert: (song: Song) => void;
}

const GRID = 'grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4';

export function LibraryGrid({ songs, loaded, query, activeSong, isPlaying, onPlay, upsert }: Props) {
  const retry = async (song: Song) => {
    const body: GenerateBody = {
      prompt: song.prompt,
      instrumental: song.instrumental === 1,
      model: 'V5',
      ...(song.style ? { style: song.style } : {}),
      ...(song.title ? { title: song.title } : {}),
    };
    try {
      const created = await api<{ id: string; status: 'PENDING' }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      upsert({
        ...song,
        id: created.id,
        taskId: '',
        status: 'PENDING',
        error: null,
        r2Key: null,
        imageKey: null,
        duration: null,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* next poll surfaces */
    }
  };

  if (!loaded) {
    return (
      <div className={GRID}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="aspect-square animate-pulse rounded-2xl" style={{ background: 'var(--surface)', animationDelay: `${i * 70}ms` }} />
            <div className="h-3 w-2/3 animate-pulse rounded" style={{ background: 'var(--surface)' }} />
          </div>
        ))}
      </div>
    );
  }

  const visible = filterSongs(songs, query);

  if (songs.length === 0) {
    return (
      <div className="card flex h-72 flex-col items-center justify-center gap-2 border-dashed text-center" style={{ background: 'transparent' }}>
        <p className="font-medium">คลังเพลงว่างอยู่</p>
        <p className="max-w-xs text-sm" style={{ color: 'var(--text-2)' }}>
          กด “สร้างเพลง” ด้านบนเพื่อสร้างเพลงแรกของคุณ
        </p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          ไม่พบเพลงที่ตรงกับ “{query}”
        </p>
      </div>
    );
  }

  return (
    <div className={GRID}>
      {visible.map((song, i) => (
        <div key={song.id} className="rise-in" style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}>
          <SongCard
            song={song}
            isActive={activeSong?.id === song.id}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onRetry={retry}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: errors only in `App.tsx`, which still passes the old props — Task 11 fixes that.

- [ ] **Step 3: Commit**

```bash
git add web/components/LibraryGrid.tsx
git commit -m "feat(web): rebuild library grid around cover tiles and search"
```

---

### Task 8: SlideOver shell

**Files:**
- Create: `web/components/SlideOver.tsx`

**Interfaces:**
- Consumes: `CloseIcon` (Task 5), `.slide-over` / `.slide-over-backdrop` (Task 5).
- Produces: `<SlideOver open title onClose>{children}</SlideOver>` where `open: boolean`, `title: string`, `onClose: () => void`.

- [ ] **Step 1: Write the component**

Create `web/components/SlideOver.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Right-side panel on desktop, bottom sheet on mobile. Escape and backdrop close it. */
export function SlideOver({ open, title, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // move focus into the panel so keyboard users land inside it
    panelRef.current?.querySelector<HTMLElement>('textarea, input, button')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="slide-over-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className="slide-over" role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex shrink-0 items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="ปิด">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add web/components/SlideOver.tsx
git commit -m "feat(web): slide-over panel shell"
```

---

### Task 9: CreatePanel — instrumental fix and panel fit

**Files:**
- Modify: `web/components/CreatePanel.tsx`
- Create: `web/components/Toast.tsx`

**Interfaces:**
- Consumes: `SpinnerIcon` (Task 5), `.field-label` (Task 5).
- Produces: `<CreatePanel onCreated={(song: Song) => void} />` — unchanged signature · `<Toast message onDone />` where `message: string | null` and `onDone: () => void`.

- [ ] **Step 1: Write the Toast**

Create `web/components/Toast.tsx`:

```tsx
import { useEffect } from 'react';

/** Auto-dismissing message. Renders nothing when message is null. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
```

- [ ] **Step 2: Fix the instrumental body and tidy the form for the panel**

In `web/components/CreatePanel.tsx`, replace the `submit` body construction so an instrumental request sends no prompt:

```tsx
      const body: GenerateBody = {
        prompt: instrumental ? '' : lyrics,
        style,
        title,
        instrumental,
        model: 'V5',
        ...(negativeTags ? { negativeTags } : {}),
      };
```

becomes:

```tsx
      const body: GenerateBody = {
        ...(instrumental ? {} : { prompt: lyrics }),
        style,
        title,
        instrumental,
        model: 'V5',
        ...(negativeTags ? { negativeTags } : {}),
      };
```

The local type annotation on the previous line was `GenerateBody & { customMode: true }` — a leftover that was never sent. Replace it with plain `GenerateBody` as shown.

and make `prompt` optional in `GenerateBody` (`web/lib/api.ts`):

```ts
export interface GenerateBody {
  prompt?: string;
  style?: string;
  title?: string;
  instrumental: boolean;
  model: string;
  negativeTags?: string;
}
```

In the `onCreated` call, add the new field:

```tsx
        r2Key: null,
        imageKey: null,
```

- [ ] **Step 3: Reorder the form so Instrumental leads**

The lyrics field is disabled by the instrumental checkbox, so the checkbox must come first — a disabled field above its own control reads as broken. Move the instrumental `<label>` block above the Lyrics block, and change the outer form element classes from `card flex h-full flex-col gap-6 p-7` to `flex flex-col gap-6 p-6` (the panel already provides the surface).

Wrap the lyrics block so it disappears entirely when instrumental is on:

```tsx
      {!instrumental && (
        <div>
          {/* existing lyrics label + counter + textarea, unchanged */}
        </div>
      )}
```

Replace the three raw `<label ... className="mb-2 block text-sm font-medium">` usages with `className="field-label"` where the label stands alone, keeping the counter rows as they are.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`

Then check, at 1440px and at 375px:
1. The panel opens with Instrumental at the top.
2. Ticking Instrumental hides the lyrics field; the submit button stays enabled once Style and Title are filled.
3. Submitting an instrumental song returns 201, not 400 — confirm in the network tab.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck && npm test
git add web/components/CreatePanel.tsx web/components/Toast.tsx web/lib/api.ts
git commit -m "fix(web): instrumental submits without a prompt; panel-fit create form"
```

---

### Task 10: PlayerBar — prev/next, download, volume

**Files:**
- Modify: `web/components/PlayerBar.tsx` (full rewrite)

**Interfaces:**
- Consumes: icons (Task 5), `fmtDuration` / `songAudioUrl` (Task 3).
- Produces: `<PlayerBar song audioRef isPlaying onPrev onNext hasPrev hasNext />` where `onPrev`/`onNext` are `() => void` and `hasPrev`/`hasNext` are `boolean`.

The existing `AudioEvents` helper assigns `ontimeupdate` during render, which is a side effect in the render path. This rewrite moves it into an effect.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `web/components/PlayerBar.tsx`:

```tsx
import { useEffect, useState, type RefObject } from 'react';
import { fmtDuration, songAudioUrl, type Song } from '../lib/api';
import { CoverArt } from './CoverArt';
import { DownloadIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, VolumeIcon } from './icons';

interface Props {
  song: Song | null;
  isPlaying: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function PlayerBar({ song, isPlaying, audioRef, onPrev, onNext, hasPrev, hasNext }: Props) {
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrent(el.currentTime);
      setTotal(Number.isFinite(el.duration) ? el.duration : 0);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onTime);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onTime);
    };
  }, [audioRef]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el || !song) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el || !total) return;
    const t = (Number(e.target.value) / 1000) * total;
    el.currentTime = t;
    setCurrent(t);
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100;
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const progress = total > 0 ? (current / total) * 100 : 0;
  const audioUrl = song ? songAudioUrl(song) : null;

  return (
    <footer
      className="sticky bottom-0 z-30 border-t"
      style={{ background: 'rgba(13,13,15,0.9)', backdropFilter: 'blur(16px)', borderColor: 'var(--border)' }}
      aria-label="เครื่องเล่นเพลง"
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-3 px-4 md:gap-4 md:px-6">
        {/* artwork + meta */}
        <div className="flex min-w-0 items-center gap-3" style={{ width: 220 }}>
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
            {song && <CoverArt song={song} />}
          </div>
          <div className="min-w-0">
            <p className={`truncate text-sm font-medium ${song ? '' : 'opacity-35'}`}>
              {song?.title ?? 'ไม่มีเพลงที่เลือก'}
            </p>
            <p className="truncate text-xs" style={{ color: 'var(--text-3)' }}>
              {song?.tags || song?.style || '—'}
            </p>
          </div>
        </div>

        {/* transport */}
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onPrev} disabled={!hasPrev} className="icon-btn" aria-label="เพลงก่อนหน้า">
            <PrevIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={!song}
            aria-label={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
            style={{ background: 'var(--accent)', color: '#052e12' }}
          >
            {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
          </button>
          <button type="button" onClick={onNext} disabled={!hasNext} className="icon-btn" aria-label="เพลงถัดไป">
            <NextIcon className="h-4 w-4" />
          </button>
        </div>

        {/* seek */}
        <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
          <span className="w-9 text-right text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {fmtDuration(current)}
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 10)}
            onChange={seek}
            disabled={!song || !total}
            aria-label="ตำแหน่งเพลง"
            className="h-1 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            style={{ background: `linear-gradient(to right,var(--accent) ${progress}%, var(--surface-hover) 0)` }}
          />
          <span className="w-9 text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {fmtDuration(total || (song?.duration ?? null))}
          </span>
        </div>

        {/* volume + download */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <div className="hidden items-center gap-2 md:flex">
            <VolumeIcon className="h-4 w-4" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={changeVolume}
              aria-label="ระดับเสียง"
              className="h-1 w-20 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              style={{ background: `linear-gradient(to right,var(--text-2) ${volume * 100}%, var(--surface-hover) 0)` }}
            />
          </div>
          {audioUrl ? (
            <a href={audioUrl} download={`${song?.title || 'song'}.mp3`} className="icon-btn" aria-label="ดาวน์โหลดเพลงนี้">
              <DownloadIcon className="h-4 w-4" />
            </a>
          ) : (
            <span className="icon-btn opacity-30" aria-hidden="true">
              <DownloadIcon className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      {/* mobile progress hairline */}
      <div className="h-0.5 w-full sm:hidden" style={{ background: 'var(--surface-hover)' }}>
        <div className="h-full" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: errors only in `App.tsx` for the new required props — Task 11 fixes that.

- [ ] **Step 3: Commit**

```bash
git add web/components/PlayerBar.tsx
git commit -m "feat(web): player transport, volume and download"
```

---

### Task 11: AppHeader and App composition, session fix

**Files:**
- Create: `web/components/AppHeader.tsx`
- Modify: `web/App.tsx` (full rewrite)

**Interfaces:**
- Consumes: every component from Tasks 6–10, `useSongs` (unchanged), `filterSongs` (Task 4).
- Produces: the assembled application.

The session fix: `App.tsx` currently gates on a local `authed` state that starts `false`, so a valid cookie still shows the password screen. `useSongs` already knows the truth — it sets `authNeeded` only when a request returns 401. The rewrite drops `authed` and gates on `loaded && authNeeded`.

- [ ] **Step 1: Write AppHeader**

Create `web/components/AppHeader.tsx`:

```tsx
import { PlusIcon, SearchIcon } from './icons';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onCreate: () => void;
}

export function AppHeader({ query, onQueryChange, onCreate }: Props) {
  return (
    <header
      className="sticky top-0 z-20 shrink-0"
      style={{ background: 'rgba(13,13,15,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:gap-5 md:px-6">
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

        <button
          type="button"
          onClick={onCreate}
          className="btn-primary inline-flex shrink-0 items-center justify-center gap-1.5"
          style={{ width: 'auto', minHeight: 40, padding: '0 16px', fontSize: 14 }}
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">สร้างเพลง</span>
        </button>
      </div>
    </header>
  );
}
```

`sr-only` is a Tailwind built-in, so no extra CSS is needed.

- [ ] **Step 2: Rewrite App.tsx**

Replace the entire contents of `web/App.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { AuthGate } from './components/AuthGate';
import { CreatePanel } from './components/CreatePanel';
import { LibraryGrid } from './components/LibraryGrid';
import { PlayerBar } from './components/PlayerBar';
import { SlideOver } from './components/SlideOver';
import { Toast } from './components/Toast';
import { songAudioUrl, type Song } from './lib/api';
import { filterSongs } from './lib/filter';
import { useSongs } from './hooks/useSongs';

export default function App() {
  const { songs, loaded, authNeeded, refresh, upsert } = useSongs();
  const [query, setQuery] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
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

      <AppHeader query={query} onQueryChange={setQuery} onCreate={() => setPanelOpen(true)} />

      <main className="mx-auto w-full min-h-0 max-w-6xl flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8">
        <LibraryGrid
          songs={songs}
          loaded={loaded}
          query={query}
          activeSong={active}
          isPlaying={isPlaying}
          onPlay={play}
          upsert={upsert}
        />
      </main>

      <PlayerBar
        song={active}
        isPlaying={isPlaying}
        audioRef={audioRef}
        onPrev={() => prev && play(prev)}
        onNext={() => next && play(next)}
        hasPrev={Boolean(prev)}
        hasNext={Boolean(next)}
      />

      <SlideOver open={panelOpen} title="สร้างเพลงใหม่" onClose={() => setPanelOpen(false)}>
        <CreatePanel
          onCreated={(song) => {
            upsert(song);
            setActiveId(song.id);
            wasPending.current = true;
            setPanelOpen(false);
            setToast('เริ่มสร้างเพลงแล้ว — จะขึ้นในคลังเมื่อเสร็จ');
          }}
        />
      </SlideOver>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both clean.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`

Check each of these:
1. Reload with a valid session cookie → lands in the library, **not** the password screen.
2. Wrong password → error message; correct password → library.
3. Grid shows 4 columns at 1440px, 3 at 800px, 2 at 375px, with no horizontal scroll at any width.
4. Typing in search filters the grid live; clearing it restores everything.
5. Clicking a cover plays it; the tile shows the accent ring; the player fills in with the same artwork.
6. Next/prev walk the filtered list and stop at the ends (buttons disable).
7. Download from a card and from the player both save an mp3.
8. Tab through header → grid → player: focus rings visible at every stop.
9. Open the panel, press Escape → closes. Open, click the backdrop → closes.

- [ ] **Step 5: Commit**

```bash
git add web/App.tsx web/components/AppHeader.tsx
git commit -m "feat(web): library-first composition with header search and session fix"
```

---

### Task 12: Restyle AuthGate and final pass

**Files:**
- Modify: `web/components/AuthGate.tsx`, `design-system/song-auto/MASTER.md`

**Interfaces:**
- Consumes: everything prior.
- Produces: the finished UI.

- [ ] **Step 1: Align AuthGate with the new primitives**

In `web/components/AuthGate.tsx`, change the password `<label>` class from `mb-2 block text-sm font-medium` to `field-label`, and change the subtitle text from `AI Music Studio · Suno V5` to `AI Music Studio`. Everything else stays.

- [ ] **Step 2: Record the layout change in the design system**

In `design-system/song-auto/MASTER.md`, under `## Style Guidelines`, replace the `### Page Pattern` block with:

```markdown
### Page Pattern

**Pattern Name:** Library First

- **Structure:** sticky header (wordmark · search · create) → scrolling cover grid → sticky player bar
- **Creation flow:** slide-over panel from the right (desktop) / bottom sheet (mobile)
- **Grid:** 2 columns < 640px · 3 columns 640–1024px · 4 columns > 1024px, `max-w-6xl`
- **Colour source:** cover artwork carries the colour; chrome stays neutral. `--accent` only on the primary button and the playing indicator.
```

- [ ] **Step 3: Run the full checklist**

Verify each item from the spec's pre-delivery checklist against the running app at 375 / 768 / 1024 / 1440:

- [ ] No emoji used as icons
- [ ] `cursor-pointer` on every clickable element
- [ ] Transitions 150–250ms
- [ ] Text contrast ≥ 4.5:1
- [ ] `:focus-visible` rings visible
- [ ] `prefers-reduced-motion` honoured (toggle it in DevTools Rendering panel; grid entrance and panel slide should stop)
- [ ] No horizontal scroll at any width
- [ ] Icon-only buttons have `aria-label`
- [ ] Every input has a visible or `sr-only` label

- [ ] **Step 4: Full verification**

```bash
npm run typecheck && npm test && npm run build
```

Expected: typecheck clean, all tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/components/AuthGate.tsx design-system/song-auto/MASTER.md
git commit -m "feat(web): align auth screen with new primitives; record Library First pattern"
```

---

## Deployment note

`migrations/0002_add_image_key.sql` must be applied to the remote D1 before deploying the worker, or every `getTask` write will fail:

```bash
npx wrangler d1 migrations apply song-auto-db --remote
npm run deploy
```

Songs created before this change keep `image_key = NULL` and render the gradient placeholder — this is expected, not a defect.
