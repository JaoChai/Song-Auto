import { useCallback, useEffect, useState } from 'react';
import { api, type Persona } from '../lib/api';

/** Persona list — fetched on mount and exposes `refresh` for callers (e.g. post-login) to retry; new ones are also appended locally, no refetch needed for those. */
export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  // true only once a fetch has actually succeeded — a failure (e.g. still
  // unauthenticated) leaves it false, so callers never mistake "we don't
  // know yet" for "confirmed empty" and wipe a personaId that might still
  // be valid once a retry succeeds
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    return api<{ personas: Persona[] }>('/api/personas')
      .then((res) => {
        setPersonas(res.personas);
        setLoaded(true);
      })
      .catch(() => {
        // an unauthenticated load is already handled by useSongs' AuthGate,
        // which calls refresh() again once login succeeds; any other
        // failure just means the picker stays empty this session
      });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback((persona: Persona) => {
    setPersonas((prev) => [persona, ...prev]);
  }, []);

  return { personas, loaded, refresh, add };
}
