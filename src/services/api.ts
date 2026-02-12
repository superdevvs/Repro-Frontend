import axios from 'axios';
import { API_BASE_URL } from '@/config/env';

const API_PREFIX = '/api';

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

  if (isApiCall) {
    const headers = new Headers(init?.headers);

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

    return _originalFetch.call(window, input, { ...init, headers });
  }

  return _originalFetch.call(window, input, init);
};

// Global interceptor on the DEFAULT axios instance so that all `import axios from 'axios'`
// calls across the codebase automatically include auth + impersonation headers.
axios.interceptors.request.use((config) => {
  try {
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
  } catch (error) {
    // Silently ignore – individual calls still set their own headers
  }
  return config;
});

apiClient.interceptors.request.use((config) => {
  try {
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
  } catch (error) {
    console.warn('Failed to attach auth token', error);
  }

  return config;
});

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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

