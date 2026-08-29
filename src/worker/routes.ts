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
  imageKey: (r.image_key as string | null) ?? null,
  duration: (r.duration as number | null) ?? null,
  createdAt: r.created_at as string,
  sunoId: (r.suno_id as string | null) ?? null,
  variant: Number(r.variant ?? 1),
});

const err = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const VARIANTS = [1, 2] as const;

/** POST /api/generate — one kie job, two PENDING rows (Suno returns two tracks per task). */
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

  const createdAt = new Date().toISOString();
  const rows = VARIANTS.map((variant) => ({
    id: nanoid(),
    task_id: taskId,
    title: body.title ?? '',
    prompt: body.prompt ?? '',
    style: body.style ?? '',
    tags: '',
    model: body.model,
    instrumental: body.instrumental ? 1 : 0,
    status: 'PENDING' as const,
    error: null,
    r2_key: null,
    image_key: null,
    duration: null,
    created_at: createdAt,
    suno_id: null,
    variant,
  }));

  try {
    await ctx.env.DB.batch(
      rows.map((r) =>
        ctx.env.DB.prepare(
          `INSERT INTO songs (id, task_id, title, prompt, style, tags, model, instrumental, status, error, r2_key, duration, created_at, variant)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, NULL, NULL, ?, ?)`,
        ).bind(r.id, r.task_id, r.title, r.prompt, r.style, r.tags, r.model, r.instrumental, r.created_at, r.variant),
      ),
    );
  } catch (e) {
    return c(ctx).json({ error: `failed to insert song rows: ${err(e)}` }, 500);
  }

  return c(ctx).json({ songs: rows.map(toSongRow) }, 201);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_DOWNLOAD_ATTEMPTS = 3;

/**
 * GET /api/tasks/:id — poll kie once for this row's task, then take the track that belongs to
 * this row (`sunoData[variant - 1]`). A row whose track never arrives — the job finished with
 * fewer tracks, or failed — is deleted and reported as GONE, except variant 1, which is kept
 * as a FAILED row so the generation doesn't silently vanish from the library.
 */
export async function getTask(ctx: Context<{ Bindings: Env }>) {
  const id = ctx.req.param('id');
  const row = await ctx.env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(id).first<Record<string, unknown> | null>();
  if (!row) return c(ctx).json({ error: `song not found: ${id}` }, 404);

  // already downloaded — never spend a kie call or a download on it twice
  if (row.status === 'SUCCESS' && row.r2_key) {
    return c(ctx).json({ status: 'SUCCESS', song: toSongRow(row) });
  }

  const variant = Number(row.variant ?? 1);
  const drop = async () => {
    await ctx.env.DB.prepare('DELETE FROM songs WHERE id = ?').bind(id).run();
    return c(ctx).json({ status: 'GONE' });
  };
  // the error belongs on one card, not two — variant 1 keeps a FAILED row, others are deleted
  const fail = async (message: string) => {
    if (variant > 1) return drop();
    await ctx.env.DB.prepare(`UPDATE songs SET status = 'FAILED', error = ? WHERE id = ?`)
      .bind(message, id).run();
    row.status = 'FAILED';
    row.error = message;
    return c(ctx).json({ status: 'FAILED', error: message });
  };

  const poll = await kiePollTask(ctx.env, row.task_id as string);

  if (poll.kind === 'FAILED') return fail(poll.error);

  if (poll.kind === 'TRANSIENT') {
    // keep PENDING in D1; UI retries later
    return c(ctx).json({ status: 'PENDING', transient: true });
  }

  const track = poll.tracks[variant - 1];
  if (!track || !track.audioUrl) {
    // the job is done and this row's track never came
    if (poll.complete) return fail('งานสร้างเพลงเสร็จแล้ว แต่ไม่ได้รับไฟล์เพลงกลับมา');
    return c(ctx).json({ status: 'PENDING' });
  }

  const { audioUrl, duration, tags, imageUrl, sunoId } = track;

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

  // cover art is best-effort — a failure must not fail the song
  let imageKey: string | null = null;
  if (imageUrl) {
    try {
      const coverRes = await fetch(imageUrl);
      if (coverRes.ok) {
        const coverBytes = new Uint8Array(await coverRes.arrayBuffer());
        await ctx.env.AUDIO.put(`${id}.jpg`, coverBytes, { httpMetadata: { contentType: 'image/jpeg' } });
        imageKey = `${id}.jpg`;
      }
    } catch {
      // a song without cover art is fine
    }
  }

  await ctx.env.DB.prepare(
    `UPDATE songs SET status = 'SUCCESS', r2_key = ?, image_key = ?, tags = ?, duration = ?, suno_id = ?, error = NULL WHERE id = ?`,
  ).bind(r2Key, imageKey, tags ?? '', duration, sunoId, id).run();

  row.status = 'SUCCESS';
  row.r2_key = r2Key;
  row.image_key = imageKey;
  row.tags = tags ?? '';
  row.duration = duration;
  row.suno_id = sunoId;
  row.error = null;
  return c(ctx).json({ status: 'SUCCESS', song: toSongRow(row) });
}

/** GET /api/songs — all rows newest-first. */
export async function listSongs(ctx: Context<{ Bindings: Env }>) {
  const { results } = await ctx.env.DB.prepare('SELECT * FROM songs ORDER BY created_at DESC, id DESC').bind().all<Record<string, unknown>>();
  return c(ctx).json({ songs: results.map(toSongRow) });
}
