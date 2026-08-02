import { useEffect, useState } from 'react';

/**
 * Tracks the user's `prefers-reduced-motion` setting
 * (ai-editing-studio-revamp, task 16.1 — Req 11.9).
 *
 * Returns `true` while the reduce preference is active, and stays in sync when
 * the preference changes mid-session. Safe to call in environments without
 * `matchMedia` (jsdom without a stub, SSR) — it reports `false` there.
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function readPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(readPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(event.matches);
    };

    handleChange(query);

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }

    // Safari < 14 and older jsdom builds only expose the deprecated API.
    query.addListener(handleChange);
    return () => query.removeListener(handleChange);
  }, []);

  return prefersReducedMotion;
}

export default useReducedMotion;
