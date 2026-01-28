import type Echo from 'laravel-echo';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';

const normalizeFlag = (value?: string) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

export const isRealtimeEnabled = () =>
  normalizeFlag(import.meta.env.VITE_REALTIME_ENABLED) &&
  Boolean(import.meta.env.VITE_PUSHER_APP_KEY);

const resolveAuthEndpoint = () => {
  const configured = import.meta.env.VITE_PUSHER_AUTH_ENDPOINT?.trim();
  if (configured) return configured;
  if (!API_BASE_URL) return '/broadcasting/auth';
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}/broadcasting/auth`;
};

type EchoClient = Echo<any>;

let echoPromise: Promise<EchoClient | null> | null = null;

export const getEchoClient = async (): Promise<EchoClient | null> => {
  if (typeof window === 'undefined' || !isRealtimeEnabled()) return null;
  if (window.Echo) return window.Echo;
  if (echoPromise) return echoPromise;

  const key = import.meta.env.VITE_PUSHER_APP_KEY;
  if (!key) return null;

  echoPromise = (async () => {
    const [{ default: EchoConstructor }, { default: Pusher }] = await Promise.all([
      import('laravel-echo'),
      import('pusher-js'),
    ]);

    window.Pusher = Pusher;

    const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER ?? 'mt1';
    const host = import.meta.env.VITE_PUSHER_HOST ?? undefined;
    const scheme = import.meta.env.VITE_PUSHER_SCHEME ?? 'https';
    const forceTLS = scheme === 'https';
    const authHeaders = getApiHeaders();

    window.Echo = new EchoConstructor({
      broadcaster: 'pusher',
      key,
      cluster,
      wsHost: host || `ws-${cluster}.pusher.com`,
      wsPort: Number(import.meta.env.VITE_PUSHER_PORT ?? (forceTLS ? 443 : 80)),
      wssPort: Number(import.meta.env.VITE_PUSHER_PORT ?? 443),
      forceTLS,
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
      authEndpoint: resolveAuthEndpoint(),
      auth: {
        headers: authHeaders,
      },
    });

    return window.Echo as EchoClient;
  })();

  return echoPromise;
};

export const disconnectEchoClient = () => {
  if (typeof window === 'undefined') return;
  window.Echo?.disconnect();
  delete window.Echo;
  echoPromise = null;
};
