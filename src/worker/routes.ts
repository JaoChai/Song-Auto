import type { Context } from 'hono';
import { nanoid } from 'nanoid';
import {
  kieExtend, kieGenerate, kiePollTask, kieWavGenerate, kieWavPoll, validateExtend, validateGenerate,
  WavGenerateError,
  type ExtendInput, type GenerateInput, type TrackInfo,
} from './kie';
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
  parentSongId: (r.parent_song_id as string | null) ?? null,
  continueAt: typeof r.continue_at === 'number' ? r.continue_at : null,
});

const err = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const VARIANTS = [1, 2] as const;

/** เขียนแถว PENDING ที่เตรียมไว้แล้วลง D1 แบบ batch — generate และ extend ใช้ร่วมกัน */
async function insertSongRows(ctx: Context<{ Bindings: Env }>, rows: Array<Record<string, unknown>>) {
  await ctx.env.DB.batch(
    rows.map((r) =>
      ctx.env.DB.prepare(
        `INSERT INTO songs (id, task_id, title, prompt, style, tags, model, instrumental, status, error, r2_key, duration, created_at, variant, parent_song_id, continue_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, NULL, NULL, ?, ?, ?, ?)`,
      ).bind(
        r.id, r.task_id, r.title, r.prompt, r.style, r.tags, r.model, r.instrumental,
        r.created_at, r.variant, r.parent_song_id ?? null, r.continue_at ?? null,
      ),
    ),
  );
}

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
    await insertSongRows(ctx, rows);
  } catch (e) {
    return c(ctx).json({ error: `failed to insert song rows: ${err(e)}` }, 500);
  }

  return c(ctx).json({ songs: rows.map(toSongRow) }, 201);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_DOWNLOAD_ATTEMPTS = 3;

/** ดาวน์โหลดไฟล์จาก URL พร้อม retry — คืน null ถ้าล้มเหลวทุกครั้ง (ผู้เรียกตัดสินใจว่าจะ PENDING ต่อหรือ fallback) */
async function downloadBytes(url: string): Promise<Uint8Array | null> {
  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`);
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      if (attempt < MAX_DOWNLOAD_ATTEMPTS) await sleep(250 * attempt);
    }
  }
  return null;
}

/** เก็บ mp3 ลง R2 แล้วปิดงานเป็น SUCCESS — ใช้เป็น fallback เมื่อแปลง WAV ไม่สำเร็จ จะได้ไม่เสียเพลงที่สร้างมาแล้วทิ้งไป */
async function finishWithMp3(
  ctx: Context<{ Bindings: Env }>,
  id: string,
  track: TrackInfo,
  imageKey: string | null,
) {
  const bytes = await downloadBytes(track.audioUrl);
  if (!bytes) return c(ctx).json({ status: 'PENDING', transient: true });

  const r2Key = `${id}.mp3`;
  await ctx.env.AUDIO.put(r2Key, bytes, { httpMetadata: { contentType: 'audio/mpeg' } });

  await ctx.env.DB.prepare(
    `UPDATE songs SET status = 'SUCCESS', r2_key = ?, image_key = ?, tags = ?, duration = ?, suno_id = ?, error = NULL WHERE id = ?`,
  ).bind(r2Key, imageKey, track.tags ?? '', track.duration, track.sunoId, id).run();

  const row = await ctx.env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(id).first<Record<string, unknown>>();
  return c(ctx).json({ status: 'SUCCESS', song: toSongRow(row!) });
}

/**
 * แถวที่มี wav_task_id แล้ว (แทร็ก mp3 หาเจอแล้ว เริ่มแปลง WAV ไปแล้ว) — poll งานแปลงต่อ
 * แปลงไม่สำเร็จก็ไม่ทำให้เพลงหาย ถอยไปใช้ mp3 แทน (ดึง audioUrl ใหม่จาก record-info เดิม)
 */
async function pollWavConversion(ctx: Context<{ Bindings: Env }>, row: Record<string, unknown>, id: string) {
  const wavPoll = await kieWavPoll(ctx.env, row.wav_task_id as string);

  if (wavPoll.kind === 'TRANSIENT') return c(ctx).json({ status: 'PENDING', transient: true });
  if (wavPoll.kind === 'PENDING') return c(ctx).json({ status: 'PENDING' });

  const variant = Number(row.variant ?? 1);
  const imageKey = (row.image_key as string | null) ?? null;

  if (wavPoll.kind === 'FAILED') {
    const poll = await kiePollTask(ctx.env, row.task_id as string);
    const track = poll.kind === 'PENDING' ? poll.tracks[variant - 1] : undefined;
    if (!track || !track.audioUrl) {
      if (variant > 1) {
        await ctx.env.DB.prepare('DELETE FROM songs WHERE id = ?').bind(id).run();
        return c(ctx).json({ status: 'GONE' });
      }
      const message = 'แปลงไฟล์เป็น WAV ไม่สำเร็จ และดึงไฟล์ mp3 สำรองไม่ได้';
      await ctx.env.DB.prepare(`UPDATE songs SET status = 'FAILED', error = ? WHERE id = ?`).bind(message, id).run();
      return c(ctx).json({ status: 'FAILED', error: message });
    }
    return finishWithMp3(ctx, id, track, imageKey);
  }

  // SUCCESS
  const bytes = await downloadBytes(wavPoll.audioWavUrl);
  if (!bytes) return c(ctx).json({ status: 'PENDING', transient: true });

  const r2Key = `${id}.wav`;
  await ctx.env.AUDIO.put(r2Key, bytes, { httpMetadata: { contentType: 'audio/wav' } });

  await ctx.env.DB.prepare(`UPDATE songs SET status = 'SUCCESS', r2_key = ?, error = NULL WHERE id = ?`)
    .bind(r2Key, id).run();

  const updated = await ctx.env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(id).first<Record<string, unknown>>();
  return c(ctx).json({ status: 'SUCCESS', song: toSongRow(updated!) });
}

/**
 * GET /api/tasks/:id — poll kie once for this row's task, then take the track that belongs to
 * this row (`sunoData[variant - 1]`). A row whose track never arrives — the job finished with
 * fewer tracks, or failed — is deleted and reported as GONE, except variant 1, which is kept
 * as a FAILED row so the generation doesn't silently vanish from the library.
 *
 * เพลงทุกเพลงต้องเป็น WAV เสมอ: พอเจอแทร็ก mp3 แล้วจะไม่โหลดมาเก็บทันที แต่สั่งแปลง WAV ก่อน
 * (เก็บ wav_task_id ไว้ที่แถว) แล้วค้าง PENDING ต่อจนกว่าแปลงเสร็จ — ฝั่งเว็บ poll ซ้ำเหมือนเดิมอยู่แล้ว
 * ไม่ต้องแก้ logic ฝั่ง client เลย
 */
export async function getTask(ctx: Context<{ Bindings: Env }>) {
  const id = ctx.req.param('id') as string;
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

  // การแปลง WAV เริ่มไปแล้ว — poll งานนั้นต่อ ไม่ต้องยิง kie generate poll ซ้ำ
  if (row.wav_task_id) {
    return pollWavConversion(ctx, row, id);
  }

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

  const { duration, tags, imageUrl, sunoId } = track;

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

  // แปลง WAV เริ่มไม่ได้: error ชั่วคราว (429/455/500/เน็ตหลุด) ให้ลองใหม่รอบ poll ถัดไปแทนที่จะทิ้ง WAV ทันที —
  // error ถาวร (เครดิตไม่พอ/พารามิเตอร์ผิด/ฯลฯ) ถึงค่อย fallback เป็น mp3 ไม่ให้เพลงค้าง PENDING ตลอดกาล
  let wavTaskId: string;
  try {
    wavTaskId = await kieWavGenerate(ctx.env, { taskId: row.task_id as string, audioId: sunoId });
  } catch (err) {
    console.error(`kie wav generate failed for song ${id}:`, err);
    if (err instanceof WavGenerateError && err.retryable) {
      return c(ctx).json({ status: 'PENDING' });
    }
    return finishWithMp3(ctx, id, track, imageKey);
  }

  await ctx.env.DB.prepare(
    `UPDATE songs SET wav_task_id = ?, image_key = ?, tags = ?, duration = ?, suno_id = ? WHERE id = ?`,
  ).bind(wavTaskId, imageKey, tags ?? '', duration, sunoId, id).run();

  return c(ctx).json({ status: 'PENDING' });
}

/** GET /api/songs — all rows newest-first. */
export async function listSongs(ctx: Context<{ Bindings: Env }>) {
  const { results } = await ctx.env.DB.prepare('SELECT * FROM songs ORDER BY created_at DESC, id DESC').bind().all<Record<string, unknown>>();
  return c(ctx).json({ songs: results.map(toSongRow) });
}

type ExtendBody = Partial<
  Pick<ExtendInput, 'defaultParamFlag' | 'continueAt' | 'prompt' | 'style' | 'title' | 'negativeTags' | 'personaId' | 'personaModel'>
>;

/**
 * POST /api/songs/:id/extend — ต่อเพลงจากแถวนี้ แล้วเขียนแถว PENDING ใหม่สองแถว
 * ที่ชี้กลับมาหาเพลงต้นทาง โมเดลกับ audioId มาจากแถวต้นทางเสมอ ผู้เรียกกำหนดไม่ได้
 */
export async function extendSong(ctx: Context<{ Bindings: Env }>) {
  const parentId = ctx.req.param('id');
  const parent = await ctx.env.DB.prepare('SELECT * FROM songs WHERE id = ?')
    .bind(parentId).first<Record<string, unknown> | null>();
  if (!parent) return c(ctx).json({ error: `song not found: ${parentId}` }, 404);

  if (parent.status !== 'SUCCESS') {
    return c(ctx).json({ error: 'ต่อเพลงได้เฉพาะเพลงที่สร้างเสร็จแล้ว' }, 400);
  }
  const audioId = (parent.suno_id as string | null) ?? '';
  if (!audioId) {
    return c(ctx).json({ error: 'เพลงนี้สร้างก่อนระบบเก็บรหัสแทร็ก จึงต่อเพลงไม่ได้' }, 400);
  }

  let body: ExtendBody;
  try {
    body = (await ctx.req.json()) as ExtendBody;
  } catch {
    return c(ctx).json({ error: 'invalid JSON body' }, 400);
  }

  const custom = Boolean(body.defaultParamFlag);
  const model = parent.model as string;
  const instrumental = Number(parent.instrumental ?? 0);
  // โหมดปรับเองใช้ค่าจากผู้เรียก โหมดใช้ค่าเดิมยืมจากแถวต้นทาง
  const pick = (fromBody: string | undefined, fromParent: unknown) =>
    custom ? (fromBody ?? '') : ((fromParent as string) ?? '');

  const input: ExtendInput = {
    audioId,
    model,
    defaultParamFlag: custom,
    sourceDuration: typeof parent.duration === 'number' ? parent.duration : null,
    instrumental: instrumental === 1,
    ...(custom
      ? {
          continueAt: body.continueAt,
          prompt: body.prompt,
          style: body.style,
          title: body.title,
        }
      : {}),
    ...(body.negativeTags ? { negativeTags: body.negativeTags } : {}),
    ...(body.personaId && body.personaModel
      ? { personaId: body.personaId, personaModel: body.personaModel }
      : {}),
  };

  const validation = validateExtend(input);
  if (validation) return c(ctx).json({ error: validation }, 400);

  let taskId: string;
  try {
    taskId = await kieExtend(ctx.env, input);
  } catch (e) {
    return c(ctx).json({ error: err(e) }, 502);
  }

  const createdAt = new Date().toISOString();
  const rows = VARIANTS.map((variant) => ({
    id: nanoid(),
    task_id: taskId,
    title: pick(body.title, parent.title),
    prompt: pick(body.prompt, parent.prompt),
    style: pick(body.style, parent.style),
    tags: '',
    model,
    instrumental,
    status: 'PENDING' as const,
    error: null,
    r2_key: null,
    image_key: null,
    duration: null,
    created_at: createdAt,
    suno_id: null,
    variant,
    parent_song_id: parentId,
    continue_at: custom ? (body.continueAt ?? null) : null,
  }));

  try {
    await insertSongRows(ctx, rows);
  } catch (e) {
    return c(ctx).json({ error: `failed to insert song rows: ${err(e)}` }, 500);
  }

  return c(ctx).json({ songs: rows.map(toSongRow) }, 201);
}

/**
 * POST /api/songs/backfill-suno-id — เติม suno_id ให้แถวเก่าที่สร้างก่อน migration 0003
 * ยิง record-info ครั้งเดียวต่อหนึ่ง task แล้วจับคู่แทร็กตาม variant
 * เรียกแบบมือครั้งเดียว ไม่มีปุ่มบนหน้าเว็บ
 */
export async function backfillSunoId(ctx: Context<{ Bindings: Env }>) {
  const { results } = await ctx.env.DB
    .prepare(`SELECT * FROM songs WHERE suno_id IS NULL AND status = 'SUCCESS'`)
    .bind().all<Record<string, unknown>>();

  const byTask = new Map<string, Array<Record<string, unknown>>>();
  for (const row of results) {
    const taskId = row.task_id as string;
    if (!taskId) continue;
    const list = byTask.get(taskId) ?? [];
    list.push(row);
    byTask.set(taskId, list);
  }

  let filled = 0;
  const skipped: Array<{ taskId: string; reason: string }> = [];

  for (const [taskId, rows] of byTask) {
    const poll = await kiePollTask(ctx.env, taskId);
    if (poll.kind !== 'PENDING') {
      skipped.push({
        taskId,
        reason: poll.kind === 'FAILED' ? poll.error : poll.note,
      });
      continue;
    }
    for (const row of rows) {
      const track = poll.tracks[Number(row.variant ?? 1) - 1];
      if (!track || !track.sunoId) {
        skipped.push({ taskId, reason: `ไม่พบแทร็กลำดับที่ ${row.variant} ในงานนี้` });
        continue;
      }
      await ctx.env.DB.prepare('UPDATE songs SET suno_id = ? WHERE id = ?')
        .bind(track.sunoId, row.id as string).run();
      filled++;
    }
  }

  return c(ctx).json({ filled, skipped });
}
