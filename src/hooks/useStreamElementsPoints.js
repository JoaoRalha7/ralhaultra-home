import { useCallback, useEffect, useState } from 'react';

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev';

// Reads the viewer's points from the ralha-points worker (response shape is a best guess).
export function useStreamElementsPoints(username) {
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!username) {
      setPoints(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${SE_WORKER_URL}?username=${encodeURIComponent(username.toLowerCase())}`);
      if (res.ok) {
        const d = await res.json();
        const n = Number(d?.points ?? d?.data?.points ?? d?.user?.points);
        if (Number.isFinite(n)) setPoints(n);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { points, setPoints, loading, refresh };
}
