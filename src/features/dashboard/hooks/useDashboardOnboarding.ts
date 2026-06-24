import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL } from "@/config/env";
import {
  getOnboardingConfig,
  REPLAY_CAP,
  type RoleKey,
} from "@/features/dashboard/config/dashboardOnboardingConfig";
import {
  DASHBOARD_ONBOARDING_REPLAY_EVENT,
  emitDashboardOnboardingState,
} from "@/lib/dashboardOnboardingEvents";
import {
  createOnboardingSessionUuid,
  recordOnboardingEvent,
  type OnboardingEventType,
} from "@/features/dashboard/telemetry/onboardingTelemetry";
import { getAuthToken } from "@/utils/authToken";

export type DashboardOnboardingState = {
  eligible?: boolean;
  version?: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  dismissedAt?: string;
  lastStep?: number;
  source?: string;
  /** Number of completed replay sessions (0..100, missing treated as 0). */
  replayCount?: number;
};

type UserLike = {
  id?: string | number | null;
  metadata?: {
    preferences?: Record<string, DashboardOnboardingState | undefined>;
    [key: string]: unknown;
  } | null;
} | null;

type MarkOnboardingOptions = {
  lastStep?: number;
};

export type UseDashboardOnboarding = {
  onboardingState: DashboardOnboardingState;
  replayCount: number;
  atReplayCap: boolean;
  shouldShowReplay: boolean;
  shouldShowSettingsReplay: boolean;
  welcomeOpen: boolean;
  tourOpen: boolean;
  startTour: () => Promise<void>;
  dismiss: () => Promise<void>;
  complete: (options?: MarkOnboardingOptions) => Promise<void>;
  saveProgress: (lastStep: number) => Promise<void>;
  replay: () => void;
  setTourOpen: (open: boolean) => void;
  setWelcomeOpen: (open: boolean) => void;
  /** Per-tour session uuid for the current/most-recent tour session. */
  sessionUuid: string | undefined;
  /** Emit a `step_viewed` telemetry event for the given step. */
  recordStepView: (stepIndex: number, stepTarget?: string) => void;
  /** Emit a `step_back` telemetry event for the given step. */
  recordStepBack: (stepIndex: number, stepTarget?: string) => void;
  /** Emit a `help_opened` telemetry event. */
  recordHelpOpened: () => void;
  /** Emit a `help_message` telemetry event. */
  recordHelpMessage: () => void;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const normalizeReplayCount = (replayCount: number | undefined): number =>
  clamp(replayCount ?? 0, 0, 100);

const buildFallbackKey = (fallbackPrefix: string, userId?: string | number | null) =>
  userId != null ? `${fallbackPrefix}:${userId}` : `${fallbackPrefix}:anonymous`;

const readFallbackState = (
  fallbackPrefix: string,
  userId?: string | number | null,
): DashboardOnboardingState => {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(buildFallbackKey(fallbackPrefix, userId));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const writeFallbackState = (
  fallbackPrefix: string,
  userId: string | number | null | undefined,
  state: DashboardOnboardingState,
) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(buildFallbackKey(fallbackPrefix, userId), JSON.stringify(state));
  } catch {
  }
};

const getProfileState = (user: UserLike, onboardingKey: string): DashboardOnboardingState => {
  const state = user?.metadata?.preferences?.[onboardingKey];
  return state && typeof state === "object" ? state : {};
};

export const useDashboardOnboarding = (
  user: UserLike,
  roleKey: RoleKey,
): UseDashboardOnboarding => {
  const config = useMemo(() => getOnboardingConfig(roleKey), [roleKey]);
  const { onboardingKey, fallbackPrefix, version, copy } = config;

  const userId = user?.id ?? null;
  const profileState = useMemo(
    () => getProfileState(user, onboardingKey),
    [user, onboardingKey],
  );
  const [localState, setLocalState] = useState<DashboardOnboardingState>(() => ({
    ...profileState,
    ...readFallbackState(fallbackPrefix, userId),
  }));
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const lastSyncedUserIdRef = useRef<string | number | null | undefined>(undefined);
  // Tracks whether the currently-open tour was started as a replay session.
  const replaySessionRef = useRef(false);
  // Per-tour session uuid. A new one is minted on a fresh start or a replay;
  // a resumed mid-tour session (B3) reuses/sets one without re-emitting started.
  const sessionUuidRef = useRef<string | undefined>(undefined);
  const [sessionUuid, setSessionUuid] = useState<string | undefined>(undefined);
  // Mirrors localState so rapid successive persistState() calls (e.g. quick
  // Next/Back navigation) always merge against the freshest value instead of a
  // stale render closure, preventing progress/replayCount clobbering.
  const stateRef = useRef<DashboardOnboardingState>(localState);
  stateRef.current = localState;

  useEffect(() => {
    const isAccountSwitch = lastSyncedUserIdRef.current !== userId;
    lastSyncedUserIdRef.current = userId;

    const nextState = {
      ...profileState,
      ...readFallbackState(fallbackPrefix, userId),
    };

    setLocalState(nextState);

    if (isAccountSwitch) {
      const isUntouched =
        Boolean(nextState.eligible) &&
        !nextState.startedAt &&
        !nextState.completedAt &&
        !nextState.dismissedAt;
      // Mid-tour: started but neither completed nor dismissed. Resume where the
      // user left off (B3) instead of doing nothing on remount/navigation.
      const isMidTour =
        Boolean(nextState.eligible) &&
        Boolean(nextState.startedAt) &&
        !nextState.completedAt &&
        !nextState.dismissedAt;

      setWelcomeOpen(isUntouched);
      setTourOpen(isMidTour);
      replaySessionRef.current = false;

      if (isMidTour) {
        // Resume silently: ensure a session uuid exists but do NOT emit
        // `started` (this is a resume, not a fresh start). The component opens
        // at getSafeStep(lastStep) when tourOpen flips true.
        const resumeSession = createOnboardingSessionUuid();
        sessionUuidRef.current = resumeSession;
        setSessionUuid(resumeSession);
      } else {
        sessionUuidRef.current = undefined;
        setSessionUuid(undefined);
      }
    }
  }, [profileState, userId, fallbackPrefix]);

  const persistState = useCallback(
    async (patch: DashboardOnboardingState) => {
      // Merge against the freshest known state (ref), never a stale closure, so
      // rapid successive calls cannot clobber each other's progress fields.
      const baseState = stateRef.current;
      const nextState: DashboardOnboardingState = {
        ...baseState,
        ...patch,
        eligible: baseState.eligible ?? profileState.eligible,
        version,
      };
      // Always carry a normalized replayCount in the persisted state.
      nextState.replayCount = normalizeReplayCount(nextState.replayCount);

      stateRef.current = nextState;
      setLocalState(nextState);
      // localStorage is the resilient fallback: even if the network save below
      // fails, progress survives a reload for this user/role.
      writeFallbackState(fallbackPrefix, userId, nextState);

      const token = getAuthToken();
      if (!token) return nextState;

      try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            preferences: {
              [onboardingKey]: nextState,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Unable to save onboarding state (HTTP ${response.status})`);
        }
      } catch (error) {
        // Don't surface to the user, but log so failed saves are diagnosable
        // instead of silently swallowed. Progress is preserved in localStorage.
        if (typeof console !== "undefined") {
          console.warn(
            `[onboarding:${onboardingKey}] failed to persist state to profile`,
            error,
          );
        }
      }

      return nextState;
    },
    [profileState.eligible, userId, fallbackPrefix, onboardingKey, version],
  );

  // Centralized telemetry emit. Always carries role, onboarding_key, version,
  // session_uuid and source so callers only supply event-specific fields.
  const emitTelemetry = useCallback(
    (
      eventType: OnboardingEventType,
      extra?: {
        stepIndex?: number;
        stepTarget?: string;
        meta?: Record<string, unknown>;
      },
    ) => {
      const session = sessionUuidRef.current;
      if (!session) return;

      recordOnboardingEvent({
        event_type: eventType,
        role: roleKey,
        onboarding_key: onboardingKey,
        version,
        session_uuid: session,
        source: "dashboard",
        ...(extra?.stepIndex != null ? { step_index: extra.stepIndex } : {}),
        ...(extra?.stepTarget != null ? { step_target: extra.stepTarget } : {}),
        ...(extra?.meta ? { meta: extra.meta } : {}),
      });
    },
    [roleKey, onboardingKey, version],
  );

  // Mints a fresh per-tour session uuid (used on fresh start and replay).
  const beginSession = useCallback(() => {
    const next = createOnboardingSessionUuid();
    sessionUuidRef.current = next;
    setSessionUuid(next);
    return next;
  }, []);

  const startTour = useCallback(async () => {
    setWelcomeOpen(false);
    setTourOpen(true);
    replaySessionRef.current = false;
    beginSession();
    emitTelemetry("started");
    await persistState({
      startedAt: localState.startedAt ?? new Date().toISOString(),
      dismissedAt: undefined,
      lastStep: 0,
    });
  }, [localState.startedAt, persistState, beginSession, emitTelemetry]);

  const dismiss = useCallback(async () => {
    setWelcomeOpen(false);
    setTourOpen(false);
    replaySessionRef.current = false;
    emitTelemetry("skipped");
    await persistState({ dismissedAt: new Date().toISOString() });
  }, [persistState, emitTelemetry]);

  const complete = useCallback(
    async (options: MarkOnboardingOptions = {}) => {
      setWelcomeOpen(false);
      setTourOpen(false);
      const wasReplay = replaySessionRef.current;
      replaySessionRef.current = false;
      emitTelemetry("completed", { meta: { replay: wasReplay } });
      const current = normalizeReplayCount(localState.replayCount);
      const nextReplayCount = wasReplay && current < REPLAY_CAP ? current + 1 : current;
      await persistState({
        completedAt: new Date().toISOString(),
        lastStep: options.lastStep,
        replayCount: nextReplayCount,
      });
    },
    [localState.replayCount, persistState, emitTelemetry],
  );

  const saveProgress = useCallback(
    async (lastStep: number) => {
      await persistState({
        startedAt: localState.startedAt ?? new Date().toISOString(),
        lastStep,
      });
    },
    [localState.startedAt, persistState],
  );

  const replay = useCallback(() => {
    setWelcomeOpen(false);
    setTourOpen(true);
    replaySessionRef.current = true;
    beginSession();
    emitTelemetry("replayed");
  }, [beginSession, emitTelemetry]);

  const recordStepView = useCallback(
    (stepIndex: number, stepTarget?: string) => {
      emitTelemetry("step_viewed", { stepIndex, stepTarget });
    },
    [emitTelemetry],
  );

  const recordStepBack = useCallback(
    (stepIndex: number, stepTarget?: string) => {
      emitTelemetry("step_back", { stepIndex, stepTarget });
    },
    [emitTelemetry],
  );

  const recordHelpOpened = useCallback(() => {
    emitTelemetry("help_opened");
  }, [emitTelemetry]);

  const recordHelpMessage = useCallback(() => {
    emitTelemetry("help_message");
  }, [emitTelemetry]);

  const replayCount = normalizeReplayCount(localState.replayCount);
  const eligible = Boolean(localState.eligible);
  const atReplayCap = replayCount >= REPLAY_CAP;
  const shouldShowReplay = eligible && !atReplayCap;
  const shouldShowSettingsReplay = eligible && atReplayCap;

  // Emit sidebar visibility state for the role-aware Replay_Button.
  useEffect(() => {
    emitDashboardOnboardingState({
      roleKey,
      visible: shouldShowReplay && !welcomeOpen && !tourOpen,
      label: copy.replayLabel,
    });
  }, [roleKey, shouldShowReplay, welcomeOpen, tourOpen, copy.replayLabel]);

  // Respond to replay requests from the sidebar / Settings entry, but only when
  // the event targets this role.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleReplayRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ roleKey?: RoleKey }>).detail;
      if (detail?.roleKey !== roleKey) return;
      replay();
    };

    window.addEventListener(DASHBOARD_ONBOARDING_REPLAY_EVENT, handleReplayRequest);
    return () => {
      window.removeEventListener(DASHBOARD_ONBOARDING_REPLAY_EVENT, handleReplayRequest);
    };
  }, [roleKey, replay]);

  return {
    onboardingState: localState,
    replayCount,
    atReplayCap,
    shouldShowReplay,
    shouldShowSettingsReplay,
    welcomeOpen,
    tourOpen,
    startTour,
    dismiss,
    complete,
    saveProgress,
    replay,
    setTourOpen,
    setWelcomeOpen,
    sessionUuid,
    recordStepView,
    recordStepBack,
    recordHelpOpened,
    recordHelpMessage,
  };
};
