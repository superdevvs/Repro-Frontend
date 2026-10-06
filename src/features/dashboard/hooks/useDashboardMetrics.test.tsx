import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAdminDashboardMetrics } from "./useDashboardMetrics";

const navigate = vi.fn();
const scrollToDashboardSection = vi.fn(() => true);
const setMobileDashboardTab = vi.fn();

const baseArgs = {
  cancellationRequestCount: 2,
  clientRequests: [],
  editingRequests: [],
  holdRequestCount: 1,
  rescheduleRequestCount: 1,
  isMobile: false,
  navigate,
  scrollToDashboardSection,
  setMobileDashboardTab,
};

describe("useAdminDashboardMetrics", () => {
  it("wires Total shoots / Total deliveries / Cancelled shoots to overview month stats", () => {
    const { result } = renderHook(() =>
      useAdminDashboardMetrics({
        ...baseArgs,
        overviewLoading: false,
        overviewStats: {
          shootsThisMonth: 12,
          deliveriesThisMonth: 7,
          cancelledThisMonth: 3,
        },
      }),
    );

    const byId = Object.fromEntries(result.current.map((tile) => [tile.id, tile]));
    expect(byId["admin-total-shoots-month"]).toMatchObject({
      value: 12,
      label: "Total shoots",
      subtitle: "This month",
    });
    expect(byId["admin-total-deliveries-month"]).toMatchObject({
      value: 7,
      label: "Total deliveries",
      subtitle: "This month",
    });
    expect(byId["admin-cancelled-shoots"]).toMatchObject({
      value: 3,
      label: "Cancelled shoots",
      subtitle: "This month",
    });
    expect(byId["admin-pending-requests"].value).toBe(4);
  });

  it("shows the empty placeholder while overview is loading or a month key is null", () => {
    const loading = renderHook(() =>
      useAdminDashboardMetrics({
        ...baseArgs,
        overviewLoading: true,
        overviewStats: null,
      }),
    ).result.current;
    expect(loading.find((tile) => tile.id === "admin-total-shoots-month")?.value).toBe("—");
    expect(loading.find((tile) => tile.id === "admin-total-deliveries-month")?.value).toBe("—");
    expect(loading.find((tile) => tile.id === "admin-cancelled-shoots")?.value).toBe("—");
    expect(loading.find((tile) => tile.id === "admin-pending-requests")?.value).toBe(4);

    const missingKeys = renderHook(() =>
      useAdminDashboardMetrics({
        ...baseArgs,
        overviewLoading: false,
        overviewStats: {
          shootsThisMonth: null,
          deliveriesThisMonth: null,
          cancelledThisMonth: null,
        },
      }),
    ).result.current;
    expect(missingKeys.find((tile) => tile.id === "admin-total-shoots-month")?.value).toBe("—");
    expect(missingKeys.find((tile) => tile.id === "admin-total-deliveries-month")?.value).toBe("—");
    expect(missingKeys.find((tile) => tile.id === "admin-cancelled-shoots")?.value).toBe("—");
  });

  it("does not invent month counts from shoot lists when overview stats are absent", () => {
    const { result } = renderHook(() =>
      useAdminDashboardMetrics({
        ...baseArgs,
        overviewLoading: false,
        overviewStats: null,
      }),
    );

    const monthTiles = result.current.filter((tile) =>
      ["admin-total-shoots-month", "admin-total-deliveries-month", "admin-cancelled-shoots"].includes(
        tile.id,
      ),
    );
    expect(monthTiles.every((tile) => tile.value === "—")).toBe(true);
  });
});
