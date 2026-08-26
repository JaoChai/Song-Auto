import { useState, type RefObject } from 'react';
import { fmtDuration, type Song } from '../lib/api';

interface Props {
  song: Song | null;
  isPlaying: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
}

export function PlayerBar({ song, isPlaying, audioRef }: Props) {
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);

  const toggle = () => {
    const el = audioRef.current;
    if (!el || !song) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el || !total) return;
    const t = (Number(e.target.value) / 1000) * total;
    el.currentTime = t;
    setCurrent(t);
  };

  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <footer
      className="sticky bottom-0 z-10 border-t"
      style={{ background: 'rgba(13,13,15,0.85)', backdropFilter: 'blur(16px)', borderColor: 'var(--border)' }}
      aria-label="เครื่องเล่นเพลง"
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-4 px-4 md:px-6">
        <button
          type="button"
          onClick={toggle}
          disabled={!song}
          aria-label={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
          style={{ background: 'var(--accent)', color: '#052e12' }}
        >
          {isPlaying ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="w-40 shrink-0 md:w-52">
          <p className={`truncate text-sm font-medium ${song ? '' : 'opacity-35'}`}>
            {song?.title ?? 'ไม่มีเพลงที่เลือก'}
          </p>
          <p className="truncate text-xs" style={{ color: 'var(--text-3)' }}>
            {song?.tags || song?.style || '—'}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="w-9 text-right text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {fmtDuration(current)}
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 10)}
            onChange={seek}
            disabled={!song || !total}
            aria-label="ตำแหน่งเพลง"
            className="h-1 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            style={{ background: `linear-gradient(to right,var(--accent) ${progress}%, var(--surface-hover) 0)` }}
          />
          <span className="w-9 text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {fmtDuration(total || (song?.duration ?? null))}
          </span>
        </div>
      </div>

      <AudioEvents audioRef={audioRef} onTime={(t, d) => { setCurrent(t); setTotal(d); }} />
    </footer>
  );
}

function AudioEvents({
  audioRef,
  onTime,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  onTime: (current: number, total: number) => void;
}) {
  const el = audioRef.current;
  if (el) {
    el.ontimeupdate = () => onTime(el.currentTime, Number.isFinite(el.duration) ? el.duration : 0);
  }
  return null;
}
