import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import {
  createTraceId,
  getCurrentTelemetryRoute,
  getTelemetrySessionId,
  trackTelemetryAction,
  trackTelemetryBlocker,
  trackTelemetryError,
} from '@/features/system-overview/telemetryClient';
import { emitRealtimeEvent, type RealtimeEventPayload } from '@/realtime/realtimeEvents';

const API_PREFIX = '/api';
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

const buildBaseUrl = () => {
  // Ensure we always target the /api namespace regardless of whether the caller
  // provided a trailing slash.
  const normalized = API_BASE_URL.endsWith('/')
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;

  return normalized.endsWith(API_PREFIX)
    ? normalized
    : `${normalized}${API_PREFIX}`;
};

const toPathname = (url?: string, baseUrl?: string) => {
  if (!url) return '';

  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return new URL(url).pathname;
    }

    const base = baseUrl || buildBaseUrl();
    return new URL(url, `${base.replace(/\/$/, '')}/`).pathname;
  } catch {
    return url;
  }
};

const normalizeApiPath = (url?: string, baseUrl?: string) => {
  const path = toPathname(url, baseUrl);
  const apiIndex = path.indexOf(API_PREFIX);
  return apiIndex >= 0 ? path.slice(apiIndex) : path;
};

const isTelemetryEndpoint = (url?: string, baseUrl?: string) =>
  normalizeApiPath(url, baseUrl).startsWith('/api/system-telemetry/events');

type MutationPayloadRecord = Record<string, unknown>;

const isMutationPayloadRecord = (value: unknown): value is MutationPayloadRecord =>
  Boolean(value) && typeof value === 'object';

const getMutationPayloadValue = (payload: unknown, ...path: string[]) => {
  let current: unknown = payload;

  for (const key of path) {
    if (!isMutationPayloadRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
};

const getMutationPayloadId = (...values: unknown[]): string | number | null => {
  for (const value of values) {
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
  }

  return null;
};

const extractShootId = (path: string, payload?: unknown): string | number | null => {
  const pathMatch = path.match(/\/shoots\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  return getMutationPayloadId(
    getMutationPayloadValue(payload, 'data', 'shoot_id'),
    getMutationPayloadValue(payload, 'data', 'shootId'),
    getMutationPayloadValue(payload, 'data', 'id'),
    getMutationPayloadValue(payload, 'shoot_id'),
    getMutationPayloadValue(payload, 'shootId'),
    getMutationPayloadValue(payload, 'id'),
  );
};

const extractInvoiceId = (path: string, payload?: unknown): string | number | null => {
  const pathMatch = path.match(/\/invoices\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  return getMutationPayloadId(
    getMutationPayloadValue(payload, 'data', 'invoice_id'),
    getMutationPayloadValue(payload, 'data', 'invoiceId'),
    getMutationPayloadValue(payload, 'invoice_id'),
    getMutationPayloadValue(payload, 'invoiceId'),
  );
};

const extractRequestId = (path: string, payload?: unknown): string | number | null => {
  const pathMatch = path.match(/\/editing-requests\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  return getMutationPayloadId(
    getMutationPayloadValue(payload, 'data', 'request_id'),
    getMutationPayloadValue(payload, 'data', 'requestId'),
    getMutationPayloadValue(payload, 'request_id'),
    getMutationPayloadValue(payload, 'requestId'),
  );
};

const buildRealtimeEventsForMutation = (
  method?: string,
  url?: string,
  baseUrl?: string,
  payload?: unknown,
): RealtimeEventPayload[] => {
  const normalizedMethod = method?.toLowerCase();
  if (!normalizedMethod || !MUTATING_METHODS.has(normalizedMethod)) {
    return [];
  }

  const path = normalizeApiPath(url, baseUrl);
  if (!path.startsWith(API_PREFIX)) {
    return [];
  }

  if (path.includes('/editing-requests')) {
    return [{
      type: 'request.updated',
      shootId: extractShootId(path, payload),
      requestId: extractRequestId(path, payload),
      raw: payload,
    }];
  }

  if (
    path.includes('/payments') ||
    path.includes('/mark-paid') ||
    path.includes('/payment-status')
  ) {
    return [{
      type: 'invoice.paid',
      shootId: extractShootId(path, payload),
      invoiceId: extractInvoiceId(path, payload),
      raw: payload,
    }];
  }

  if (path.includes('/shoots')) {
    return [{
      type: 'shoot.updated',
      shootId: extractShootId(path, payload),
      raw: payload,
    }];
  }

  return [];
};

const emitLocalMutationEvents = (method?: string, url?: string, baseUrl?: string, payload?: unknown) => {
  buildRealtimeEventsForMutation(method, url, baseUrl, payload).forEach((event) => {
    emitRealtimeEvent(event);
  });
};

const createTelemetryHeaders = () => ({
  'X-Trace-Id': createTraceId(),
  'X-System-Session-Id': getTelemetrySessionId(),
  'X-System-Current-Route': getCurrentTelemetryRoute(),
});

/**
 * Shared Axios instance for talking to the backend API.
 * Automatically attaches the auth token (if present) and uses the
 * configured API base URL from `src/config/env`.
 */
export const apiClient = axios.create({
  baseURL: buildBaseUrl(),
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

/**
 * Get the impersonation user ID if currently impersonating.
 * Returns null if not impersonating.
 */
export const getImpersonatedUserId = (): string | null => {
  try {
    const originalUserRaw = localStorage.getItem('originalUser');
    if (!originalUserRaw) return null;

    const currentUserRaw = localStorage.getItem('user');
    if (!currentUserRaw) return null;

    const originalUser = JSON.parse(originalUserRaw);
    const currentUser = JSON.parse(currentUserRaw);

    // Only return impersonated ID if the current user differs from the original
    // (i.e. we are actually impersonating someone else)
    if (currentUser?.id && String(currentUser.id) !== String(originalUser?.id)) {
      return String(currentUser.id);
    }
  } catch (e) {
    console.error('[getImpersonatedUserId] Error:', e);
  }
  return null;
};

/**
 * Get headers for fetch requests, including auth token and impersonation header.
 * Use this for non-axios fetch calls.
 */
export const getApiHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...createTelemetryHeaders(),
  };
  
  const token =
    localStorage.getItem('authToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token');
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const impersonatedUserId = getImpersonatedUserId();
  if (impersonatedUserId) {
    headers['X-Impersonate-User-Id'] = impersonatedUserId;
  }
  
  return headers;
};

// Patch the global fetch to automatically inject the impersonation header into every
// request targeting our API. This covers the ~36 raw fetch() calls across the codebase
// that don't use axios or apiClient.
const _originalFetch = window.fetch;
window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  const isApiCall = url.includes('/api/');
  const method =
    init?.method ??
    (typeof input !== 'string' && !(input instanceof URL) ? input.method : undefined) ??
    'GET';

  if (isApiCall) {
    const headers = new Headers(init?.headers);
    const telemetryHeaders = createTelemetryHeaders();
    const isTelemetryCall = isTelemetryEndpoint(url);

    // Inject auth token if not already present
    if (!headers.has('Authorization')) {
      const token =
        localStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        localStorage.getItem('access_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    // Inject impersonation header
    const impersonatedUserId = getImpersonatedUserId();
    if (impersonatedUserId) {
      headers.set('X-Impersonate-User-Id', impersonatedUserId);
    }

    if (!headers.has('X-Trace-Id')) {
      headers.set('X-Trace-Id', telemetryHeaders['X-Trace-Id']);
    }
    headers.set('X-System-Session-Id', telemetryHeaders['X-System-Session-Id']);
    headers.set('X-System-Current-Route', telemetryHeaders['X-System-Current-Route']);

    return _originalFetch.call(window, input, { ...init, headers }).then(async (response) => {
      const traceId = headers.get('X-Trace-Id') || telemetryHeaders['X-Trace-Id'];
      if (isTelemetryCall) {
        return response;
      }

      if (response.ok && MUTATING_METHODS.has(method.toLowerCase())) {
        try {
          const cloned = response.clone();
          const contentType = cloned.headers.get('content-type') || '';
          const payload = contentType.includes('application/json') ? await cloned.json() : undefined;
          emitLocalMutationEvents(method, url, undefined, payload);
          trackTelemetryAction(`${method.toUpperCase()} ${normalizeApiPath(url)}`, {
            statusCode: response.status,
          }, traceId);
        } catch {
          emitLocalMutationEvents(method, url);
        }
      } else if (!response.ok) {
        trackTelemetryBlocker('fetch-error', `${method.toUpperCase()} ${normalizeApiPath(url)} failed`, {
          statusCode: response.status,
        }, traceId);
      }

      return response;
    }).catch((error) => {
      if (!isTelemetryCall) {
        trackTelemetryError(error?.message || 'Fetch request failed', error?.name || 'FetchError', {
          url,
          method,
        }, telemetryHeaders['X-Trace-Id']);
      }
      throw error;
    });
  }

  return _originalFetch.call(window, input, init);
};

// Global interceptor on the DEFAULT axios instance so that all `import axios from 'axios'`
// calls across the codebase automatically include auth + impersonation headers.
axios.interceptors.request.use((config) => {
  try {
    const telemetryHeaders = createTelemetryHeaders();
    const token =
      localStorage.getItem('authToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('access_token');

    if (token && !config.headers.get('Authorization')) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    const impersonatedUserId = getImpersonatedUserId();
    if (impersonatedUserId) {
      config.headers.set('X-Impersonate-User-Id', impersonatedUserId);
    }

    config.headers.set('X-Trace-Id', config.headers.get('X-Trace-Id') || telemetryHeaders['X-Trace-Id']);
    config.headers.set('X-System-Session-Id', telemetryHeaders['X-System-Session-Id']);
    config.headers.set('X-System-Current-Route', telemetryHeaders['X-System-Current-Route']);
  } catch (error) {
    // Silently ignore – individual calls still set their own headers
  }
  return config;
});

axios.interceptors.response.use(
  (response) => {
    if (isTelemetryEndpoint(response.config?.url, response.config?.baseURL)) {
      return response;
    }

    const traceId = response.config?.headers?.['X-Trace-Id'] || response.headers?.['x-trace-id'];
    emitLocalMutationEvents(
      response.config?.method,
      response.config?.url,
      response.config?.baseURL,
      response.data,
    );
    trackTelemetryAction(
      `${String(response.config?.method || 'get').toUpperCase()} ${normalizeApiPath(response.config?.url, response.config?.baseURL)}`,
      { statusCode: response.status },
      Array.isArray(traceId) ? traceId[0] : traceId,
    );

    return response;
  },
  (error) => {
    if (isTelemetryEndpoint(error?.config?.url, error?.config?.baseURL)) {
      return Promise.reject(error);
    }

    const traceId = error?.config?.headers?.['X-Trace-Id'];
    trackTelemetryError(error?.message || 'Axios request failed', error?.name || 'AxiosError', {
      url: error?.config?.url,
      method: error?.config?.method,
      statusCode: error?.response?.status,
    }, Array.isArray(traceId) ? traceId[0] : traceId);
    return Promise.reject(error);
  },
);

apiClient.interceptors.request.use((config) => {
  try {
    const telemetryHeaders = createTelemetryHeaders();
    const baseUrl = config.baseURL ?? '';
    if (
      config.url &&
      !config.url.startsWith('http') &&
      baseUrl.replace(/\/$/, '').endsWith(API_PREFIX) &&
      config.url.startsWith(API_PREFIX)
    ) {
      config.url = config.url.replace(/^\/api/, '');
    }

    const token =
      localStorage.getItem('authToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('access_token');

    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    // Add impersonation header if impersonating
    const impersonatedUserId = getImpersonatedUserId();
    if (impersonatedUserId) {
      config.headers.set('X-Impersonate-User-Id', impersonatedUserId);
    }

    config.headers.set('X-Trace-Id', config.headers.get('X-Trace-Id') || telemetryHeaders['X-Trace-Id']);
    config.headers.set('X-System-Session-Id', telemetryHeaders['X-System-Session-Id']);
    config.headers.set('X-System-Current-Route', telemetryHeaders['X-System-Current-Route']);
  } catch (error) {
    console.warn('Failed to attach auth token', error);
  }

  return config;
});

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => {
    if (isTelemetryEndpoint(response.config?.url, response.config?.baseURL)) {
      return response;
    }

    const traceId = response.config?.headers?.['X-Trace-Id'] || response.headers?.['x-trace-id'];
    emitLocalMutationEvents(
      response.config?.method,
      response.config?.url,
      response.config?.baseURL,
      response.data,
    );
    trackTelemetryAction(
      `${String(response.config?.method || 'get').toUpperCase()} ${normalizeApiPath(response.config?.url, response.config?.baseURL)}`,
      { statusCode: response.status },
      Array.isArray(traceId) ? traceId[0] : traceId,
    );

    return response;
  },
  (error) => {
    if (isTelemetryEndpoint(error?.config?.url, error?.config?.baseURL)) {
      return Promise.reject(error);
    }

    const traceId = error?.config?.headers?.['X-Trace-Id'];
    const normalizedPath = normalizeApiPath(error?.config?.url, error?.config?.baseURL);
    if (error?.response?.status) {
      trackTelemetryBlocker(
        'api-error',
        `${String(error?.config?.method || 'get').toUpperCase()} ${normalizedPath} failed`,
        { statusCode: error.response.status },
        Array.isArray(traceId) ? traceId[0] : traceId,
      );
    } else {
      trackTelemetryError(
        error?.message || 'API request failed',
        error?.name || 'AxiosError',
        { url: error?.config?.url, method: error?.config?.method },
        Array.isArray(traceId) ? traceId[0] : traceId,
      );
    }

    // Log network errors for debugging
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      const fullUrl = error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown';
      console.error('🚨 Network Error - Request never reached backend:', {
        fullUrl,
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        message: error.message,
        code: error.code,
      });
      console.error('💡 Troubleshooting:', {
        '1. Backend running?': 'Check: http://localhost:8000/api/ping',
        '2. API_BASE_URL': import.meta.env.VITE_API_URL || 'Using default (localhost:8000)',
        '3. CORS issue?': 'Check browser console for CORS errors',
        '4. Wrong port?': 'Verify backend port matches VITE_API_PORT or VITE_API_URL',
      });
    }
    
    // Log other errors
    if (error.response) {
      console.error('API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
        fullUrl: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
      });
    }
    
    return Promise.reject(error);
  }
);

