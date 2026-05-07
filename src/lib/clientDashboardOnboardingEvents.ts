export const CLIENT_DASHBOARD_ONBOARDING_STATE_EVENT = "client-dashboard-onboarding-state";
export const CLIENT_DASHBOARD_ONBOARDING_REPLAY_EVENT = "client-dashboard-onboarding-replay-requested";

export type ClientDashboardOnboardingSidebarState = {
  visible: boolean;
};

let currentClientDashboardOnboardingState: ClientDashboardOnboardingSidebarState = { visible: false };

export const emitClientDashboardOnboardingState = (state: ClientDashboardOnboardingSidebarState) => {
  currentClientDashboardOnboardingState = state;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CLIENT_DASHBOARD_ONBOARDING_STATE_EVENT, { detail: state }));
};

export const getClientDashboardOnboardingState = () => currentClientDashboardOnboardingState;

export const requestClientDashboardOnboardingReplay = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLIENT_DASHBOARD_ONBOARDING_REPLAY_EVENT));
};
