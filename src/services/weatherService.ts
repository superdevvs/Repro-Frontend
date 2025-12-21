import {
  ACCU_WEATHER_API_KEY,
  OPEN_WEATHER_API_KEY,
  WEATHER_API_KEY,
} from '@/config/env';
import {
  getWeatherProvider,
  subscribeToWeatherProvider,
  WeatherProvider,
} from '@/state/weatherProviderStore';

type Coordinate = { latitude: number; longitude: number };
type ForecastEntry = {
  dt?: number;
  main?: { temp?: number };
  weather?: Array<{ main?: string; description?: string }>;
};

type AccuForecastEntry = {
  DateTime?: string;
  Temperature?: { Value?: number; Unit?: string };
  IconPhrase?: string;
};

type WeatherApiHour = {
  time_epoch: number;
  temp_c: number;
  temp_f: number;
  condition?: { text?: string };
};

const coordCache = new Map<string, Coordinate>();
const openForecastCache = new Map<string, { expiresAt: number; entries: ForecastEntry[] }>();
const accuLocationCache = new Map<string, string>();
const accuForecastCache = new Map<string, { expiresAt: number; entries: AccuForecastEntry[] }>();
const weatherApiCache = new Map<string, { expiresAt: number; hours: WeatherApiHour[] }>();

const GEO_API = 'https://api.openweathermap.org/geo/1.0/direct';
const OPEN_FORECAST_API = 'https://api.openweathermap.org/data/2.5/forecast';
const ACCU_SEARCH_API =
  'https://dataservice.accuweather.com/locations/v1/cities/search';
const ACCU_GEO_API =
  'https://dataservice.accuweather.com/locations/v1/cities/geoposition/search';
const ACCU_FORECAST_API =
  'https://dataservice.accuweather.com/forecasts/v1/hourly/12hour';
const WEATHER_API_FORECAST = 'https://api.weatherapi.com/v1/forecast.json';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const RESULT_TTL = 10 * 60 * 1000; // 10 minutes per provider result
const REQUEST_TIMEOUT = 1500; // 1.5 second timeout for faster failover

const resultCache = new Map<string, { expiresAt: number; result: WeatherInfo }>();
const getResultCacheKey = (location: string, dateTime?: string | null) => {
  const targetKey = dateTime ? String(resolveTargetTimestamp(dateTime)) : 'now';
  return `${normalizeLocationKey(location)}|${targetKey}`;
};

// Timeout wrapper for fetch requests
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const sanitizeSegment = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeLocationKey = (value: string) =>
  sanitizeSegment(value).toLowerCase();

const stripPostalCodes = (value: string) =>
  sanitizeSegment(value)
    .replace(/\d{5}(?:-\d{4})?/g, '')
    .replace(/\b\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const buildLocationQueries = (raw: string) => {
  const queries: string[] = [];
  const base = sanitizeSegment(raw);
  if (base) queries.push(base);

  const withoutZip = stripPostalCodes(base);
  if (withoutZip && withoutZip !== base) queries.push(withoutZip);

  const commaSegments = base.split(',').map((seg) => sanitizeSegment(seg)).filter(Boolean);
  if (commaSegments.length > 1) {
    const tail = commaSegments.slice(-2).join(', ');
    if (tail && !queries.includes(tail)) queries.push(tail);
  }
  commaSegments.forEach((seg) => {
    if (seg && !queries.includes(seg)) queries.push(seg);
  });

  if (!base.includes(',')) {
    const tokens = base.split(' ').filter(Boolean);
    if (tokens.length > 2) {
      const tail = tokens.slice(-2).join(' ');
      if (tail && !queries.includes(tail)) queries.push(tail);
    }
  }

  return queries.filter(Boolean);
};

const coordsCacheKey = (coords: Coordinate) =>
  `${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)}`;

export interface WeatherInfo {
  temperature?: string;
  temperatureC?: number;
  temperatureF?: number;
  icon: 'sunny' | 'cloudy' | 'rainy' | 'snowy';
  description?: string;
  location?: string;
}

const iconFromDescription = (desc?: string): WeatherInfo['icon'] => {
  if (!desc) return 'cloudy';
  const lower = desc.toLowerCase();
  if (lower.includes('snow')) return 'snowy';
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('storm')) return 'rainy';
  if (lower.includes('clear') || lower.includes('sun')) return 'sunny';
  return 'cloudy';
};

const resolveTargetTimestamp = (dateTime?: string | null) => {
  if (!dateTime) return Date.now();
  const parsed = new Date(dateTime).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

interface ProviderContext {
  location?: string;
  queries: string[];
  coords?: Coordinate | null;
  target: number;
  signal?: AbortSignal;
  ensureCoords: () => Promise<Coordinate | null>;
}

// AccuWeather disabled - API key CORS restrictions don't allow localhost:5174
const PROVIDER_ORDER: WeatherProvider[] = ['openweather', 'weatherapi'];
let activeProvider: WeatherProvider = getWeatherProvider();

const clearCaches = () => {
  coordCache.clear();
  openForecastCache.clear();
  accuLocationCache.clear();
  accuForecastCache.clear();
  weatherApiCache.clear();
  resultCache.clear();
};

subscribeToWeatherProvider((provider) => {
  activeProvider = provider;
  clearCaches();
});

export async function getWeatherForLocation(
  location: string,
  dateTime?: string | null,
  signal?: AbortSignal,
): Promise<WeatherInfo | null> {
  const cacheKey = getResultCacheKey(location, dateTime);
  const cached = resultCache.get(cacheKey);
  if (cached) {
    if (cached.expiresAt > Date.now()) return cached.result;
    resultCache.delete(cacheKey);
  }

  const result = await fetchWeather({ location, dateTime, signal });
  if (result) {
    resultCache.set(cacheKey, { result, expiresAt: Date.now() + RESULT_TTL });
  }
  return result;
}

export async function getWeatherByCoordinates(
  latitude: number,
  longitude: number,
  dateTime?: string | null,
  signal?: AbortSignal,
): Promise<WeatherInfo | null> {
  const result = await fetchWeather({
    coords: { latitude, longitude },
    dateTime,
    signal,
  });
  
  // Add location name via reverse geocoding
  if (result && !result.location) {
    try {
      const locationName = await reverseGeocode(latitude, longitude, signal);
      if (locationName) {
        result.location = locationName;
      }
    } catch {
      // Silently ignore reverse geocoding errors
    }
  }
  
  return result;
}

async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      limit: '1',
      appid: OPEN_WEATHER_API_KEY,
    });
    const res = await fetch(`${GEO_API.replace('/direct', '/reverse')}?${params.toString()}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0]?.name) {
      return data[0].name;
    }
  } catch {
    // Silently ignore
  }
  return null;
}

async function fetchWeather(params: {
  location?: string;
  coords?: Coordinate;
  dateTime?: string | null;
  signal?: AbortSignal;
}): Promise<WeatherInfo | null> {
  const queries = params.location ? buildLocationQueries(params.location) : [];
  let cachedCoords: Coordinate | null | undefined = params.coords;
  const target = resolveTargetTimestamp(params.dateTime);

  const ensureCoords = async () => {
    if (cachedCoords) return cachedCoords;
    if (!params.location) return null;
    cachedCoords = await geocode(params.location, params.signal);
    return cachedCoords;
  };

  const contextBase: Omit<ProviderContext, 'ensureCoords'> = {
    location: params.location,
    queries,
    coords: cachedCoords,
    target,
    signal: params.signal,
  };

  const order = [
    activeProvider,
    ...PROVIDER_ORDER.filter((provider) => provider !== activeProvider),
  ];

  for (const provider of order) {
    const fetcher = providerFetchers[provider];
    try {
      const result = await fetcher({
        ...contextBase,
        coords: cachedCoords ?? null,
        ensureCoords,
      });
      if (result) return result;
    } catch {
      // try next provider
    }
  }

  return null;
}

const providerFetchers: Record<
  WeatherProvider,
  (ctx: ProviderContext) => Promise<WeatherInfo | null>
> = {
  openweather: async (ctx) => {
    if (!OPEN_WEATHER_API_KEY) return null;
    const coords = ctx.coords ?? (await ctx.ensureCoords());
    if (!coords) return null;
    const entries = await loadOpenWeatherForecast(coords, ctx.signal);
    if (!entries.length) return null;
    return toWeatherInfo(pickOpenWeatherEntry(entries, ctx.target));
  },
  accuweather: async () => {
    // AccuWeather disabled - API key CORS restrictions don't allow localhost:5174
    return null;
  },
  weatherapi: async (ctx) => {
    if (!WEATHER_API_KEY) return null;
    const hoursFromQueries = await loadWeatherApiFromQueries(ctx);
    if (hoursFromQueries) return hoursFromQueries;
    const coords = ctx.coords ?? (await ctx.ensureCoords());
    if (!coords) return null;
    return loadWeatherApiByCoords(coords, ctx.target, ctx.signal);
  },
};

async function fetchCoordsForQuery(query: string, signal?: AbortSignal): Promise<Coordinate | null> {
  if (!OPEN_WEATHER_API_KEY) return null;
  const url = `${GEO_API}?q=${encodeURIComponent(query)}&limit=1&appid=${OPEN_WEATHER_API_KEY}`;
  const res = await fetchWithTimeout(url, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { latitude: data[0].lat, longitude: data[0].lon };
}

async function geocode(location: string, signal?: AbortSignal): Promise<Coordinate | null> {
  const cacheKey = normalizeLocationKey(location);
  if (coordCache.has(cacheKey)) return coordCache.get(cacheKey)!;

  const queries = buildLocationQueries(location);
  for (const query of queries) {
    const coords = await fetchCoordsForQuery(query, signal);
    if (coords) {
      coordCache.set(cacheKey, coords);
      coordCache.set(normalizeLocationKey(query), coords);
      return coords;
    }
  }

  return null;
}

async function loadOpenWeatherForecast(
  coords: Coordinate,
  signal?: AbortSignal,
): Promise<ForecastEntry[]> {
  const cacheKey = `ow:${coordsCacheKey(coords)}`;
  const cached = openForecastCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.entries;
  }

  const params = new URLSearchParams({
    lat: String(coords.latitude),
    lon: String(coords.longitude),
    units: 'metric',
    appid: OPEN_WEATHER_API_KEY!,
  });

  const response = await fetchWithTimeout(`${OPEN_FORECAST_API}?${params.toString()}`, { signal });
  if (!response.ok) return [];
  const payload = await response.json();
  const entries = Array.isArray(payload?.list) ? payload.list : [];
  openForecastCache.set(cacheKey, { entries, expiresAt: Date.now() + CACHE_TTL });
  return entries;
}

const pickOpenWeatherEntry = (entries: ForecastEntry[], target: number): ForecastEntry | null => {
  if (!entries.length) return null;
  return (
    entries.reduce<ForecastEntry | null>((closest, entry) => {
      if (!entry?.dt) return closest;
      if (!closest) return entry;
      const diffCurrent = Math.abs(entry.dt * 1000 - target);
      const diffClosest = Math.abs((closest.dt || 0) * 1000 - target);
      return diffCurrent < diffClosest ? entry : closest;
    }, null) || entries[0]
  );
};

const toWeatherInfo = (entry: ForecastEntry | null): WeatherInfo | null => {
  if (!entry) return null;
  const tempC = typeof entry?.main?.temp === 'number' ? entry.main.temp : undefined;
  const description = entry?.weather?.[0]?.description || entry?.weather?.[0]?.main;
  return {
    temperature: typeof tempC === 'number' ? `${Math.round(tempC)}°` : undefined,
    temperatureC: tempC,
    temperatureF: typeof tempC === 'number' ? Math.round((tempC * 9) / 5 + 32) : undefined,
    icon: iconFromDescription(description),
    description,
  };
};

const resolveAccuLocationKey = async (ctx: ProviderContext): Promise<string | null> => {
  for (const query of ctx.queries) {
    const normalized = normalizeLocationKey(query);
    if (accuLocationCache.has(normalized)) {
      return accuLocationCache.get(normalized)!;
    }
    try {
      const params = new URLSearchParams({
        apikey: ACCU_WEATHER_API_KEY!,
        q: query,
      });
      const res = await fetch(`${ACCU_SEARCH_API}?${params.toString()}`, { signal: ctx.signal });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0]?.Key) {
        accuLocationCache.set(normalized, data[0].Key);
        return data[0].Key;
      }
    } catch {
      // continue
    }
  }

  const coords = ctx.coords ?? (await ctx.ensureCoords());
  if (!coords) return null;
  const coordKey = coordsCacheKey(coords);
  if (accuLocationCache.has(coordKey)) return accuLocationCache.get(coordKey)!;

  try {
    const params = new URLSearchParams({
      apikey: ACCU_WEATHER_API_KEY!,
      q: `${coords.latitude},${coords.longitude}`,
    });
    const res = await fetch(`${ACCU_GEO_API}?${params.toString()}`, { signal: ctx.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.Key) {
      accuLocationCache.set(coordKey, data.Key);
      return data.Key;
    }
  } catch {
    return null;
  }

  return null;
};

async function loadAccuForecast(locationKey: string, signal?: AbortSignal) {
  const cacheKey = `accu:${locationKey}`;
  const cached = accuForecastCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.entries;
  }

  try {
    const params = new URLSearchParams({
      apikey: ACCU_WEATHER_API_KEY!,
      metric: 'true',
      details: 'true',
    });
    const res = await fetch(`${ACCU_FORECAST_API}/${locationKey}?${params.toString()}`, {
      signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    accuForecastCache.set(cacheKey, { entries: data, expiresAt: Date.now() + CACHE_TTL });
    return data;
  } catch {
    return [];
  }
}

const pickAccuEntry = (entries: AccuForecastEntry[], target: number): AccuForecastEntry | null => {
  if (!entries.length) return null;
  return (
    entries.reduce<AccuForecastEntry | null>((closest, entry) => {
      if (!entry?.DateTime) return closest;
      if (!closest) return entry;
      const currentTime = new Date(entry.DateTime).getTime();
      const closestTime = closest.DateTime ? new Date(closest.DateTime).getTime() : NaN;
      const diffCurrent = Math.abs(currentTime - target);
      const diffClosest = Math.abs(closestTime - target);
      return diffCurrent < diffClosest ? entry : closest;
    }, null) || entries[0]
  );
};

const toWeatherInfoFromAccu = (entry: AccuForecastEntry | null): WeatherInfo | null => {
  if (!entry) return null;
  const tempValue = entry.Temperature?.Value;
  const unit = entry.Temperature?.Unit;
  const tempC =
    typeof tempValue === 'number'
      ? unit === 'F'
        ? ((tempValue - 32) * 5) / 9
        : tempValue
      : undefined;
  const tempF =
    typeof tempValue === 'number'
      ? unit === 'C'
        ? (tempValue * 9) / 5 + 32
        : tempValue
      : undefined;
  return {
    temperature: typeof tempC === 'number' ? `${Math.round(tempC)}°` : `${Math.round(tempF ?? 0)}°`,
    temperatureC: tempC,
    temperatureF: tempF,
    icon: iconFromDescription(entry.IconPhrase),
    description: entry.IconPhrase,
  };
};

const loadWeatherApiFromQueries = async (
  ctx: ProviderContext,
): Promise<WeatherInfo | null> => {
  for (const query of ctx.queries) {
    const info = await loadWeatherApiForecast(query, ctx.target, ctx.signal);
    if (info) return info;
  }
  return null;
};

const loadWeatherApiByCoords = async (
  coords: Coordinate,
  target: number,
  signal?: AbortSignal,
): Promise<WeatherInfo | null> => {
  const query = `${coords.latitude},${coords.longitude}`;
  return loadWeatherApiForecast(query, target, signal);
};

const loadWeatherApiForecast = async (
  query: string,
  target: number,
  signal?: AbortSignal,
): Promise<WeatherInfo | null> => {
  const normalized = normalizeLocationKey(query);
  const cached = weatherApiCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return toWeatherInfoFromWeatherApi(pickWeatherApiHour(cached.hours, target));
  }

  try {
    const params = new URLSearchParams({
      key: WEATHER_API_KEY!,
      q: query,
      days: '3',
      alerts: 'no',
      aqi: 'no',
    });
    const res = await fetchWithTimeout(`${WEATHER_API_FORECAST}?${params.toString()}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const hours =
      data?.forecast?.forecastday?.flatMap((day: any) => day?.hour || []) || [];
    if (!hours.length) return null;
    weatherApiCache.set(normalized, { hours, expiresAt: Date.now() + RESULT_TTL });
    return toWeatherInfoFromWeatherApi(pickWeatherApiHour(hours, target));
  } catch {
    return null;
  }
};

const pickWeatherApiHour = (hours: WeatherApiHour[], target: number): WeatherApiHour | null => {
  if (!hours.length) return null;
  return (
    hours.reduce<WeatherApiHour | null>((closest, hour) => {
      if (!closest) return hour;
      const diffCurrent = Math.abs(hour.time_epoch * 1000 - target);
      const diffClosest = Math.abs(closest.time_epoch * 1000 - target);
      return diffCurrent < diffClosest ? hour : closest;
    }, null) || hours[0]
  );
};

const toWeatherInfoFromWeatherApi = (hour: WeatherApiHour | null): WeatherInfo | null => {
  if (!hour) return null;
  return {
    temperature: `${Math.round(hour.temp_c)}°`,
    temperatureC: hour.temp_c,
    temperatureF: hour.temp_f,
    icon: iconFromDescription(hour.condition?.text),
    description: hour.condition?.text,
  };
};

