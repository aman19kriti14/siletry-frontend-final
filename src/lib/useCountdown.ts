import { useEffect, useState } from 'react';

/** Seconds left, counting down to 0. Call reset(n) to start again. */
export function useCountdown(initial: number) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, reset: setLeft, label: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` };
}
