import type { Context } from 'hono';
import type { Env } from './types';

const parseRange = (header: string): { offset?: number; length?: number; suffix?: number } | null | 'invalid' => {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  if (m[1] !== '') {
    if (m[2] !== '') return { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 };
    return { offset: Number(m[1]) };
  }
  return { suffix: Number(m[2]) };
};

/**
 * GET /audio/:key — stream an mp3 from R2 with Range support for <audio> seeking.
 * - No Range header → 200, full object, Accept-Ranges: bytes
 * - Range: bytes=start-end / start- / -suffix → R2 ranged get → 206 + Content-Range
 * - Invalid range → 416 · Missing object → 404
 */
export async function getAudio(ctx: Context<{ Bindings: Env }>) {
  const key = ctx.req.param('key') as string;
  const rangeHeader = ctx.req.header('Range');

  let rangeOpts: { offset?: number; length?: number; suffix?: number } | undefined;
  if (rangeHeader !== undefined) {
    const parsed = parseRange(rangeHeader);
    if (parsed === 'invalid') return ctx.json({ error: 'invalid range header' }, 416);
    rangeOpts = parsed ?? undefined;
  }

  const obj = await ctx.env.AUDIO.get(key, rangeOpts ? { range: rangeOpts as R2Range } : undefined);
  if (!obj) return ctx.json({ error: 'audio not found' }, 404);
  const keyFound: string = key; // obj.key may be typed loosely; key is authoritative
  void keyFound;

  // Ranged get returns obj.range = the satisfied range; full get has no range field.
  const satisfied = (obj as { range?: { offset?: number; length?: number; suffix?: number } }).range;

  const headers = new Headers({
    'Content-Type': obj.httpMetadata?.contentType ?? 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(obj.size),
  });

  if (rangeHeader !== undefined && satisfied) {
    // To emit a correct "bytes start-end/total" we need the total size — head() the object.
    const head = await ctx.env.AUDIO.head(keyFound);
    const total = head?.size ?? obj.size;
    let start: number;
    let end: number;
    if (satisfied.suffix !== undefined) {
      end = total - 1;
      start = Math.max(0, total - satisfied.suffix);
    } else {
      start = satisfied.offset ?? 0;
      end = start + (satisfied.length ?? total - start) - 1;
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Content-Length', String(obj.size));
    return new Response(obj.body, { status: 206, headers });
  }

  return new Response(obj.body, { status: 200, headers });
}
