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

export const requestDashboardOnboardingReplay = (roleKey: RoleKey) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_ONBOARDING_REPLAY_EVENT, { detail: { roleKey } })
  );
};
