import type { RoleKey } from '@/features/dashboard/config/dashboardOnboardingConfig';

export const DASHBOARD_ONBOARDING_STATE_EVENT = "dashboard-onboarding-state";
export const DASHBOARD_ONBOARDING_REPLAY_EVENT = "dashboard-onboarding-replay-requested";

export type DashboardOnboardingSidebarState = {
  roleKey: RoleKey;
  visible: boolean;
  label: string;
};

let currentDashboardOnboardingState: DashboardOnboardingSidebarState | null = null;

export const emitDashboardOnboardingState = (state: DashboardOnboardingSidebarState) => {
  currentDashboardOnboardingState = state;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_ONBOARDING_STATE_EVENT, { detail: state }));
};

export const getDashboardOnboardingState = (): DashboardOnboardingSidebarState | null =>
  currentDashboardOnboardingState;

const PENDING_REPLAY_KEY = "dashboard-onboarding-pending-replay";

export const requestDashboardOnboardingReplay = (roleKey: RoleKey) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_REPLAY_KEY, roleKey);
  } catch {
    // Session storage can be unavailable in private browsing.
  }
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_ONBOARDING_REPLAY_EVENT, { detail: { roleKey } })
  );
};

/** Clears a queued replay only when it belongs to this role. */
export const consumePendingDashboardOnboardingReplay = (roleKey: RoleKey): boolean => {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(PENDING_REPLAY_KEY) !== roleKey) return false;
    window.sessionStorage.removeItem(PENDING_REPLAY_KEY);
    return true;
  } catch {
    return false;
  }
};
