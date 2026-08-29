import { SearchIcon } from './icons';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
}

export function AppHeader({ query, onQueryChange }: Props) {
  return (
    <header
      className="sticky top-0 z-20 shrink-0"
      style={{ background: 'rgba(13,13,15,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex h-14 w-full items-center gap-3 px-4 md:gap-5 md:px-6">
        <span className="shrink-0 text-[15px] font-semibold tracking-tight">
          Song<span style={{ color: 'var(--accent)' }}>-</span>Auto
        </span>

        <div className="relative min-w-0 flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--text-3)' }}
          />
          <label htmlFor="search" className="sr-only">ค้นหาเพลง</label>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="ค้นหาเพลง…"
            className="input"
            style={{ paddingLeft: 38, minHeight: 40 }}
          />
        </div>
      </div>
    </header>
  );
}
