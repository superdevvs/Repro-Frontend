export type RealtimeEventType =
  | 'shoot.updated'
  | 'shoot.assigned'
  | 'request.updated'
  | 'invoice.paid';

export type RealtimeEventPayload = {
  type: RealtimeEventType;
  shootId?: string | number | null;
  requestId?: string | number | null;
  invoiceId?: string | number | null;
  raw?: unknown;
};

const DEBUG_STORAGE_KEY = 'realtime.debug';

const normalizeFlag = (value?: string | null) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

export const isRealtimeDebugEnabled = () => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  try {
    return normalizeFlag(window.localStorage.getItem(DEBUG_STORAGE_KEY));
  } catch {
    return false;
  }
};

export const logRealtimeDebug = (message: string, payload?: unknown) => {
  if (!isRealtimeDebugEnabled() || typeof console === 'undefined') return;
  if (payload !== undefined) {
    console.info(`[realtime] ${message}`, payload);
  } else {
    console.info(`[realtime] ${message}`);
  }
};

type RealtimeListener = (event: RealtimeEventPayload) => void;

const listeners = new Set<RealtimeListener>();

export const subscribeRealtimeEvents = (listener: RealtimeListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitRealtimeEvent = (event: RealtimeEventPayload) => {
  listeners.forEach((listener) => listener(event));
};
