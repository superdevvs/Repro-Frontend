import { API_BASE_URL } from '@/config/env';
import { findCatalogPageByRoute } from '@/features/system-overview/catalog';
import { telemetryLabel, telemetryPayload, telemetryRoute } from './telemetryPrivacy';
import { sanitizeTransferTelemetry, type TransferTelemetry } from './transferTelemetry';

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
    | 'error'
    | 'transfer';
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
  transfer?: TransferTelemetry;
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
const TELEMETRY_BATCH_INTERVAL_MS = 10000;
const TELEMETRY_BATCH_SIZE = 20;
const TELEMETRY_REQUEST_TIMEOUT_MS = 15000;

/**
 * component_mount / component_unmount were ~185k events/day and dominated SQLite
 * ingest writes. Sample at 1% so System Overview still sees a presence signal
 * without flooding the backend. route_enter/leave, actions, blockers, errors,
 * session, and heartbeat stay at full fidelity.
 */
const COMPONENT_MOUNT_SAMPLE_RATE = 0.01;

const shouldSampleComponentLifecycle = () => Math.random() < COMPONENT_MOUNT_SAMPLE_RATE;

let currentRoute = typeof window !== 'undefined' ? window.location.pathname : '/';
let authState: TelemetryAuthState = { isAuthenticated: false };
let flushTimer: number | null = null;
let heartbeatTimer: number | null = null;
let queue: ClientTelemetryEvent[] = [];
let activeComponentNames: string[] = [];
let telemetryDisabledUntil = 0;
let consecutiveTelemetryFailures = 0;
let flushInFlight: Promise<void> | null = null;
let authGeneration = 0;

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
  if (next.isAuthenticated !== authState.isAuthenticated || next.userId !== authState.userId) {
    authGeneration += 1;
    queue = [];
    telemetryDisabledUntil = 0;
    consecutiveTelemetryFailures = 0;
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
  }
  authState = next;
};

export const setTelemetryRoute = (route: string) => {
  currentRoute = telemetryRoute(route);
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
    'X-System-Current-Route': telemetryRoute(currentRoute),
    'X-Trace-Id': createTraceId(),
  };
};

const enqueue = (event: ClientTelemetryEvent) => {
  if (!authState.isAuthenticated || isTelemetryDisabled()) return;
  queue.push({
    type: event.type,
    routePath: telemetryRoute(event.routePath ?? currentRoute),
    pageKey: telemetryLabel(event.pageKey ?? findCatalogPageByRoute(currentRoute)?.pageKey),
    componentName: telemetryLabel(event.componentName),
    actionName: telemetryLabel(event.actionName),
    blockerState: telemetryLabel(event.blockerState),
    blockerType: telemetryLabel(event.blockerType),
    severity: telemetryLabel(event.severity),
    traceId: typeof event.traceId === 'string' && /^[0-9a-f-]{36}$/i.test(event.traceId) ? event.traceId : undefined,
    message: ['error', 'blocker'].includes(event.type) ? 'A browser operation could not be completed.' : undefined,
    blockerMessage: ['error', 'blocker'].includes(event.type) ? 'A browser operation could not be completed.' : undefined,
    errorClass: event.type === 'error' ? 'ClientOperationError' : undefined,
    payload: telemetryPayload(event.payload),
    transfer: event.type === 'transfer' && event.transfer ? sanitizeTransferTelemetry(event.transfer) : undefined,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  });

  if (queue.length >= TELEMETRY_BATCH_SIZE || event.type === 'error' || event.type === 'blocker') {
    void flushTelemetry();
    return;
  }

  scheduleFlush();
};

// Start the batch window with the first event; continued polling must not
// postpone it indefinitely. One timer and one request serve the whole queue.
const scheduleFlush = () => {
  if (flushTimer !== null || queue.length === 0 || !authState.isAuthenticated || isTelemetryDisabled()) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushTelemetry();
  }, TELEMETRY_BATCH_INTERVAL_MS);
};

export const flushTelemetry = async (leavingPage = false) => {
  // A final keepalive cannot wait for an earlier request: the document may
  // disappear before its completion callback runs. Ordinary traffic stays serial.
  if (flushInFlight && leavingPage && queue.length > 0 && authState.isAuthenticated && !isTelemetryDisabled()) {
    return sendTelemetry(queue.splice(0, TELEMETRY_BATCH_SIZE));
  }
  if (flushInFlight) return flushInFlight;
  if (!authState.isAuthenticated || queue.length === 0 || isTelemetryDisabled()) return;

  const events = queue.splice(0, TELEMETRY_BATCH_SIZE);

  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }

  flushInFlight = sendTelemetry(events);
  try {
    await flushInFlight;
  } finally {
    flushInFlight = null;
    if (queue.length >= TELEMETRY_BATCH_SIZE && consecutiveTelemetryFailures === 0 && !isTelemetryDisabled()) {
      void flushTelemetry();
    } else {
      scheduleFlush();
    }
  }
};

const sendTelemetry = async (events: ClientTelemetryEvent[]) => {
  const generation = authGeneration;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TELEMETRY_REQUEST_TIMEOUT_MS);
  try {
    const headers = buildHeaders();
    if (!headers.Authorization) return;

    const response = await fetch(`${API_BASE_URL}/api/system-telemetry/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events }),
      keepalive: true,
      signal: controller.signal,
    });

    let payload: TelemetryIngestResponse | null = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await response.json().catch(() => null);
    }
    if (generation !== authGeneration) return;

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

      queue = [...events, ...queue];
      return;
    }

    consecutiveTelemetryFailures = 0;
  } catch (error) {
    if (generation !== authGeneration) return;
    consecutiveTelemetryFailures += 1;
    if (consecutiveTelemetryFailures >= TELEMETRY_FAILURE_THRESHOLD) {
      disableTelemetryTemporarily();
      return;
    }

    queue = [...events, ...queue];
  } finally {
    window.clearTimeout(timeout);
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

    activeComponentNames.forEach((componentName) => {
      if (!shouldSampleComponentLifecycle()) return;
      enqueue({
        type: 'component_unmount',
        routePath: previous,
        pageKey: previousPage?.pageKey,
        componentName,
      });
    });
  }

  currentRoute = telemetryRoute(nextRoute);
  activeComponentNames = nextPage?.components ?? [];

  enqueue({
    type: 'route_enter',
    routePath: nextRoute,
    pageKey: nextPage?.pageKey,
    actionName: 'view',
    payload: nextPage ? { domain: nextPage.domain, label: nextPage.label } : undefined,
  });

  activeComponentNames.forEach((componentName) => {
    if (!shouldSampleComponentLifecycle()) return;
    enqueue({
      type: 'component_mount',
      routePath: nextRoute,
      pageKey: nextPage?.pageKey,
      componentName,
    });
  });
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
  void flushTelemetry(true);
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

export const trackTransferTelemetry = (transfer: TransferTelemetry) => {
  const sanitized = sanitizeTransferTelemetry(transfer);
  if (sanitized) enqueue({ type: 'transfer', actionName: 'media_transfer', transfer: sanitized });
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
