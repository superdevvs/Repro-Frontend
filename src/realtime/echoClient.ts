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

type EchoClient = Echo<'pusher'>;

let echoPromise: Promise<EchoClient | null> | null = null;
let echoModulesPromise: Promise<[typeof import('laravel-echo'), typeof import('pusher-js')]> | null = null;
let echoAuthIdentity: string | null = null;
let echoGeneration = 0;
const echoListeners = new Set<() => void>();

export const subscribeEchoClientChanges = (listener: () => void) => {
  echoListeners.add(listener);
  return () => { echoListeners.delete(listener); };
};
export const getEchoClientGeneration = () => echoGeneration;

export const getEchoClient = async (): Promise<EchoClient | null> => {
  if (typeof window === 'undefined' || !isRealtimeEnabled()) return null;
  const authHeaders = getApiHeaders();
  // Trace headers change on every request; only credentials identify the actor.
  const authIdentity = JSON.stringify([authHeaders.Authorization ?? '', authHeaders['X-Impersonate-User-Id'] ?? '']);
  if (echoAuthIdentity !== null && echoAuthIdentity !== authIdentity) disconnectEchoClient();
  echoAuthIdentity = authIdentity;
  if (window.Echo) return window.Echo;
  if (echoPromise) return echoPromise;

  const key = import.meta.env.VITE_PUSHER_APP_KEY;
  if (!key) return null;

  const generation = echoGeneration;
  echoPromise = (async () => {
    // Dependencies are independent of the authenticated actor. Share their
    // load while each connection initialization keeps its own actor guard.
    echoModulesPromise ??= Promise.all([import('laravel-echo'), import('pusher-js')]);
    const [{ default: EchoConstructor }, { default: Pusher }] = await echoModulesPromise;
    // An impersonation/login change can occur while the lazy imports load.
    if (generation !== echoGeneration) return null;

    window.Pusher = Pusher;

    const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER ?? 'mt1';
    const host = import.meta.env.VITE_PUSHER_HOST ?? undefined;
    const scheme = import.meta.env.VITE_PUSHER_SCHEME ?? 'https';
    const forceTLS = scheme === 'https';

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
  echoAuthIdentity = null;
  echoGeneration += 1;
  echoListeners.forEach(listener => listener());
};
