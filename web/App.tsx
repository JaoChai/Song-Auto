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
  const [active, setActive] = useState<Song | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // when a PENDING song finishes (r2Key appears) and it was the active one, autoplay
  useEffect(() => {
    if (!active) return;
    const fresh = songs.find((s) => s.id === active.id);
    if (fresh?.status === 'SUCCESS' && fresh.r2Key && !active.r2Key) {
      setActive(fresh);
      void refresh();
    }
  }, [songs, active, refresh]);

  const play = (song: Song) => {
    const url = songAudioUrl(song);
    if (!url || !audioRef.current) return;
    audioRef.current.src = url;
    setActive(song);
    void audioRef.current.play();
  };

  if (!authed || authNeeded) {
    return (
      <AuthGate
        onAuthed={() => {
          setAuthed(true);
          void refresh();
        }}
      >
        <AppInner />
      </AuthGate>
    );
  }

  return <AppInner />;
}

function AppInner() {
  const { songs, loaded, authNeeded, refresh, upsert } = useSongs();
  const [active, setActive] = useState<Song | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // keep the active song object fresh after polls update the list
  const activeFresh = active ? songs.find((s) => s.id === active.id) ?? active : null;

  const play = (song: Song) => {
    const url = songAudioUrl(song);
    if (!url || !audioRef.current) return;
    audioRef.current.src = url;
    setActive(song);
    void audioRef.current.play();
  };

  if (authNeeded) {
    return (
      <AuthGate onAuthed={() => void refresh()}>
        <span />
      </AuthGate>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* hidden shared audio element */}
      <audio ref={audioRef} preload="none" />

      <div className="flex min-h-0 flex-1 gap-6 p-4 md:p-6">
        {/* left: create panel */}
        <aside className="w-full max-w-sm shrink-0 lg:w-[360px]">
          <CreatePanel
            onCreated={(song) => {
              upsert(song);
            }}
          />
        </aside>

        {/* right: library */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <h2 className="mb-4 text-lg font-semibold">คลังเพลง</h2>
          <LibraryGrid songs={songs} loaded={loaded} activeSong={activeFresh} onPlay={play} upsert={upsert} />
        </main>
      </div>

      <PlayerBar song={activeFresh} audioRef={audioRef} />
    </div>
  );
}
