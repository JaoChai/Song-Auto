import { fmtDuration, songAudioUrl, type Song } from '../lib/api';
import { CoverArt } from './CoverArt';
import { DownloadIcon, PauseIcon, PlayIcon, SpinnerIcon } from './icons';

const elapsed = (iso: string): string => {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs} วินาที`;
  return `${Math.floor(secs / 60)} นาที`;
};

interface Props {
  song: Song;
  showVariant: boolean;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (song: Song) => void;
  onRetry: (song: Song) => void;
}

export function SongCard({ song, showVariant, isActive, isPlaying, onPlay, onRetry }: Props) {
  const success = song.status === 'SUCCESS';
  const audioUrl = success ? songAudioUrl(song) : null;
  const playable = audioUrl !== null;
  const pending = song.status === 'PENDING';

  return (
    <article className="group flex flex-col gap-3">
      <div
        onClick={() => playable && onPlay(song)}
        role={playable ? 'button' : undefined}
        tabIndex={playable ? 0 : undefined}
        aria-label={playable ? `เล่น ${song.title || 'Untitled'}` : undefined}
        onKeyDown={(e) => {
          // ignore key events bubbling up from a focused child (the download link)
          // so its own Enter/Space activation isn't swallowed by the card's play toggle
          if (e.target !== e.currentTarget) return;
          if (playable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onPlay(song);
          }
        }}
        className={`relative aspect-square overflow-hidden rounded-2xl ${playable ? 'cursor-pointer' : ''}`}
        style={{
          color: 'var(--text-3)',
          boxShadow: isActive ? '0 0 0 2px var(--accent)' : undefined,
        }}
      >
        <CoverArt song={song} />

        {showVariant && (
          <span className="variant-badge" aria-label={`เวอร์ชัน ${song.variant}`}>v{song.variant}</span>
        )}

        {pending && <div className="shimmer absolute inset-0" />}

        {/* hover/active overlay */}
        {playable && (
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'var(--accent)', color: '#052e12' }}
            >
              {isActive && isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
            </span>
          </div>
        )}

        {pending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <SpinnerIcon className="h-5 w-5 animate-spin" style={{ color: 'var(--text-2)' }} />
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>
              กำลังสร้าง · {elapsed(song.createdAt)}
            </span>
          </div>
        )}

        {audioUrl && (
          <a
            href={audioUrl}
            download={`${song.title || 'song'}.mp3`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`ดาวน์โหลด ${song.title || 'Untitled'}`}
            className="icon-btn absolute right-1.5 top-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
            style={{ background: 'rgba(0,0,0,0.55)', color: 'var(--text)' }}
          >
            <DownloadIcon className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium" style={{ color: isActive ? 'var(--accent-text)' : undefined }}>
          {song.title || 'Untitled'}
        </h3>
        <p className="mt-0.5 flex items-center gap-2 truncate text-xs" style={{ color: 'var(--text-3)' }}>
          <span className="truncate">{song.tags || song.style || '—'}</span>
          {success && <span className="tabular-nums">{fmtDuration(song.duration)}</span>}
        </p>
        {song.status === 'FAILED' && (
          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-xs" style={{ color: '#f87171' }} title={song.error ?? ''}>
              {song.error || 'สร้างไม่สำเร็จ'}
            </span>
            <button
              type="button"
              onClick={() => onRetry(song)}
              className="shrink-0 cursor-pointer text-xs font-medium underline-offset-2 hover:underline"
              style={{ color: 'var(--accent-text)' }}
            >
              ลองใหม่
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
