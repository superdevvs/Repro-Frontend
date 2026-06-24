/**
 * Onboarding telemetry client.
 *
 * A small, non-blocking, batched client for emitting dashboard onboarding
 * lifecycle/step events to the backend. Events are queued in-memory and flushed
 * in small batches (after a short debounce window or once a batch fills up) to
 * `POST ${API_BASE_URL}/api/onboarding/events`.
 *
 * Design goals:
 * - Never block the UI or throw into callers: network failures are swallowed
 *   (with a console.warn for diagnosability).
 * - Skip sending entirely when there is no auth token.
 * - Best-effort flush on pagehide / visibilitychange(hidden) so in-flight
 *   events survive navigation away, using navigator.sendBeacon when available.
 */

import { API_BASE_URL } from "@/config/env";
import type { RoleKey } from "@/features/dashboard/config/dashboardOnboardingConfig";
import { getAuthToken } from "@/utils/authToken";

export type OnboardingEventType =
  | "started"
  | "step_viewed"
  | "step_back"
  | "completed"
  | "skipped"
  | "replayed"
  | "help_opened"
  | "help_message";

/**
 * Typed onboarding telemetry event. Field names align EXACTLY with the backend
 * contract for `POST /api/onboarding/events`.
 */
export interface OnboardingTelemetryEvent {
  event_type: OnboardingEventType;
  /** Role the tour belongs to. */
  role: RoleKey;
  /** Stable onboarding preference key, from getOnboardingConfig(role).onboardingKey. */
  onboarding_key: string;
  /** Onboarding config version, from getOnboardingConfig(role).version. */
  version?: number;
  /** Zero-based step index (0..100). */
  step_index?: number;
  /** Step target identifier (max 100 chars). */
  step_target?: string;
  /** Per-tour session identifier (required, max 64 chars). */
  session_uuid: string;
  /** Event source, e.g. 'dashboard'. */
  source?: string;
  /** Arbitrary structured metadata. */
  meta?: Record<string, unknown>;
}

/** Batch sizing / timing knobs. */
const FLUSH_DEBOUNCE_MS = 500;
const MAX_BATCH_SIZE = 10;
const EVENTS_ENDPOINT = `${API_BASE_URL}/api/onboarding/events`;

/**
 * Generates a per-tour session uuid. Uses crypto.randomUUID() when available,
 * falling back to a Math.random-based v4-shaped string for older environments.
 */
export const createOnboardingSessionUuid = (): string => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the manual fallback below.
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

let queue: OnboardingTelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

const clearFlushTimer = () => {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
};

/**
 * Sends a batch of events. Fails silently (console.warn) on any error. Skips
 * entirely if there is no auth token. When `useBeacon` is set and sendBeacon is
 * available we use it for best-effort delivery during page teardown.
 */
const sendBatch = (events: OnboardingTelemetryEvent[], useBeacon = false): void => {
  if (events.length === 0) return;

  const token = getAuthToken();
  if (!token) return;

  const payload = JSON.stringify({ events });

  if (
    useBeacon &&
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    try {
      // sendBeacon cannot set an Authorization header; the backend accepts a
      // token query param fallback for beacon delivery during teardown.
      const beaconUrl = `${EVENTS_ENDPOINT}?token=${encodeURIComponent(token)}`;
      const blob = new Blob([payload], { type: "application/json" });
      const queued = navigator.sendBeacon(beaconUrl, blob);
      if (queued) return;
    } catch {
      // Fall through to fetch below.
    }
  }

  try {
    void fetch(EVENTS_ENDPOINT, {
      method: "POST",
      keepalive: useBeacon,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: payload,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to record onboarding events (HTTP ${response.status})`);
        }
      })
      .catch((error) => {
        if (typeof console !== "undefined") {
          console.warn("[onboarding-telemetry] failed to send events", error);
        }
      });
  } catch (error) {
    if (typeof console !== "undefined") {
      console.warn("[onboarding-telemetry] failed to send events", error);
    }
  }
};

/** Flushes any queued events immediately. */
export const flushOnboardingEvents = (useBeacon = false): void => {
  clearFlushTimer();
  if (queue.length === 0) return;

  const batch = queue;
  queue = [];
  sendBatch(batch, useBeacon);
};

const handlePageHide = () => flushOnboardingEvents(true);
const handleVisibilityChange = () => {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    flushOnboardingEvents(true);
  }
};

const ensureTeardownListeners = () => {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;
  window.addEventListener("pagehide", handlePageHide);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
};

const scheduleFlush = () => {
  if (queue.length >= MAX_BATCH_SIZE) {
    flushOnboardingEvents();
    return;
  }

  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushOnboardingEvents();
  }, FLUSH_DEBOUNCE_MS);
};

/**
 * Queues an onboarding event for batched, non-blocking delivery. No-ops when
 * there is no auth token so we never queue events that can't be sent.
 */
export const recordOnboardingEvent = (event: OnboardingTelemetryEvent): void => {
  if (!getAuthToken()) return;

  ensureTeardownListeners();
  queue.push(event);
  scheduleFlush();
};
