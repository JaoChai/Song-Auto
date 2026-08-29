import { useCallback, useEffect, useState } from 'react';
import { api, type Persona } from '../lib/api';

/** Persona list — loaded once; new ones are appended locally, so no refetch. */
export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  // false until the initial fetch settles — lets callers avoid acting on an
  // empty list that's merely still loading (vs. genuinely empty)
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void api<{ personas: Persona[] }>('/api/personas')
      .then((res) => setPersonas(res.personas))
      .catch(() => {
        // an unauthenticated load is already handled by useSongs' AuthGate;
        // any other failure just means the picker stays empty this session
      })
      .finally(() => setLoaded(true));
  }, []);

  const add = useCallback((persona: Persona) => {
    setPersonas((prev) => [persona, ...prev]);
  }, []);

  return { personas, loaded, add };
}
