import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

/**
 * GET a path and keep it in state. Pass null to skip.
 * `reload()` refetches; `pollMs` refetches in the background.
 */
export function useFetch<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const current = useRef(path);
  current.current = path;

  const load = useCallback(
    async (silent = false) => {
      if (!path) return;
      if (!silent) setLoading(true);
      try {
        const d = await api.get<T>(path);
        if (current.current === path) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (current.current === path) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (current.current === path) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!opts.pollMs || !path) return;
    const t = setInterval(() => load(true), opts.pollMs);
    return () => clearInterval(t);
  }, [load, opts.pollMs, path]);

  return { data, error, loading, reload: () => load(true), setData };
}
