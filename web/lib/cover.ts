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
