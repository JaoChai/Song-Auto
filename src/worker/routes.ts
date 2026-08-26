import type { Context } from 'hono';
import { nanoid } from 'nanoid';
import { kieGenerate, kiePollTask, validateGenerate, type GenerateInput } from './kie';
import type { Env, SongRow } from './types';

const c = (ctx: Context<{ Bindings: Env }>) => ctx;

const toSongRow = (r: Record<string, unknown>): SongRow => ({
  id: r.id as string,
  taskId: (r.task_id as string) ?? '',
  title: (r.title as string) ?? '',
  prompt: (r.prompt as string) ?? '',
  style: (r.style as string) ?? '',
  tags: (r.tags as string) ?? '',
  model: r.model as string,
  instrumental: (r.instrumental as number) ?? 0,
  status: r.status as SongRow['status'],
  error: (r.error as string | null) ?? null,
  r2Key: (r.r2_key as string | null) ?? null,
  duration: (r.duration as number | null) ?? null,
  createdAt: r.created_at as string,
});

const err = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** POST /api/generate — call kie, then insert PENDING row. */
export async function createSong(ctx: Context<{ Bindings: Env }>) {
  let body: GenerateInput;
  try {
    body = (await ctx.req.json()) as GenerateInput;
  } catch {
    return c(ctx).json({ error: 'invalid JSON body' }, 400);
  }
  const validation = validateGenerate(body);
  if (validation) return c(ctx).json({ error: validation }, 400);

  let taskId: string;
  try {
    taskId = await kieGenerate(ctx.env, body);
  } catch (e) {
    return c(ctx).json({ error: err(e) }, 502);
  }

  const id = nanoid();
  const createdAt = new Date().toISOString();
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO songs (id, task_id, title, prompt, style, tags, model, instrumental, status, error, r2_key, duration, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, NULL, NULL, ?)`,
    ).bind(id, taskId, body.title ?? '', body.prompt, body.style ?? '', '', body.model, body.instrumental ? 1 : 0, createdAt).run();
  } catch (e) {
    return c(ctx).json({ error: `failed to insert song row: ${err(e)}` }, 500);
  }
  return c(ctx).json({ id, status: 'PENDING' }, 201);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_DOWNLOAD_ATTEMPTS = 3;

/** GET /api/tasks/:id — poll kie; on SUCCESS download mp3 (retry ≤3) + R2 put + D1 update. */
export async function getTask(ctx: Context<{ Bindings: Env }>) {
  const id = ctx.req.param('id');
  const row = await ctx.env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(id).first<Record<string, unknown> | null>();
  if (!row) return c(ctx).json({ error: `song not found: ${id}` }, 404);

  const poll = await kiePollTask(ctx.env, row.task_id as string);

  if (poll.kind === 'FAILED') {
    await ctx.env.DB.prepare(`UPDATE songs SET status = 'FAILED', error = ? WHERE id = ?`)
      .bind(poll.error, id).run();
    row.status = 'FAILED';
    row.error = poll.error;
    return c(ctx).json({ status: 'FAILED', error: poll.error });
  }

  // SUCCESS signal: kiePollTask returns kind PENDING with a track attached.
  if (poll.track) {
    const { audioUrl, duration, tags } = poll.track;
    if (!audioUrl) return c(ctx).json({ status: 'PENDING', transient: true });

    let bytes: Uint8Array | null = null;
    for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(audioUrl);
        if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`);
        const buf = await res.arrayBuffer();
        bytes = new Uint8Array(buf);
        break;
      } catch {
        if (attempt < MAX_DOWNLOAD_ATTEMPTS) await sleep(250 * attempt);
      }
    }
    if (!bytes) {
      // row stays PENDING so the next poll retries the download
      return c(ctx).json({ status: 'PENDING', transient: true });
    }

    const r2Key = `${id}.mp3`;
    await ctx.env.AUDIO.put(r2Key, bytes, { httpMetadata: { contentType: 'audio/mpeg' } });
    await ctx.env.DB.prepare(`UPDATE songs SET status = 'SUCCESS', r2_key = ?, tags = ?, duration = ?, error = NULL WHERE id = ?`)
      .bind(r2Key, tags ?? '', duration, id).run();
    row.status = 'SUCCESS';
    row.r2_key = r2Key;
    row.tags = tags ?? '';
    row.duration = duration;
    row.error = null;
    return c(ctx).json({ status: 'SUCCESS', song: toSongRow(row) });
  }

  if (poll.kind === 'TRANSIENT') {
    // keep PENDING in D1; UI retries later
    return c(ctx).json({ status: 'PENDING', transient: true });
  }
  return c(ctx).json({ status: 'PENDING' });
}

/** GET /api/songs — all rows newest-first. */
export async function listSongs(ctx: Context<{ Bindings: Env }>) {
  const { results } = await ctx.env.DB.prepare('SELECT * FROM songs ORDER BY created_at DESC, id DESC').bind().all<Record<string, unknown>>();
  return c(ctx).json({ songs: results.map(toSongRow) });
}
