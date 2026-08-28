import { useEffect, useState, type RefObject } from 'react';
import { fmtDuration, songAudioUrl, type Song } from '../lib/api';
import { CoverArt } from './CoverArt';
import { DownloadIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, VolumeIcon } from './icons';

const rangeTrack =
  'h-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white';

interface Props {
  song: Song | null;
  isPlaying: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function PlayerBar({ song, isPlaying, audioRef, onPrev, onNext, hasPrev, hasNext }: Props) {
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [volume, setVolume] = useState(100);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrent(el.currentTime);
      setTotal(Number.isFinite(el.duration) ? el.duration : 0);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onTime);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onTime);
    };
  }, [audioRef]);

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

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v / 100;
  };

  const progress = total > 0 ? (current / total) * 100 : 0;
  const audioUrl = song?.status === 'SUCCESS' ? songAudioUrl(song) : null;

  return (
    <footer
      className="sticky bottom-0 z-30 border-t"
      style={{ background: 'rgba(13,13,15,0.9)', backdropFilter: 'blur(16px)', borderColor: 'var(--border)' }}
      aria-label="เครื่องเล่นเพลง"
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-3 px-4 md:gap-4 md:px-6">
        {/* artwork + meta */}
        <div className="flex min-w-0 items-center gap-3" style={{ width: 220 }}>
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
            {song && <CoverArt song={song} />}
          </div>
          <div className="min-w-0">
            <p className={`truncate text-sm font-medium ${song ? '' : 'opacity-35'}`}>
              {song?.title ?? 'ไม่มีเพลงที่เลือก'}
            </p>
            <p className="truncate text-xs" style={{ color: 'var(--text-3)' }}>
              {song?.tags || song?.style || '—'}
            </p>
          </div>
        </div>

        {/* transport */}
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onPrev} disabled={!hasPrev} className="icon-btn" aria-label="เพลงก่อนหน้า">
            <PrevIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={!song}
            aria-label={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
            style={{ background: 'var(--accent)', color: '#052e12' }}
          >
            {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
          </button>
          <button type="button" onClick={onNext} disabled={!hasNext} className="icon-btn" aria-label="เพลงถัดไป">
            <NextIcon className="h-4 w-4" />
          </button>
        </div>

        {/* seek */}
        <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
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
            className={`${rangeTrack} w-full disabled:cursor-not-allowed [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3`}
            style={{ background: `linear-gradient(to right,var(--accent) ${progress}%, var(--surface-hover) 0)` }}
          />
          <span className="w-9 text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {fmtDuration(total || (song?.duration ?? null))}
          </span>
        </div>

        {/* volume + download */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <div className="hidden items-center gap-2 md:flex">
            <VolumeIcon className="h-4 w-4" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={changeVolume}
              aria-label="ระดับเสียง"
              className={`${rangeTrack} w-20 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5`}
              style={{ background: `linear-gradient(to right,var(--text-2) ${volume}%, var(--surface-hover) 0)` }}
            />
          </div>
          {audioUrl ? (
            <a href={audioUrl} download={`${song?.title || 'song'}.mp3`} className="icon-btn" aria-label="ดาวน์โหลดเพลงนี้">
              <DownloadIcon className="h-4 w-4" />
            </a>
          ) : (
            <span className="icon-btn opacity-30" aria-hidden="true">
              <DownloadIcon className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      {/* mobile progress hairline */}
      <div className="h-0.5 w-full sm:hidden" style={{ background: 'var(--surface-hover)' }}>
        <div className="h-full" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
      </div>
    </footer>
  );
}
