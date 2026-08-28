import type { Song } from './api';

/** Case-insensitive substring match over title, style and tags. */
export function filterSongs(songs: Song[], query: string): Song[] {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter((s) =>
    `${s.title} ${s.style} ${s.tags}`.toLowerCase().includes(q),
  );
}
