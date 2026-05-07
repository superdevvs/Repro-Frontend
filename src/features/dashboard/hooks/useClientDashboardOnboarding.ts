import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL } from "@/config/env";
import { getAuthToken } from "@/utils/authToken";

export const CLIENT_DASHBOARD_ONBOARDING_VERSION = 1;

export type ClientDashboardOnboardingState = {
  eligible?: boolean;
  version?: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  dismissedAt?: string;
  lastStep?: number;
  source?: string;
};

type UserLike = {
  id?: string | number | null;
  metadata?: {
    preferences?: {
      clientDashboardOnboarding?: ClientDashboardOnboardingState;
    };
    [key: string]: unknown;
  } | null;
} | null;

type MarkOnboardingOptions = {
  lastStep?: number;
};

const buildFallbackKey = (userId?: string | number | null) =>
  userId != null ? `client-dashboard-onboarding:${userId}` : "client-dashboard-onboarding:anonymous";

const readFallbackState = (userId?: string | number | null): ClientDashboardOnboardingState => {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(buildFallbackKey(userId));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const writeFallbackState = (userId: string | number | null | undefined, state: ClientDashboardOnboardingState) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(buildFallbackKey(userId), JSON.stringify(state));
  } catch {
  }
};

const getProfileState = (user: UserLike): ClientDashboardOnboardingState => {
  const state = user?.metadata?.preferences?.clientDashboardOnboarding;
  return state && typeof state === "object" ? state : {};
};

export const useClientDashboardOnboarding = (user: UserLike) => {
  const userId = user?.id ?? null;
  const profileState = useMemo(() => getProfileState(user), [user]);
  const [localState, setLocalState] = useState<ClientDashboardOnboardingState>(() => ({
    ...profileState,
    ...readFallbackState(userId),
  }));
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const lastSyncedUserIdRef = useRef<string | number | null | undefined>(undefined);

  useEffect(() => {
    const isAccountSwitch = lastSyncedUserIdRef.current !== userId;
    lastSyncedUserIdRef.current = userId;

    const nextState = {
      ...profileState,
      ...readFallbackState(userId),
    };

    setLocalState(nextState);

    if (isAccountSwitch) {
      setWelcomeOpen(Boolean(nextState.eligible && !nextState.startedAt && !nextState.completedAt && !nextState.dismissedAt));
      setTourOpen(false);
    }
  }, [profileState, userId]);

  const persistState = useCallback(
    async (patch: ClientDashboardOnboardingState) => {
      const nextState = {
        ...localState,
        ...patch,
        eligible: localState.eligible ?? profileState.eligible,
        version: CLIENT_DASHBOARD_ONBOARDING_VERSION,
      };

      setLocalState(nextState);
      writeFallbackState(userId, nextState);

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
              clientDashboardOnboarding: nextState,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Unable to save onboarding state");
        }
      } catch {
      }

      return nextState;
    },
    [localState, profileState.eligible, userId],
  );

  const startTour = useCallback(async () => {
    setWelcomeOpen(false);
    setTourOpen(true);
    await persistState({
      startedAt: localState.startedAt ?? new Date().toISOString(),
      dismissedAt: undefined,
      lastStep: 0,
    });
  }, [localState.startedAt, persistState]);

  const dismiss = useCallback(async () => {
    setWelcomeOpen(false);
    setTourOpen(false);
    await persistState({ dismissedAt: new Date().toISOString() });
  }, [persistState]);

  const complete = useCallback(
    async (options: MarkOnboardingOptions = {}) => {
      setWelcomeOpen(false);
      setTourOpen(false);
      await persistState({
        completedAt: new Date().toISOString(),
        lastStep: options.lastStep,
      });
    },
    [persistState],
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
  }, []);

  return {
    onboardingState: localState,
    shouldShowReplay: Boolean(localState.eligible),
    welcomeOpen,
    tourOpen,
    startTour,
    dismiss,
    complete,
    saveProgress,
    replay,
    setTourOpen,
    setWelcomeOpen,
  };
};
