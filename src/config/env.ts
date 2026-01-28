const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const PRIVATE_LAN_HOST_REGEX =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

const isLocalHostHostname = (hostname?: string | null) =>
  !hostname ||
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  PRIVATE_LAN_HOST_REGEX.test(hostname);

const envApiPort = import.meta.env?.VITE_API_PORT?.trim();
const DEV_BACKEND_PORT = envApiPort && envApiPort.length > 0 ? envApiPort : '8000';

const resolveDefaultBase = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  // In development, use empty string to leverage Vite proxy for /api routes
  // This ensures the browser preview works correctly
  if (import.meta.env.DEV) {
    return '';
  }

  return normalizeUrl(window.location.origin);
};

const envBase = import.meta.env?.VITE_API_URL?.trim();

const stripApiSuffix = (value: string) =>
  value.endsWith('/api') ? value.slice(0, -4) : value;

const resolveEnvBase = () => {
  if (!envBase || envBase.length === 0) {
    return import.meta.env.DEV ? '' : null;
  }

  try {
    const normalized = stripApiSuffix(normalizeUrl(envBase));
    if (normalized === 'api') {
      return '';
    }
    return normalized;
  } catch (error) {
    console.warn('[env] Invalid VITE_API_URL. Falling back to window.origin.', {
      envBase,
      error,
    });
    return null;
  }
};

export const API_BASE_URL = resolveEnvBase() ?? resolveDefaultBase();

export const BRIDGE_DATA_ACCESS_TOKEN =
  import.meta.env?.VITE_BRIDGE_DATA_TOKEN?.trim() || '';

export const BRIDGE_DATA_BASE_URL =
  import.meta.env?.VITE_BRIDGE_DATA_BASE_URL?.trim() ||
  'https://api.bridgedataoutput.com/api/v2';

export const withApiBase = (path: string) =>
  path.startsWith('http')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

export const OPEN_WEATHER_API_KEY = import.meta.env?.VITE_OPEN_WEATHER_API_KEY;

export const ACCU_WEATHER_API_KEY = import.meta.env?.VITE_ACCU_WEATHER_API_KEY;

export const WEATHER_API_KEY = import.meta.env?.VITE_WEATHER_API_KEY;

// Square Payment Configuration
// These are optional - if not set, the component will fetch from backend
export const SQUARE_APPLICATION_ID =
  import.meta.env?.VITE_SQUARE_APPLICATION_ID?.trim() || '';

export const SQUARE_LOCATION_ID =
  import.meta.env?.VITE_SQUARE_LOCATION_ID?.trim() || '';

