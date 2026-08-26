import { api, fmtDuration, songAudioUrl, type GenerateBody, type Song } from '../lib/api';

interface Props {
  songs: Song[];
  loaded: boolean;
  activeSong: Song | null;
  isPlaying: boolean;
  onPlay: (song: Song) => void;
  upsert: (song: Song) => void;
}

/** Minimal equalizer glyph for the playing card. */
function EqBars() {
  return (
    <span className="inline-flex h-3.5 items-end gap-[2.5px]">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[2.5px] rounded-sm"
          style={{
            background: 'var(--accent)',
            animation: `eq 800ms ease-in-out ${i * 130}ms infinite alternate`,
          }}
        />
      ))}
      <style>{`@keyframes eq { 0%{height:20%} 100%{height:100%} }`}</style>
    </span>
  );
}

export function LibraryGrid({ songs, loaded, activeSong, isPlaying, onPlay, upsert }: Props) {
  const retry = async (song: Song) => {
    const body: GenerateBody = {
      prompt: song.prompt,
      instrumental: song.instrumental === 1,
      model: 'V5',
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
      /* next poll surfaces */
    }
  };

  if (!loaded) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-[18px]"
            style={{ background: 'var(--surface)', animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div
        className="card flex h-72 flex-col items-center justify-center gap-2 border-dashed text-center"
        style={{ background: 'transparent' }}
      >
        <p className="font-medium">คลังเพลงว่างอยู่</p>
        <p className="max-w-xs text-sm" style={{ color: 'var(--text-2)' }}>
          เขียน Lyrics + Style ทางซ้าย แล้วกด Create song เพื่อสร้างเพลงแรก
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {songs.map((song, i) => {
        const playable = song.status === 'SUCCESS' && songAudioUrl(song) !== null;
        const isActive = activeSong?.id === song.id;
        const nowPlaying = isActive && isPlaying;

        return (
          <article
            key={song.id}
            onClick={() => playable && onPlay(song)}
            role={playable ? 'button' : undefined}
            tabIndex={playable ? 0 : undefined}
            onKeyDown={(e) => {
              if (playable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onPlay(song);
              }
            }}
            className={`rise-in ${playable ? 'card card-hover cursor-pointer' : 'card'}`}
            style={{
              borderColor: isActive ? 'var(--accent)' : undefined,
              animationDelay: `${Math.min(i * 50, 300)}ms`,
              padding: '18px',
            }}
          >
            {/* top row: artwork chip + play state */}
            <div className="mb-4 flex items-start justify-between">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'var(--surface-2)' }}
              >
                {nowPlaying ? (
                  <EqBars />
                ) : playable ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--text)" className="ml-0.5">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : song.status === 'PENDING' ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="var(--border-strong)" strokeWidth="3" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="var(--text-2)" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8">
                    <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                )}
              </div>

              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide"
                style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                V5
              </span>
            </div>

            {/* title + meta */}
            <h3 className="truncate font-medium leading-snug">{song.title || 'Untitled'}</h3>
            <p className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--text-2)' }}>
              {song.tags || song.style || '—'}
            </p>

            {/* footer row */}
            <div className="mt-4 flex items-center justify-between text-xs" style={{ color: 'var(--text-3)' }}>
              <span className="tabular-nums">{fmtDuration(song.duration)}</span>
              {song.status === 'FAILED' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void retry(song);
                  }}
                  className="cursor-pointer font-medium underline-offset-2 hover:underline"
                  style={{ color: 'var(--accent-text)' }}
                >
                  ลองใหม่
                </button>
              )}
            </div>

            {song.status === 'FAILED' && song.error && (
              <p className="mt-2 truncate text-xs" style={{ color: '#f87171' }} title={song.error}>
                {song.error}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
