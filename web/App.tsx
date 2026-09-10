import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { AuthGate } from './components/AuthGate';
import { CreatePanel } from './components/CreatePanel';
import { LibraryGrid } from './components/LibraryGrid';
import { PlayerBar } from './components/PlayerBar';
import { SongDetail } from './components/SongDetail';
import { Toast } from './components/Toast';
import { api, songAudioUrl, type Persona, type Song } from './lib/api';
import { filterSongs } from './lib/filter';
import { useSongs } from './hooks/useSongs';
import { usePersonas } from './hooks/usePersonas';

export default function App() {
  const { songs, loaded, authNeeded, refresh, upsert, remove } = useSongs();
  const { personas, loaded: personasLoaded, refresh: refreshPersonas, add: addPersona } = usePersonas();
  const [query, setQuery] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasPending = useRef(false);

  // the song list the transport walks — what the user can actually see
  const visible = useMemo(() => filterSongs(songs, query), [songs, query]);
  const active = activeId ? songs.find((s) => s.id === activeId) ?? null : null;
  const detail = detailId ? songs.find((s) => s.id === detailId) ?? null : null;

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
    return <AuthGate onAuthed={() => { void refresh(); void refreshPersonas(); }} />;
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

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ① ซ้าย = สิ่งที่เราป้อน */}
        <aside className="create-rail">
          <CreatePanel
            personas={personas}
            personasLoaded={personasLoaded}
            onCreated={(created) => {
              upsert(created);
              setActiveId(created[0].id);
              wasPending.current = true;
              setToast('เริ่มสร้างเพลงแล้ว — จะขึ้นในคลังเมื่อเสร็จ');
            }}
          />
        </aside>

        {/* ② ขวา = สิ่งที่ได้กลับมา · ③ รายละเอียดทับเข้ามาจากขอบขวา */}
        <main className="library-main">
          {/* เลื่อนแยกจากกล่องที่แผงรายละเอียดอิง — ไม่งั้นแผง (absolute) จะเลื่อนหายไปกับ grid ด้วย */}
          <div className="library-scroll">
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
              onOpenDetail={(s) => setDetailId(s.id)}
            />
          </div>

          {detail && (
            <>
              <div className="detail-scrim" onClick={() => setDetailId(null)} aria-hidden="true" />
              <div className="detail-layer rise-in">
                <SongDetail
                  key={detail.id}
                  song={detail}
                  parent={songs.find((s) => s.id === detail.parentSongId) ?? null}
                  personaName={personas.find((p) => p.songId === detail.id)?.name ?? null}
                  onClose={() => setDetailId(null)}
                  onSelectSong={(id) => setDetailId(id)}
                  onExtended={(created) => {
                    upsert(created);
                    setDetailId(null);
                    setToast('เริ่มต่อเพลงแล้ว — จะขึ้นในคลังเมื่อเสร็จ');
                  }}
                  onCreatePersona={async (song, input) => {
                    const out = await api<{ persona: Persona }>('/api/personas', {
                      method: 'POST',
                      body: JSON.stringify({ songId: song.id, ...input }),
                    });
                    addPersona(out.persona);
                    setToast(`เพิ่ม persona “${out.persona.name}” แล้ว`);
                  }}
                />
              </div>
            </>
          )}
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
