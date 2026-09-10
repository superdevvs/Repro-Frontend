import { useCallback, useEffect, useState } from 'react';
import { trackPageView } from '@/lib/tourTracking';
import { resolvePublicTourVariantFromPath, type PublicTourVariant } from './publicIguideModel';
import { buildPublicTourEndpoint, normalizePublicTourData, type PublicTourData } from './publicTourData';

export interface UsePublicTourDataOptions {
  variant?: PublicTourVariant;
  search?: string;
  /** Public response payload for previews; no request or analytics is made in this mode. */
  initialData?: unknown;
}

export async function loadPublicTourData(
  endpoint: string,
  variant: PublicTourVariant,
  signal?: AbortSignal,
): Promise<PublicTourData> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const response = await fetch(`${endpoint}${separator}t=${Date.now()}`, {
    signal, cache: 'no-store', headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error('This property tour could not be found.');
    throw new Error('The property tour could not be loaded. Please try again.');
  }
  return normalizePublicTourData(await response.json(), variant);
}

export function usePublicTourData(options: UsePublicTourDataOptions = {}) {
  const variant = options.variant ?? resolvePublicTourVariantFromPath(window.location.pathname);
  const search = options.search ?? window.location.search;
  const initialData = options.initialData;
  const [data, setData] = useState<PublicTourData | null>(() => initialData !== undefined
    ? normalizePublicTourData(initialData, variant) : null);
  const [loading, setLoading] = useState(initialData === undefined);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (initialData !== undefined) {
      setData(normalizePublicTourData(initialData, variant));
      setLoading(false);
      setError(null);
      return;
    }
    const endpoint = buildPublicTourEndpoint(search, variant);
    setError(null);
    if (!endpoint) {
      setData(normalizePublicTourData({}, variant));
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    void loadPublicTourData(endpoint, variant, controller.signal).then((nextData) => {
      if (controller.signal.aborted) return;
      setData(nextData);
      if (!nextData.locked && !nextData.empty && nextData.analytics.shootId !== null) {
        // Storage may be disabled. Analytics must not turn a successful load into an error.
        try { trackPageView(nextData.analytics.shootId, nextData.analytics.tourType); } catch { /* best effort */ }
      }
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'The property tour could not be loaded. Please try again.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [variant, search, initialData, revision]);

  return { data, loading, error, reload };
}
