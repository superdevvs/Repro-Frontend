import { withApiBase } from '@/config/env';

export type IpLocationCoords = {
  lat: number;
  lon: number;
  label?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

export const IP_LOCATION_CACHE_KEY = 'dashboard.ipLocation.v7';
export const IP_LOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** After a 429, skip further network lookups until this elapses (unless Retry-After is longer). */
export const IP_LOCATION_DEFAULT_BACKOFF_MS = 60_000;

type CacheRecord = IpLocationCoords & { ts: number };

let inFlight: Promise<IpLocationCoords | null> | null = null;
let backoffUntil = 0;

/** @internal test helper */
export const resetIpLocationClientState = () => {
  inFlight = null;
  backoffUntil = 0;
};

export const readCachedIpLocationCoords = (
  now = Date.now(),
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
): IpLocationCoords | null => {
  if (!storage) return null;
  const raw = storage.getItem(IP_LOCATION_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CacheRecord>;
    if (
      typeof parsed.lat === 'number'
      && typeof parsed.lon === 'number'
      && typeof parsed.ts === 'number'
      && now - parsed.ts < IP_LOCATION_CACHE_TTL_MS
    ) {
      return {
        lat: parsed.lat,
        lon: parsed.lon,
        label: typeof parsed.label === 'string' ? parsed.label : null,
        postalCode: typeof parsed.postalCode === 'string' ? parsed.postalCode : null,
        countryCode: typeof parsed.countryCode === 'string' ? parsed.countryCode : null,
      };
    }
  } catch {
    // ignore corrupt cache
  }
  return null;
};

export const writeCachedIpLocationCoords = (
  coords: IpLocationCoords,
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
  now = Date.now(),
) => {
  if (!storage) return;
  storage.setItem(IP_LOCATION_CACHE_KEY, JSON.stringify({ ...coords, ts: now }));
};

const parseRetryAfterMs = (header: string | null, now = Date.now()): number | null => {
  if (!header) return null;
  const asInt = Number(header);
  if (Number.isFinite(asInt) && asInt >= 0) {
    return Math.min(asInt * 1000, 15 * 60 * 1000);
  }
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    return Math.min(Math.max(asDate - now, 0), 15 * 60 * 1000);
  }
  return null;
};

const normalizeApiLocation = (data: Record<string, unknown>): IpLocationCoords | null => {
  const lat = typeof data.latitude === 'number' ? data.latitude
    : typeof data.lat === 'number' ? data.lat : null;
  const lon = typeof data.longitude === 'number' ? data.longitude
    : typeof data.lon === 'number' ? data.lon
      : typeof data.lng === 'number' ? data.lng : null;
  if (lat == null || lon == null) return null;

  const city = typeof data.city === 'string' ? data.city : null;
  const region = typeof data.region === 'string' ? data.region
    : typeof data.regionName === 'string' ? data.regionName : null;
  const labelParts = [city, region].filter((part): part is string => Boolean(part && part.trim()));
  const label = labelParts.length > 0
    ? labelParts.join(', ')
    : (typeof data.location === 'string' && data.location.trim() ? data.location.trim() : null);

  return {
    lat,
    lon,
    label,
    postalCode: typeof data.postalCode === 'string' ? data.postalCode : null,
    countryCode: typeof data.countryCode === 'string' ? data.countryCode : null,
  };
};

/**
 * Resolve browser weather coordinates via /api/ip-location.
 * - Fresh localStorage cache → no network
 * - In-flight dedupe across Navbar remounts / dual mounts
 * - 429 → circuit-break (Retry-After or 60s) so remounts cannot storm the edge
 */
export async function resolveIpLocation(options?: {
  signal?: AbortSignal;
  forceNetwork?: boolean;
  now?: number;
  fetchImpl?: typeof fetch;
}): Promise<IpLocationCoords | null> {
  const now = options?.now ?? Date.now();
  const cached = readCachedIpLocationCoords(now);
  if (cached && !options?.forceNetwork) {
    return cached;
  }

  if (!options?.forceNetwork && now < backoffUntil) {
    return cached;
  }

  if (inFlight) {
    return inFlight;
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  inFlight = (async () => {
    try {
      const response = await fetchImpl(withApiBase('/api/ip-location'), { signal: options?.signal });
      if (response.status === 429) {
        const retryMs = parseRetryAfterMs(response.headers.get('Retry-After'), now) ?? IP_LOCATION_DEFAULT_BACKOFF_MS;
        backoffUntil = now + retryMs;
        return cached;
      }
      if (!response.ok) {
        return cached;
      }
      const payload = await response.json();
      const data = payload?.data;
      if (!data || typeof data !== 'object') {
        return cached;
      }
      const coords = normalizeApiLocation(data as Record<string, unknown>);
      if (coords) {
        writeCachedIpLocationCoords(coords, undefined, now);
        backoffUntil = 0;
      }
      return coords ?? cached;
    } catch {
      return cached;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
