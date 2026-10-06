import { useEffect, useRef, useState } from 'react';
import type { ShootData } from '@/types/shoots';
import {
  searchShoots,
  shouldRequestShootSearch,
  SHOOT_SEARCH_DEBOUNCE_MS,
  SHOOT_SEARCH_DEFAULT_PER_PAGE,
} from '@/services/shootSearch';

export type UseShootSearchOptions = {
  /** Raw search input (debounce + trim applied inside). */
  query: string;
  /** When false, clears results and does not schedule requests. */
  enabled?: boolean;
  debounceMs?: number;
  perPage?: number;
};

export type UseShootSearchResult = {
  shoots: ShootData[];
  count: number;
  isLoading: boolean;
  error: Error | null;
  /** True once a non-empty query has settled and a response (or cleared empty) applied. */
  hasResolved: boolean;
};

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name;
  const code = (error as { code?: string }).code;
  return name === 'AbortError' || name === 'CanceledError' || code === 'ERR_CANCELED';
};

/**
 * Debounced shared shoot search for command-bar / find-across-shoots UX.
 * - Whitespace/empty: no API call; results cleared.
 * - AbortController + sequence so stale responses never overwrite newer queries.
 * - 200 + empty data → truthful empty (not an error).
 * - Transport/HTTP failures stay as errors.
 */
export function useShootSearch({
  query,
  enabled = true,
  debounceMs = SHOOT_SEARCH_DEBOUNCE_MS,
  perPage = SHOOT_SEARCH_DEFAULT_PER_PAGE,
}: UseShootSearchOptions): UseShootSearchResult {
  const [shoots, setShoots] = useState<ShootData[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasResolved, setHasResolved] = useState(false);

  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const shouldSearch = enabled && shouldRequestShootSearch(trimmed);

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (!shouldSearch) {
      seqRef.current += 1;
      setShoots([]);
      setCount(0);
      setError(null);
      setIsLoading(false);
      setHasResolved(false);
      return;
    }

    const seq = ++seqRef.current;
    setIsLoading(true);
    setError(null);
    setHasResolved(false);

    const timer = window.setTimeout(() => {
      // Re-check: another effect may have advanced the sequence.
      if (seq !== seqRef.current) return;

      const controller = new AbortController();
      abortRef.current = controller;

      void searchShoots({ search: trimmed, perPage, signal: controller.signal })
        .then((result) => {
          if (seq !== seqRef.current) return;
          setShoots(result.data);
          setCount(result.count);
          setError(null);
          setHasResolved(true);
        })
        .catch((err: unknown) => {
          if (seq !== seqRef.current) return;
          if (isAbortError(err)) return;
          setShoots([]);
          setCount(0);
          setError(err instanceof Error ? err : new Error(String(err)));
          setHasResolved(true);
        })
        .finally(() => {
          if (seq !== seqRef.current) return;
          setIsLoading(false);
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [query, enabled, debounceMs, perPage]);

  return { shoots, count, isLoading, error, hasResolved };
}
