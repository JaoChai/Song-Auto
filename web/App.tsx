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

  // autoplay when the active song finishes generating
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

      {/* header */}
      <header className="mx-auto flex h-16 w-full max-w-6xl shrink-0 items-center justify-between px-4 md:px-6">
        <span className="text-[15px] font-semibold tracking-tight">
          Song<span style={{ color: 'var(--accent)' }}>-</span>Auto
        </span>
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
          {songs.length} เพลง
        </span>
      </header>

      {/* bento split */}
      <div className="mx-auto flex w-full min-h-0 max-w-6xl flex-1 gap-5 px-4 pb-5 md:px-6">
        <aside className="w-full shrink-0 md:w-[380px]">
          <CreatePanel
            onCreated={(song) => {
              upsert(song);
              setActive(song);
              wasPending.current = true;
            }}
          />
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto pr-1">
          <h2 className="mb-4 text-[13px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
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
