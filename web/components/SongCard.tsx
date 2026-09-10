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
  onOpenDetail: (song: Song) => void;
}

export function SongCard({ song, showVariant, isActive, isPlaying, onPlay, onRetry, onOpenDetail }: Props) {
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
          color: 'var(--ink-3)',
          boxShadow: isActive ? '0 0 0 2px var(--grape)' : undefined,
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
            style={{ background: 'rgba(23,18,43,0.5)' }}
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'var(--grape)', color: '#ffffff' }}
            >
              {isActive && isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
            </span>
          </div>
        )}

        {pending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <SpinnerIcon className="h-5 w-5 animate-spin" style={{ color: 'var(--ink-2)' }} />
            <span className="text-xs" style={{ color: 'var(--ink-2)' }}>
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
            style={{ background: 'rgba(23,18,43,0.62)', color: '#ffffff' }}
          >
            <DownloadIcon className="h-4 w-4" />
          </a>
        )}

      </div>

      <div className="min-w-0">
        <button
          type="button"
          className="card-title-btn"
          onClick={() => onOpenDetail(song)}
          style={{ color: isActive ? 'var(--grape-text)' : undefined }}
        >
          {song.title || <span style={{ color: 'var(--ink-3)' }}>ยังไม่ได้ตั้งชื่อ</span>}
        </button>
        {/* คำบรรยายจาก Suno ยาวได้ถึง 420 ตัวอักษร บรรทัดเดียวแล้วไม่เหลือความหมาย */}
        <p className="card-meta">
          {song.tags || song.style || '—'}
        </p>
        <p className="card-sub">
          {success && <span className="tabular-nums">{fmtDuration(song.duration)}</span>}
          {song.parentSongId && <span className="card-chip">ต่อ</span>}
        </p>
        {song.status === 'FAILED' && (
          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-xs" style={{ color: 'var(--danger)' }} title={song.error ?? ''}>
              {song.error || 'สร้างไม่สำเร็จ'}
            </span>
            <button
              type="button"
              onClick={() => onRetry(song)}
              className="shrink-0 cursor-pointer text-xs font-medium underline-offset-2 hover:underline"
              style={{ color: 'var(--grape-text)' }}
            >
              ลองใหม่
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
