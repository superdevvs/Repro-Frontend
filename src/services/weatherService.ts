import { withApiBase } from '@/config/env';

type Coordinate = { latitude: number; longitude: number };

const RESULT_TTL = 10 * 60 * 1000;
const REQUEST_TIMEOUT = 8000;
// Cap concurrent /api/weather requests so weather never saturates the
// browser's HTTP/1.1 connection pool (6 per origin) and starve high-priority
// dashboard calls (events, insights, notifications, shoots).
const MAX_CONCURRENT_WEATHER_REQUESTS = 2;

const resultCache = new Map<string, { expiresAt: number; result: WeatherInfo | null }>();
const pendingRequests = new Map<string, Promise<WeatherInfo | null>>();

let inFlightCount = 0;
const waitQueue: Array<() => void> = [];

const acquireSlot = (): Promise<void> => {
  if (inFlightCount < MAX_CONCURRENT_WEATHER_REQUESTS) {
    inFlightCount += 1;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      inFlightCount += 1;
      resolve();
    });
  });
};

const releaseSlot = () => {
  inFlightCount = Math.max(0, inFlightCount - 1);
  const next = waitQueue.shift();
  if (next) {
    next();
  }
};

const sanitizeSegment = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeLocationKey = (value: string) => sanitizeSegment(value).toLowerCase();

const resolveTargetTimestamp = (dateTime?: string | null) => {
  if (!dateTime) return 'now';
  const parsed = new Date(dateTime).getTime();
  return Number.isNaN(parsed) ? 'now' : String(parsed);
};

const buildCacheKey = (params: {
  location?: string;
  coords?: Coordinate;
  dateTime?: string | null;
}) => {
  const target = resolveTargetTimestamp(params.dateTime);

  if (params.location) {
    return `location:${normalizeLocationKey(params.location)}|${target}`;
  }

  if (params.coords) {
    return `coords:${params.coords.latitude.toFixed(4)},${params.coords.longitude.toFixed(4)}|${target}`;
  }

  return `weather:${target}`;
};

const createAbortError = () => {
  try {
    return new DOMException('The operation was aborted.', 'AbortError');
  } catch {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
  }
};

const awaitWithAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => {
      reject(createAbortError());
    };

    signal.addEventListener('abort', handleAbort, { once: true });

    promise
      .then((value) => {
        signal.removeEventListener('abort', handleAbort);
        resolve(value);
      })
      .catch((error) => {
        signal.removeEventListener('abort', handleAbort);
        reject(error);
      });
  });
};

const fetchWithTimeout = async (url: string, timeout = REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export interface WeatherInfo {
  temperature?: string | null;
  temperatureC?: number | null;
  temperatureF?: number | null;
  icon: 'sunny' | 'cloudy' | 'rainy' | 'snowy';
  description?: string | null;
  location?: string | null;
}

const normalizeWeatherInfo = (data: unknown): WeatherInfo | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const value = data as Record<string, unknown>;

  return {
    temperature: typeof value.temperature === 'string' ? value.temperature : null,
    temperatureC: typeof value.temperatureC === 'number' ? value.temperatureC : null,
    temperatureF: typeof value.temperatureF === 'number' ? value.temperatureF : null,
    icon:
      value.icon === 'sunny' || value.icon === 'rainy' || value.icon === 'snowy'
        ? value.icon
        : 'cloudy',
    description: typeof value.description === 'string' ? value.description : null,
    location: typeof value.location === 'string' ? value.location : null,
  };
};

async function requestWeather(
  params: {
    location?: string;
    coords?: Coordinate;
    dateTime?: string | null;
  },
): Promise<WeatherInfo | null> {
  const query = new URLSearchParams();

  if (params.location) {
    query.set('location', sanitizeSegment(params.location));
  }

  if (params.coords) {
    query.set('latitude', String(params.coords.latitude));
    query.set('longitude', String(params.coords.longitude));
  }

  if (params.dateTime) {
    query.set('dateTime', params.dateTime);
  }

  const url = `${withApiBase('/api/weather')}?${query.toString()}`;

  await acquireSlot();
  try {
    const response = await fetchWithTimeout(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Weather request failed with status ${response.status}`);
    }

    const payload = await response.json();
    return normalizeWeatherInfo(payload?.data);
  } finally {
    releaseSlot();
  }
}

async function fetchWeather(
  params: {
    location?: string;
    coords?: Coordinate;
    dateTime?: string | null;
  },
  signal?: AbortSignal,
): Promise<WeatherInfo | null> {
  const cacheKey = buildCacheKey(params);
  const cached = resultCache.get(cacheKey);

  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.result;
    }

    resultCache.delete(cacheKey);
  }

  const inFlight = pendingRequests.get(cacheKey);
  if (inFlight) {
    return awaitWithAbort(inFlight, signal);
  }

  const request = requestWeather(params)
    .then((result) => {
      resultCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + RESULT_TTL,
      });
      return result;
    })
    .finally(() => {
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, request);
  return awaitWithAbort(request, signal);
}

export async function getWeatherForLocation(
  location: string,
  dateTime?: string | null,
  signal?: AbortSignal,
): Promise<WeatherInfo | null> {
  const normalized = sanitizeSegment(location);
  if (!normalized) {
    return null;
  }

  return fetchWeather({ location: normalized, dateTime }, signal);
}

export async function getWeatherByCoordinates(
  latitude: number,
  longitude: number,
  dateTime?: string | null,
  signal?: AbortSignal,
): Promise<WeatherInfo | null> {
  return fetchWeather(
    {
      coords: { latitude, longitude },
      dateTime,
    },
    signal,
  );
}
