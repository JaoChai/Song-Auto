import { useEffect, useRef, useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { CreatePanel } from './components/CreatePanel';
import { LibraryGrid } from './components/LibraryGrid';
import { PlayerBar } from './components/PlayerBar';
import { songAudioUrl, type Song } from './lib/api';
import { useSongs } from './hooks/useSongs';

export default function App() {
  const { songs, loaded, authNeeded, refresh, upsert } = useSongs();
  const [authed, setAuthed] = useState(false);

  if (!authed || authNeeded) {
    return (
      <AuthGate
        onAuthed={() => {
          setAuthed(true);
          void refresh();
        }}
      />
    );
  }

  return (
    <Studio songs={songs} loaded={loaded} authNeeded={authNeeded} refresh={refresh} upsert={upsert} />
  );
}

function Studio({
  songs,
  loaded,
  authNeeded,
  refresh,
  upsert,
}: {
  songs: Song[];
  loaded: boolean;
  authNeeded: boolean;
  refresh: () => Promise<void>;
  upsert: (song: Song) => void;
}) {
  const [active, setActive] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // keep active song object fresh after polls update the list; autoplay on completion
  const wasPending = useRef(false);
  const activeFresh = active ? songs.find((s) => s.id === active.id) ?? active : null;
  useEffect(() => {
    if (!activeFresh) return;
    if (activeFresh.status === 'PENDING') wasPending.current = true;
    if (wasPending.current && activeFresh.status === 'SUCCESS' && audioRef.current) {
      wasPending.current = false;
      audioRef.current.src = songAudioUrl(activeFresh)!;
      void audioRef.current.play();
    }
  }, [activeFresh]);

  const play = (song: Song) => {
    const url = songAudioUrl(song);
    if (!url || !audioRef.current) return;
    if (active?.id === song.id && audioRef.current.src.includes(song.r2Key!)) {
      // same track → just toggle
      if (audioRef.current.paused) void audioRef.current.play();
      else audioRef.current.pause();
      return;
    }
    audioRef.current.src = url;
    setActive(song);
    setIsPlaying(true);
    void audioRef.current.play();
  };

  if (authNeeded) {
    return <AuthGate onAuthed={() => void refresh()} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff">
              <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" stroke="#fff" strokeWidth="1.5" fill="none" />
              <circle cx="6" cy="18" r="3" fill="#fff" />
              <circle cx="18" cy="16" r="3" fill="#fff" />
            </svg>
          </div>
          <span className="font-semibold tracking-tight">Song-Auto</span>
          <span className="ml-1 rounded border px-1.5 py-0.5 text-[10px] font-medium" style={{ borderColor: 'rgba(255,255,255,0.14)', color: '#a78bfa' }}>
            V5
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
          {songs.length} เพลงในคลัง
        </span>
      </header>

      {/* main split */}
      <div className="mx-auto flex w-full min-h-0 max-w-7xl flex-1 gap-6 px-4 pb-4 md:px-6">
        {/* left: create */}
        <aside className="w-full shrink-0 md:w-[380px] lg:w-[420px]">
          <CreatePanel
            onCreated={(song) => {
              upsert(song);
              setActive(song);
              wasPending.current = true;
            }}
          />
        </aside>

        {/* right: library */}
        <main className="min-w-0 flex-1 overflow-y-auto pr-1">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
            Library
          </h2>
          <LibraryGrid
            songs={songs}
            loaded={loaded}
            activeSong={activeFresh}
            isPlaying={isPlaying}
            onPlay={play}
            upsert={upsert}
          />
        </main>
      </div>

      <PlayerBar song={activeFresh} isPlaying={isPlaying} audioRef={audioRef} />
    </div>
  );
}
