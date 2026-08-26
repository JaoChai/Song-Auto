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
    <footer className="glass sticky bottom-0 z-10 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }} aria-label="เครื่องเล่นเพลง">
      {/* progress line on top edge */}
      <div className="h-[3px] w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full transition-[width] duration-150"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7c3aed,#6366f1)' }}
        />
      </div>

      <div className="mx-auto flex h-[76px] max-w-6xl items-center gap-4 px-4 md:px-6">
        {/* play button */}
        <button
          type="button"
          onClick={toggle}
          disabled={!song}
          aria-label={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
          className="pressable flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-[0_6px_24px_rgba(124,58,237,0.45)] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" className="ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* title + times */}
        <div className="w-40 shrink-0 md:w-56">
          <p className={`truncate text-sm font-medium ${song ? '' : 'opacity-40'}`}>
            {song?.title ?? 'ไม่มีเพลงที่เลือก'}
          </p>
          <p className="truncate text-xs" style={{ color: 'var(--color-text-dim)' }}>
            {song?.tags || song?.style || '—'}
          </p>
        </div>

        {/* seek */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="w-10 text-right text-xs tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
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
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
            style={{ background: `linear-gradient(to right,#7c3aed ${progress}%, rgba(255,255,255,0.1) 0)` }}
          />
          <span className="w-10 text-xs tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
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
