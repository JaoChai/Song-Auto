import { api, fmtDuration, songAudioUrl, type GenerateBody, type Song } from '../lib/api';

interface Props {
  songs: Song[];
  loaded: boolean;
  activeSong: Song | null;
  isPlaying: boolean;
  onPlay: (song: Song) => void;
  upsert: (song: Song) => void;
}

function WaveBars({ playing }: { playing: boolean }) {
  return (
    <span className="inline-flex h-4 items-end gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            background: 'var(--color-accent)',
            height: playing ? undefined : '40%',
            animation: playing ? `wavebar 900ms ease-in-out ${i * 140}ms infinite alternate` : 'none',
          }}
        />
      ))}
      <style>{`@keyframes wavebar { from { height: 30% } to { height: 100% } }`}</style>
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
      /* error surfaces via next poll/refresh */
    }
  };

  if (!loaded) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-52 animate-pulse rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.04)', animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(99,102,241,0.15))' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8">
            <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <p className="font-medium">ยังไม่มีเพลงในคลัง</p>
        <p className="max-w-xs text-sm" style={{ color: 'var(--color-text-dim)' }}>
          เขียนเนื้อร้องและเลือกสไตล์จากแผงด้านซ้าย แล้วกด Create song
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
            className={`rise-in pressable group relative overflow-hidden rounded-2xl border ${playable ? 'cursor-pointer' : ''}`}
            style={{
              background: 'var(--color-surface)',
              borderColor: isActive ? 'rgba(124,58,237,0.55)' : 'rgba(255,255,255,0.08)',
              boxShadow: isActive ? '0 0 0 1px rgba(124,58,237,0.35), 0 12px 40px rgba(124,58,237,0.18)' : 'none',
              animationDelay: `${Math.min(i * 60, 360)}ms`,
            }}
          >
            {/* cover art area */}
            <div className="relative h-36 overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(124,58,237,0.45) 0%, rgba(99,102,241,0.28) 50%, rgba(10,10,20,0.9) 100%)',
                }}
              />
              {/* subtle texture rings */}
              <svg className="absolute -right-6 -top-6 opacity-25" width="120" height="120" viewBox="0 0 100 100" fill="none">
                {[20, 32, 44].map((r) => (
                  <circle key={r} cx="50" cy="50" r={r} stroke="white" strokeOpacity="0.35" strokeWidth="0.75" />
                ))}
              </svg>

              {/* play overlay */}
              {playable && (
                <span
                  className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full shadow-xl transition-transform duration-200 group-hover:scale-105"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}
                >
                  {nowPlaying ? (
                    <WaveBars playing />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </span>
              )}

              {/* status badge */}
              {song.status !== 'SUCCESS' && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur"
                  style={
                    song.status === 'PENDING'
                      ? { background: 'rgba(124,58,237,0.35)', color: '#e9d5ff' }
                      : { background: 'rgba(220,38,38,0.3)', color: '#fecaca' }
                  }>
                  {song.status === 'PENDING' && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c4b5fd]" />
                  )}
                  {song.status === 'PENDING' ? 'กำลังสร้าง…' : 'ล้มเหลว'}
                </span>
              )}
            </div>

            {/* meta */}
            <div className="p-4">
              <h3 className="truncate font-semibold leading-tight">{song.title || 'Untitled'}</h3>
              <p className="mt-1 truncate text-[13px]" style={{ color: 'var(--color-text-dim)' }}>
                {song.tags || song.style || 'V5'}
              </p>

              <div className="mt-3 flex items-center justify-between text-xs" style={{ color: 'var(--color-text-dim)' }}>
                <span className="tabular-nums">{fmtDuration(song.duration)}</span>
                <div className="flex items-center gap-3">
                  {song.model === 'V5' && (
                    <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide" style={{ borderColor: 'rgba(255,255,255,0.14)', color: '#a78bfa' }}>
                      V5
                    </span>
                  )}
                  {song.status === 'FAILED' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void retry(song);
                      }}
                      className="cursor-pointer font-medium underline-offset-2 hover:underline"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      ลองใหม่
                    </button>
                  )}
                </div>
              </div>

              {song.status === 'FAILED' && song.error && (
                <p className="mt-2 truncate text-xs" style={{ color: '#f87171' }} title={song.error}>
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
