import { api, fmtDuration, songAudioUrl, type GenerateBody, type Song } from '../lib/api';

interface Props {
  songs: Song[];
  loaded: boolean;
  activeSong: Song | null;
  onPlay: (song: Song) => void;
  upsert: (song: Song) => void;
}

const StatusBadge = ({ song }: { song: Song }) => {
  if (song.status === 'PENDING')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--color-border)' }}>
        <span
          className="inline-block h-2 w-2 animate-pulse rounded-full"
          style={{ background: 'var(--color-accent)' }}
        />
        กำลังสร้าง…
      </span>
    );
  if (song.status === 'FAILED')
    return (
      <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--color-destructive)', color: '#fff' }} title={song.error ?? ''}>
        ล้มเหลว
      </span>
    );
  return null;
};

export function LibraryGrid({ songs, loaded, activeSong, onPlay, upsert }: Props) {
  const retry = async (song: Song) => {
    const body: GenerateBody = {
      prompt: song.prompt,
      instrumental: song.instrumental === 1,
      model: song.model,
      ...(song.style ? { style: song.style } : {}),
      ...(song.title ? { title: song.title } : {}),
    };
    try {
      const created = await api<{ id: string; status: 'PENDING' }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      upsert({
        ...song,
        id: created.id,
        taskId: '',
        status: 'PENDING',
        error: null,
        r2Key: null,
        duration: null,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* error surfaces via next poll/refresh */
    }
  };

  if (!loaded) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl" style={{ background: 'var(--color-muted)' }} />
        ))}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--color-secondary)' }}>
          <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <p className="font-medium">ยังไม่มีเพลง</p>
        <p className="text-sm" style={{ color: '#94a3b8' }}>
          สร้างเพลงแรกจากแผงด้านซ้าย
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {songs.map((song) => {
        const playable = song.status === 'SUCCESS' && songAudioUrl(song) !== null;
        const isActive = activeSong?.id === song.id;
        return (
          <article
            key={song.id}
            className={`group overflow-hidden rounded-xl border transition-all duration-200 ${playable ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
            style={{
              background: 'var(--color-muted)',
              borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
            }}
            onClick={() => playable && onPlay(song)}
            role={playable ? 'button' : undefined}
            tabIndex={playable ? 0 : undefined}
            onKeyDown={(e) => {
              if (playable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onPlay(song);
              }
            }}
          >
            {/* cover */}
            <div
              className="relative flex h-28 items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-border))' }}
            >
              {playable && (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full opacity-90 shadow-lg transition-opacity duration-200 group-hover:opacity-100"
                  style={{ background: 'var(--color-accent)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0f172a">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              )}
              {song.status !== 'SUCCESS' && (
                <span className="absolute right-2 top-2">
                  <StatusBadge song={song} />
                </span>
              )}
            </div>

            <div className="p-3">
              <h3 className="truncate font-medium">{song.title || 'Untitled'}</h3>
              <p className="mt-0.5 truncate text-xs" style={{ color: '#94a3b8' }}>
                {song.tags || song.style || song.model}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs" style={{ color: '#94a3b8' }}>
                <span>{fmtDuration(song.duration)}</span>
                {song.status === 'FAILED' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void retry(song);
                    }}
                    className="cursor-pointer underline-offset-2 hover:underline"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    ลองใหม่
                  </button>
                )}
              </div>
              {song.status === 'FAILED' && song.error && (
                <p className="mt-1 truncate text-xs" style={{ color: 'var(--color-destructive)' }} title={song.error}>
                  {song.error}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
