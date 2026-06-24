import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Mock the sidebar visibility event bus so we can spy on emissions while
// preserving the real event-name constants the hook also imports.
vi.mock("@/lib/dashboardOnboardingEvents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dashboardOnboardingEvents")>();
  return {
    ...actual,
    emitDashboardOnboardingState: vi.fn(),
  };
});

// Mock the telemetry client entirely so tests never touch the network or its
// batching/teardown listeners.
vi.mock("@/features/dashboard/telemetry/onboardingTelemetry", () => ({
  createOnboardingSessionUuid: vi.fn(() => "test-session-uuid"),
  recordOnboardingEvent: vi.fn(),
}));

// Mock the auth token reader so we can toggle token presence per test.
vi.mock("@/utils/authToken", () => ({
  getAuthToken: vi.fn(() => "test-token"),
  getStoredAuthToken: vi.fn(() => "test-token"),
}));

import { useDashboardOnboarding } from "@/features/dashboard/hooks/useDashboardOnboarding";
import type { DashboardOnboardingState } from "@/features/dashboard/hooks/useDashboardOnboarding";
import type { RoleKey } from "@/features/dashboard/config/dashboardOnboardingConfig";
import { emitDashboardOnboardingState } from "@/lib/dashboardOnboardingEvents";
import { getAuthToken } from "@/utils/authToken";

type UserState = DashboardOnboardingState;

const buildUser = (state: UserState, onboardingKey = "clientDashboardOnboarding") => ({
  id: 1,
  metadata: {
    preferences: {
      [onboardingKey]: state,
    },
  },
});

const lastEmitCall = () => {
  const calls = vi.mocked(emitDashboardOnboardingState).mock.calls;
  return calls[calls.length - 1]?.[0];
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthToken).mockReturnValue("test-token");
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDashboardOnboarding - replay cap", () => {
  it("treats replayCount 3 as at-cap: hides inline replay, shows settings replay", () => {
    const user = buildUser({ eligible: true, replayCount: 3 });
    const { result } = renderHook(() => useDashboardOnboarding(user, "client"));

    expect(result.current.atReplayCap).toBe(true);
    expect(result.current.shouldShowReplay).toBe(false);
    expect(result.current.shouldShowSettingsReplay).toBe(true);
  });

  it("treats replayCount 0 as below-cap: shows inline replay, hides settings replay", () => {
    const user = buildUser({ eligible: true, replayCount: 0 });
    const { result } = renderHook(() => useDashboardOnboarding(user, "client"));

    expect(result.current.atReplayCap).toBe(false);
    expect(result.current.shouldShowReplay).toBe(true);
    expect(result.current.shouldShowSettingsReplay).toBe(false);
  });

  it("treats missing replayCount as 0", () => {
    const user = buildUser({ eligible: true });
    const { result } = renderHook(() => useDashboardOnboarding(user, "client"));

    expect(result.current.replayCount).toBe(0);
    expect(result.current.atReplayCap).toBe(false);
    expect(result.current.shouldShowReplay).toBe(true);
    expect(result.current.shouldShowSettingsReplay).toBe(false);
  });
});

describe("useDashboardOnboarding - sidebar visibility emission", () => {
  // completedAt keeps welcomeOpen=false and tourOpen=false so visibility is
  // driven purely by eligibility and the replay cap.
  const completed = "2024-01-01T00:00:00Z";

  it("emits visible=true for an eligible, below-cap client role", () => {
    const user = buildUser({ eligible: true, replayCount: 0, completedAt: completed });
    renderHook(() => useDashboardOnboarding(user, "client"));

    expect(lastEmitCall()).toEqual({
      roleKey: "client",
      visible: true,
      label: "Take tour",
    });
  });

  it("emits visible=false when an eligible client role is at the replay cap", () => {
    const user = buildUser({ eligible: true, replayCount: 3, completedAt: completed });
    renderHook(() => useDashboardOnboarding(user, "client"));

    expect(lastEmitCall()).toEqual({
      roleKey: "client",
      visible: false,
      label: "Take tour",
    });
  });

  it("emits role-scoped visibility for a team role (photographer)", () => {
    const user = buildUser(
      { eligible: true, replayCount: 0, completedAt: completed },
      "photographerDashboardOnboarding",
    );
    renderHook(() => useDashboardOnboarding(user, "photographer" as RoleKey));

    expect(lastEmitCall()).toEqual({
      roleKey: "photographer",
      visible: true,
      label: "Take tour",
    });
  });
});

describe("useDashboardOnboarding - persistence merge", () => {
  it("merges against the freshest state ref so rapid saves don't clobber each other", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const user = buildUser({
      eligible: true,
      replayCount: 1,
      createdAt: "2023-12-31T00:00:00Z",
    });

    const { result } = renderHook(() => useDashboardOnboarding(user, "client"));

    // Fire saveProgress and complete back-to-back. If complete merged against a
    // stale render closure instead of the live ref, the startedAt written by
    // saveProgress would be lost in the final PUT.
    await act(async () => {
      await Promise.all([result.current.saveProgress(2), result.current.complete()]);
    });

    const putCalls = fetchMock.mock.calls.filter(([url, options]) => {
      const init = options as RequestInit | undefined;
      return String(url).endsWith("/api/profile") && init?.method === "PUT";
    });

    expect(putCalls.length).toBeGreaterThan(0);

    const lastInit = putCalls[putCalls.length - 1][1] as RequestInit;
    const body = JSON.parse(lastInit.body as string);
    const persisted = body.preferences.clientDashboardOnboarding as DashboardOnboardingState;

    // Prior field preserved across both merges.
    expect(persisted.createdAt).toBe("2023-12-31T00:00:00Z");
    expect(persisted.eligible).toBe(true);
    // replayCount carried through (not reset) and normalized.
    expect(persisted.replayCount).toBe(1);
    // startedAt set by saveProgress survives in complete's PUT (no stale clobber).
    expect(persisted.startedAt).toBeTruthy();
    // completedAt set by complete.
    expect(persisted.completedAt).toBeTruthy();
  });

  it("writes the localStorage fallback even without an auth token (no fetch)", async () => {
    vi.mocked(getAuthToken).mockReturnValue(null as unknown as string);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const user = buildUser({ eligible: true, replayCount: 0 });
    const { result } = renderHook(() => useDashboardOnboarding(user, "client"));

    await act(async () => {
      await result.current.saveProgress(1);
    });

    expect(fetchMock).not.toHaveBeenCalled();

    const stored = window.localStorage.getItem("client-dashboard-onboarding:1");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored as string) as DashboardOnboardingState;
    expect(parsed.lastStep).toBe(1);
    expect(parsed.eligible).toBe(true);
    expect(parsed.replayCount).toBe(0);
  });
});
