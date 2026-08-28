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
