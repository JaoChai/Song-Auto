import { useState, type RefObject } from 'react';
import { fmtDuration, type Song } from '../lib/api';

interface Props {
  song: Song | null;
  audioRef: RefObject<HTMLAudioElement | null>;
}

export function PlayerBar({ song, audioRef }: Props) {
  const [playing, setPlaying] = useState(false);
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

  return (
    <footer
      className="sticky bottom-0 flex h-[72px] items-center gap-4 border-t px-4 md:px-6"
      style={{ background: 'var(--color-primary)', borderColor: 'var(--color-border)' }}
      aria-label="เครื่องเล่นเพลง"
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!song}
        aria-label={playing ? 'หยุดชั่วคราว' : 'เล่น'}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: 'var(--color-accent)' }}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#0f172a">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#0f172a">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${song ? '' : 'opacity-40'}`}>{song?.title ?? 'ไม่มีเพลงที่เลือก'}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="w-10 text-right text-xs tabular-nums" style={{ color: '#94a3b8' }}>
            {fmtDuration(current)}
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={total > 0 ? Math.round((current / total) * 1000) : 0}
            onChange={seek}
            disabled={!song || !total}
            aria-label="ตำแหน่งเพลง"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed"
            style={{ background: `linear-gradient(to right, var(--color-accent) ${total ? (current / total) * 100 : 0}%, var(--color-border) 0)` }}
          />
          <span className="w-10 text-xs tabular-nums" style={{ color: '#94a3b8' }}>
            {fmtDuration(song?.duration ?? total ?? null)}
          </span>
        </div>
      </div>

      {/* hidden audio element lives in App; events mirrored here via props */}
      <AudioEvents audioRef={audioRef} onPlaying={(p) => setPlaying(p)} onTime={(t, d) => { setCurrent(t); setTotal(d); }} />
    </footer>
  );
}

/** Invisible component wiring audio element events into player state. */
function AudioEvents({
  audioRef,
  onPlaying,
  onTime,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  onPlaying: (playing: boolean) => void;
  onTime: (current: number, total: number) => void;
}) {
  const el = audioRef.current;
  if (el) {
    el.onplay = () => onPlaying(true);
    el.onpause = () => onPlaying(false);
    el.ontimeupdate = () => onTime(el.currentTime, Number.isFinite(el.duration) ? el.duration : 0);
  }
  return null;
}
