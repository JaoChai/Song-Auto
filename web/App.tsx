import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { AuthGate } from './components/AuthGate';
import { CreatePanel } from './components/CreatePanel';
import { LibraryGrid } from './components/LibraryGrid';
import { PlayerBar } from './components/PlayerBar';
import { Toast } from './components/Toast';
import { songAudioUrl, type Song } from './lib/api';
import { filterSongs } from './lib/filter';
import { useSongs } from './hooks/useSongs';

export default function App() {
  const { songs, loaded, authNeeded, refresh, upsert, remove } = useSongs();
  const [query, setQuery] = useState('');
  // only meaningful under 768px — both panels are visible side by side above it
  const [tab, setTab] = useState<'create' | 'library'>('library');
  const [toast, setToast] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasPending = useRef(false);

  // the song list the transport walks — what the user can actually see
  const visible = useMemo(() => filterSongs(songs, query), [songs, query]);
  const active = activeId ? songs.find((s) => s.id === activeId) ?? null : null;

  const play = useCallback((song: Song) => {
    const url = songAudioUrl(song);
    const el = audioRef.current;
    if (!url || !el) return;
    if (activeId === song.id && el.src.includes(song.r2Key!)) {
      if (el.paused) void el.play();
      else el.pause();
      return;
    }
    el.src = url;
    setActiveId(song.id);
    void el.play();
  }, [activeId]);

  // autoplay a song that was pending when the user selected it
  useEffect(() => {
    if (!active) return;
    if (active.status === 'PENDING') wasPending.current = true;
    if (wasPending.current && active.status === 'SUCCESS' && audioRef.current) {
      wasPending.current = false;
      audioRef.current.src = songAudioUrl(active)!;
      void audioRef.current.play();
    }
  }, [active]);

  const index = active ? visible.findIndex((s) => s.id === active.id) : -1;
  const playableAt = (i: number): Song | null => {
    const s = visible[i];
    return s && s.status === 'SUCCESS' && songAudioUrl(s) ? s : null;
  };
  const prev = index > 0 ? playableAt(index - 1) : null;
  const next = index >= 0 && index < visible.length - 1 ? playableAt(index + 1) : null;

  if (loaded && authNeeded) {
    return <AuthGate onAuthed={() => void refresh()} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (next) play(next);
        }}
      />

      <AppHeader query={query} onQueryChange={setQuery} />

      {/* narrow screens can't show both panels — switch between them */}
      <div className="seg">
        <button type="button" className="seg-btn" aria-pressed={tab === 'create'} onClick={() => setTab('create')}>
          สร้าง
        </button>
        <button type="button" className="seg-btn" aria-pressed={tab === 'library'} onClick={() => setTab('library')}>
          คลัง
        </button>
      </div>

      {/* both panels stay mounted: switching tabs must not throw away form state */}
      <div className="flex min-h-0 flex-1 md:flex-row">
        <aside
          className={`aside-divider ${tab === 'create' ? 'flex' : 'hidden'} min-h-0 w-full flex-col overflow-y-auto md:flex md:w-[380px] md:shrink-0`}
        >
          <CreatePanel
            onCreated={(created) => {
              upsert(created);
              setActiveId(created[0].id);
              wasPending.current = true;
              // on desktop the library is already in view; on mobile show the new cards
              setTab('library');
              setToast('เริ่มสร้างเพลงแล้ว — จะขึ้นในคลังเมื่อเสร็จ');
            }}
          />
        </aside>

        <main className={`${tab === 'library' ? 'block' : 'hidden'} min-h-0 w-full flex-1 overflow-y-auto px-4 py-6 md:block md:px-6 md:py-8`}>
          <LibraryGrid
            songs={songs}
            loaded={loaded}
            query={query}
            activeSong={active}
            isPlaying={isPlaying}
            onPlay={play}
            upsert={upsert}
            remove={remove}
            onRetryFailed={setToast}
          />
        </main>
      </div>

      <PlayerBar
        song={active}
        isPlaying={isPlaying}
        audioRef={audioRef}
        onPrev={() => prev && play(prev)}
        onNext={() => next && play(next)}
        hasPrev={Boolean(prev)}
        hasNext={Boolean(next)}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
