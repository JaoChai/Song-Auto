import { api, type GenerateBody, type Song } from '../lib/api';
import { filterSongs } from '../lib/filter';
import { SongCard } from './SongCard';

interface Props {
  songs: Song[];
  loaded: boolean;
  query: string;
  activeSong: Song | null;
  isPlaying: boolean;
  onPlay: (song: Song) => void;
  upsert: (song: Song | Song[]) => void;
  remove: (id: string) => void;
  onRetryFailed: (message: string) => void;
}

const GRID = 'grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4';

export function LibraryGrid({ songs, loaded, query, activeSong, isPlaying, onPlay, upsert, remove, onRetryFailed }: Props) {
  const retry = async (song: Song) => {
    const body: GenerateBody = {
      prompt: song.prompt,
      instrumental: song.instrumental === 1,
      model: 'V5',
      ...(song.style ? { style: song.style } : {}),
      ...(song.title ? { title: song.title } : {}),
    };
    try {
      const created = await api<{ songs: Song[] }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      // the failed card is replaced by the fresh pair
      remove(song.id);
      upsert(created.songs);
    } catch {
      // a failed retry creates no new row, so there's nothing for the next
      // poll to surface — the user needs feedback here, not silence
      onRetryFailed('ลองสร้างเพลงใหม่ไม่สำเร็จ');
    }
  };

  if (!loaded) {
    return (
      <div className={GRID}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="aspect-square animate-pulse rounded-2xl" style={{ background: 'var(--surface)', animationDelay: `${i * 70}ms` }} />
            <div className="h-3 w-2/3 animate-pulse rounded" style={{ background: 'var(--surface)' }} />
          </div>
        ))}
      </div>
    );
  }

  const visible = filterSongs(songs, query);

  if (songs.length === 0) {
    return (
      <div className="card flex h-72 flex-col items-center justify-center gap-2 border-dashed text-center" style={{ background: 'transparent' }}>
        <p className="font-medium">คลังเพลงว่างอยู่</p>
        <p className="max-w-xs text-sm" style={{ color: 'var(--text-2)' }}>
          กรอกฟอร์มสร้างเพลงเพื่อเริ่มเพลงแรกของคุณ
        </p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          ไม่พบเพลงที่ตรงกับ “{query}”
        </p>
      </div>
    );
  }

  return (
    <div className={GRID}>
      {visible.map((song, i) => (
        <div key={song.id} className="rise-in" style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}>
          <SongCard
            song={song}
            showVariant={visible.filter((s) => s.taskId === song.taskId).length > 1}
            isActive={activeSong?.id === song.id}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onRetry={retry}
          />
        </div>
      ))}
    </div>
  );
}
