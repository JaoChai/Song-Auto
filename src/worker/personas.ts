import type { Context } from 'hono';
import { nanoid } from 'nanoid';
import { kieCreatePersona } from './kie';
import type { Env, PersonaRow } from './types';

const toPersonaRow = (r: Record<string, unknown>): PersonaRow => ({
  id: r.id as string,
  personaId: (r.persona_id as string) ?? '',
  name: (r.name as string) ?? '',
  description: (r.description as string) ?? '',
  songId: (r.song_id as string) ?? '',
  createdAt: r.created_at as string,
});

const err = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const trimmed = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** POST /api/personas — turn one finished track into a persona kie can reuse. */
export async function createPersona(ctx: Context<{ Bindings: Env }>) {
  let body: { songId?: unknown; name?: unknown; description?: unknown };
  try {
    body = (await ctx.req.json()) as typeof body;
  } catch {
    return ctx.json({ error: 'invalid JSON body' }, 400);
  }

  const songId = trimmed(body.songId);
  const name = trimmed(body.name);
  const description = trimmed(body.description);
  if (!songId) return ctx.json({ error: 'songId is required' }, 400);
  if (!name) return ctx.json({ error: 'ต้องตั้งชื่อ persona' }, 400);
  if (!description) return ctx.json({ error: 'ต้องมีคำอธิบาย persona' }, 400);

  const song = await ctx.env.DB.prepare('SELECT * FROM songs WHERE id = ?')
    .bind(songId).first<Record<string, unknown> | null>();
  if (!song) return ctx.json({ error: `song not found: ${songId}` }, 404);

  // suno_id เพิ่งเริ่มเก็บตอนสเปก two-variants — เพลงก่อนหน้านั้นทำ persona ไม่ได้
  const audioId = (song.suno_id as string | null) ?? '';
  if (!audioId) {
    return ctx.json({ error: 'เพลงนี้สร้างก่อนระบบเก็บรหัสแทร็ก จึงทำ persona ไม่ได้' }, 400);
  }

  let personaId: string;
  try {
    personaId = await kieCreatePersona(ctx.env, {
      taskId: song.task_id as string,
      audioId,
      name,
      description,
    });
  } catch (e) {
    return ctx.json({ error: err(e) }, 502);
  }

  const row = {
    id: nanoid(),
    persona_id: personaId,
    name,
    description,
    song_id: songId,
    created_at: new Date().toISOString(),
  };
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO personas (id, persona_id, name, description, song_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(row.id, row.persona_id, row.name, row.description, row.song_id, row.created_at).run();
  } catch (e) {
    return ctx.json({ error: `failed to insert persona row: ${err(e)}` }, 500);
  }

  return ctx.json({ persona: toPersonaRow(row) }, 201);
}

/** GET /api/personas — newest first. */
export async function listPersonas(ctx: Context<{ Bindings: Env }>) {
  const { results } = await ctx.env.DB
    .prepare('SELECT * FROM personas ORDER BY created_at DESC, id DESC')
    .bind().all<Record<string, unknown>>();
  return ctx.json({ personas: results.map(toPersonaRow) });
}
