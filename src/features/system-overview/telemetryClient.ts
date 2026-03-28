import { API_BASE_URL } from '@/config/env';
import { findCatalogPageByRoute } from '@/features/system-overview/catalog';

type TelemetryAuthState = {
  isAuthenticated: boolean;
  userId?: string | null;
  role?: string | null;
  name?: string | null;
};

type ClientTelemetryEvent = {
  type:
    | 'session_start'
    | 'session_end'
    | 'route_enter'
    | 'route_leave'
    | 'heartbeat'
    | 'component_mount'
    | 'component_unmount'
    | 'action'
    | 'blocker'
    | 'error';
  routePath?: string;
  pageKey?: string;
  componentName?: string;
  actionName?: string;
  blockerState?: string;
  blockerType?: string;
  blockerMessage?: string;
  errorClass?: string;
  severity?: string;
  message?: string;
  traceId?: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
};

type TelemetryIngestResponse = {
  message?: string;
  stored?: number;
  telemetryAvailable?: boolean;
  code?: string;
};

const SESSION_STORAGE_KEY = 'system_overview.session_id';
const TELEMETRY_DISABLE_WINDOW_MS = 5 * 60 * 1000;
const TELEMETRY_FAILURE_THRESHOLD = 2;

let currentRoute = typeof window !== 'undefined' ? window.location.pathname : '/';
let authState: TelemetryAuthState = { isAuthenticated: false };
let flushTimer: number | null = null;
let heartbeatTimer: number | null = null;
let queue: ClientTelemetryEvent[] = [];
let activeComponentNames: string[] = [];
let telemetryDisabledUntil = 0;
let consecutiveTelemetryFailures = 0;

const getToken = () =>
  localStorage.getItem('authToken') ||
  localStorage.getItem('token') ||
  localStorage.getItem('access_token');

export const getTelemetrySessionId = () => {
  if (typeof window === 'undefined') return '';

  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const created = `sys-${crypto.randomUUID()}`;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
};

export const getCurrentTelemetryRoute = () => currentRoute;

export const createTraceId = () => `trace-${crypto.randomUUID()}`;

export const setTelemetryAuthState = (next: TelemetryAuthState) => {
  authState = next;
};

export const setTelemetryRoute = (route: string) => {
  currentRoute = route;
};

const isTelemetryDisabled = () => Date.now() < telemetryDisabledUntil;

const disableTelemetryTemporarily = () => {
  telemetryDisabledUntil = Date.now() + TELEMETRY_DISABLE_WINDOW_MS;
  consecutiveTelemetryFailures = 0;
  queue = [];

  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
};

const buildHeaders = () => {
  const token = getToken();

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    'X-System-Session-Id': getTelemetrySessionId(),
    'X-System-Current-Route': currentRoute,
    'X-Trace-Id': createTraceId(),
  };
};

const enqueue = (event: ClientTelemetryEvent) => {
  if (!authState.isAuthenticated || isTelemetryDisabled()) return;
  queue.push({
    ...event,
    routePath: event.routePath ?? currentRoute,
    pageKey: event.pageKey ?? findCatalogPageByRoute(currentRoute)?.pageKey,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  });

  if (queue.length >= 8) {
    void flushTelemetry();
    return;
  }

  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
  }

  flushTimer = window.setTimeout(() => {
    void flushTelemetry();
  }, 1200);
};

export const flushTelemetry = async () => {
  if (!authState.isAuthenticated || queue.length === 0 || isTelemetryDisabled()) return;

  const events = [...queue];
  queue = [];

  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }

  try {
    const headers = buildHeaders();
    if (!headers.Authorization) return;

    const response = await fetch(`${API_BASE_URL}/api/system-telemetry/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events }),
      keepalive: true,
    });

    let payload: TelemetryIngestResponse | null = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await response.json().catch(() => null);
    }

    if (payload?.telemetryAvailable === false || payload?.code === 'system_overview_unavailable') {
      disableTelemetryTemporarily();
      return;
    }

    if (!response.ok) {
      consecutiveTelemetryFailures += 1;
      if (consecutiveTelemetryFailures >= TELEMETRY_FAILURE_THRESHOLD) {
        disableTelemetryTemporarily();
        return;
      }

      queue = [...events, ...queue].slice(-20);
      return;
    }

    consecutiveTelemetryFailures = 0;
  } catch (error) {
    consecutiveTelemetryFailures += 1;
    if (consecutiveTelemetryFailures >= TELEMETRY_FAILURE_THRESHOLD) {
      disableTelemetryTemporarily();
      return;
    }

    queue = [...events, ...queue].slice(-20);
  }
};

export const trackTelemetryRouteChange = (nextRoute: string) => {
  const previous = currentRoute;
  const previousPage = findCatalogPageByRoute(previous);
  const nextPage = findCatalogPageByRoute(nextRoute);

  if (previous !== nextRoute) {
    enqueue({
      type: 'route_leave',
      routePath: previous,
      pageKey: previousPage?.pageKey,
      payload: previousPage ? { domain: previousPage.domain } : undefined,
    });

    activeComponentNames.forEach((componentName) =>
      enqueue({
        type: 'component_unmount',
        routePath: previous,
        pageKey: previousPage?.pageKey,
        componentName,
      }),
    );
  }

  currentRoute = nextRoute;
  activeComponentNames = nextPage?.components ?? [];

  enqueue({
    type: 'route_enter',
    routePath: nextRoute,
    pageKey: nextPage?.pageKey,
    actionName: 'view',
    payload: nextPage ? { domain: nextPage.domain, label: nextPage.label } : undefined,
  });

  activeComponentNames.forEach((componentName) =>
    enqueue({
      type: 'component_mount',
      routePath: nextRoute,
      pageKey: nextPage?.pageKey,
      componentName,
    }),
  );
};

export const trackTelemetrySessionStart = () => {
  enqueue({
    type: 'session_start',
    actionName: 'session started',
    payload: {
      userId: authState.userId,
      role: authState.role,
      name: authState.name,
    },
  });
};

export const trackTelemetrySessionEnd = () => {
  enqueue({
    type: 'session_end',
    actionName: 'session ended',
  });
  void flushTelemetry();
};

export const trackTelemetryAction = (
  actionName: string,
  payload?: Record<string, unknown>,
  traceId?: string,
) => {
  enqueue({
    type: 'action',
    actionName,
    traceId,
    payload,
  });
};

export const trackTelemetryBlocker = (
  blockerType: string,
  message: string,
  payload?: Record<string, unknown>,
  traceId?: string,
) => {
  enqueue({
    type: 'blocker',
    blockerType,
    blockerState: 'warning',
    blockerMessage: message,
    message,
    traceId,
    payload,
  });
};

export const trackTelemetryError = (
  message: string,
  errorClass?: string,
  payload?: Record<string, unknown>,
  traceId?: string,
) => {
  enqueue({
    type: 'error',
    blockerType: 'error',
    blockerState: 'error',
    severity: 'critical',
    message,
    errorClass,
    traceId,
    payload,
  });
};

export const startTelemetryHeartbeat = () => {
  if (heartbeatTimer !== null) return;

  heartbeatTimer = window.setInterval(() => {
    enqueue({
      type: 'heartbeat',
      actionName: 'heartbeat',
      payload: {
        activeComponents: activeComponentNames,
      },
    });
  }, 30000);
};

export const stopTelemetryHeartbeat = () => {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};
