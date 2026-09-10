import type { Context } from 'hono';
import { kieGenerateLyrics, kiePollLyrics, LYRICS_PROMPT_LIMIT, validateLyricsPrompt } from './kie';
import type { Env } from './types';

const err = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * kie ยัดหลายกรณีไว้ใต้ code 400 เดียวกัน แยกได้จากข้อความเท่านั้น
 * ทุกข้อความที่คืนออกไปต้องบอกผู้ใช้ว่าทำอะไรต่อได้ ไม่ใช่แค่บอกว่าพัง
 */
export function toThaiLyricsError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('artist name')) {
    return 'เอาชื่อศิลปินออกจากคำอธิบายก่อน แล้วบอกเป็นแนวเพลงหรืออารมณ์แทน';
  }
  if (s.includes('moderation') || s.includes('sensitive')) {
    return 'คำอธิบายนี้ถูกระบบกรองไว้ ลองเขียนใหม่ให้ต่างจากเดิม';
  }
  if (s.includes('unable to generate') || s.includes('rephrasing')) {
    return 'คำอธิบายกว้างไป ลองบอกธีม อารมณ์ หรือเรื่องราวให้ชัดขึ้น';
  }
  return `แต่งเนื้อเพลงไม่สำเร็จ: ${raw}`;
}

/** POST /api/lyrics — เริ่มงานแต่งเนื้อเพลง ไม่แตะฐานข้อมูลเพราะงานอายุสั้น */
export async function createLyrics(ctx: Context<{ Bindings: Env }>) {
  let body: { prompt?: unknown };
  try {
    body = (await ctx.req.json()) as typeof body;
  } catch {
    return ctx.json({ error: 'invalid JSON body' }, 400);
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  const validation = validateLyricsPrompt(prompt);
  if (validation) {
    // validator คืนแค่สองข้อความ — แปลทั้งข้อความตรง ๆ ดีกว่า replace คำว่า prompt
    // ไม่งั้นผู้ใช้เจอประโยคครึ่งไทยครึ่งอังกฤษ
    const error = validation.includes('exceeds')
      ? `คำอธิบายยาวเกิน ${LYRICS_PROMPT_LIMIT} ตัวอักษร ลองย่อให้สั้นลง`
      : 'ใส่คำอธิบายก่อน เช่น อารมณ์ ธีม หรือเรื่องที่อยากเล่า';
    return ctx.json({ error }, 400);
  }

  try {
    const taskId = await kieGenerateLyrics(ctx.env, prompt);
    return ctx.json({ taskId }, 201);
  } catch (e) {
    return ctx.json({ error: toThaiLyricsError(err(e)) }, 502);
  }
}

/** GET /api/lyrics/:taskId — ถามสถานะงานแต่งเนื้อเพลง */
export async function getLyrics(ctx: Context<{ Bindings: Env }>) {
  const taskId = ctx.req.param('taskId') as string;
  const poll = await kiePollLyrics(ctx.env, taskId);

  if (poll.kind === 'SUCCESS') return ctx.json({ status: 'SUCCESS', variants: poll.variants });
  if (poll.kind === 'FAILED') {
    return ctx.json({ status: 'FAILED', error: toThaiLyricsError(poll.error) });
  }
  if (poll.kind === 'TRANSIENT') return ctx.json({ status: 'PENDING', transient: true });
  return ctx.json({ status: 'PENDING' });
}
