import type { CSSProperties } from 'react';

type IconProps = { className?: string; style?: CSSProperties };

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const PlayIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const PauseIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden="true">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);

export const PrevIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden="true">
    <path d="M6 5h2v14H6zM20 5v14l-11-7z" />
  </svg>
);

export const NextIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden="true">
    <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
  </svg>
);

export const DownloadIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...stroke} aria-hidden="true">
    <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const SearchIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...stroke} aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const PlusIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...stroke} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CloseIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...stroke} aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const SpinnerIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const MusicIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...stroke} aria-hidden="true">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export const VolumeIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...stroke} aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6" />
  </svg>
);
