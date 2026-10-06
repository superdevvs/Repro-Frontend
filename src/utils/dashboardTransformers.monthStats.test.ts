import { describe, expect, it } from "vitest";

import { transformDashboardOverview } from "./dashboardTransformers";
import type { DashboardOverviewResponse } from "@/types/dashboard";

const baseResponse = {
  stats: {
    total_shoots: 10,
    scheduled_today: 2,
    flagged_shoots: 1,
    pending_reviews: 0,
  },
  upcoming_shoots: [],
  photographers: [],
  pending_reviews: [],
  activity_log: [],
  issues: [],
  workflow: { columns: [] },
} as DashboardOverviewResponse;

describe("transformDashboardOverview month stats", () => {
  it("maps shoots_this_month / deliveries_this_month / cancelled_this_month when present", () => {
    const result = transformDashboardOverview({
      ...baseResponse,
      stats: {
        ...baseResponse.stats,
        shoots_this_month: 12,
        deliveries_this_month: 7,
        cancelled_this_month: 3,
      },
    });
    expect(result.stats.shootsThisMonth).toBe(12);
    expect(result.stats.deliveriesThisMonth).toBe(7);
    expect(result.stats.cancelledThisMonth).toBe(3);
  });

  it("keeps month keys null when the live backend omits them", () => {
    const result = transformDashboardOverview(baseResponse);
    expect(result.stats.shootsThisMonth).toBeNull();
    expect(result.stats.deliveriesThisMonth).toBeNull();
    expect(result.stats.cancelledThisMonth).toBeNull();
  });
});
