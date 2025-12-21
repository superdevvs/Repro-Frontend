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

apiClient.interceptors.request.use((config) => {
  try {
    const token =
      localStorage.getItem('authToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('access_token');

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
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

