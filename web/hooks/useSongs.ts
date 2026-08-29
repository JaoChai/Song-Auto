import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Song } from '../lib/api';

const POLL_INTERVAL_MS = 10_000;

/** Library state + sequential polling for PENDING songs (respects kie 3 req/s/task limit). */
export function useSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [authNeeded, setAuthNeeded] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const body = await api<{ songs: Song[] }>('/api/songs');
      setSongs(body.songs);
      setAuthNeeded(false);
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 401) {
        setAuthNeeded(true);
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  /** Poll ONE pending song; apply result. Returns true when a poll happened. */
  const pollOnePending = useCallback(async (): Promise<boolean> => {
    let polled = false;
    setSongs((current) => {
      const target = current.find((s) => s.status === 'PENDING');
      if (!target) return current;
      polled = true;
      void api<{ status: string; song?: Song }>('/api/tasks/' + target.id)
        .then((res) => {
          // the server collapsed this row (the task produced fewer tracks, or failed)
          if (res.status === 'GONE') {
            setSongs((prev) => prev.filter((s) => s.id !== target.id));
            return;
          }
          if (res.song || res.status !== 'PENDING') {
            setSongs((prev) =>
              res.song
                ? prev.map((s) => (s.id === res.song!.id ? res.song! : s))
                : prev.map((s) =>
                    s.id === target.id ? { ...s, status: res.status as Song['status'], error: null } : s,
                  ),
            );
          }
        })
        .catch(() => {
          /* transient — next tick retries */
        });
      return current;
    });
    return polled;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const hasPending = songs.some((s) => s.status === 'PENDING');
    if (hasPending && pollingRef.current === null) {
      pollingRef.current = setInterval(() => {
        void pollOnePending();
      }, POLL_INTERVAL_MS);
    } else if (!hasPending && pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [songs, pollOnePending]);

  useEffect(
    () => () => {
      if (pollingRef.current !== null) clearInterval(pollingRef.current);
    },
    [],
  );

  /** Insert/replace song rows (used by CreatePanel, retry, and poll results). */
  const upsert = useCallback((incoming: Song | Song[]) => {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    setSongs((prev) => {
      const next = [...prev];
      // walk backwards so a batch of new songs keeps its given order at the top
      for (let i = list.length - 1; i >= 0; i--) {
        const song = list[i];
        const idx = next.findIndex((s) => s.id === song.id);
        if (idx >= 0) next[idx] = song;
        else next.unshift(song);
      }
      return next;
    });
  }, []);

  /** Drop a song row that no longer exists on the server. */
  const remove = useCallback((id: string) => {
    setSongs((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { songs, loaded, authNeeded, refresh, upsert, remove };
}
