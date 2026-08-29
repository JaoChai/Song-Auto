import { describe, it, expect } from 'vitest';
import { filterSongs } from '../web/lib/filter';
import type { Song } from '../web/lib/api';

const song = (over: Partial<Song>): Song => ({
  id: 'x', taskId: '', title: '', prompt: '', style: '', tags: '',
  model: 'V5', instrumental: 0, status: 'SUCCESS', error: null,
  r2Key: 'x.mp3', imageKey: null, duration: 60, createdAt: '2026-08-28T00:00:00Z',
  sunoId: null, variant: 1,
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
