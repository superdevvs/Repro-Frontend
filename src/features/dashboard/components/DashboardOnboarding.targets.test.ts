import { afterEach, describe, expect, it } from "vitest";

import {
  getTargetRect,
  getVisibleTargetElement,
} from "@/features/dashboard/components/DashboardOnboarding";

type RectLike = Pick<DOMRect, "top" | "left" | "width" | "height">;

/**
 * Builds a div carrying the onboarding target marker with a stubbed layout rect.
 * jsdom returns an all-zero rect for every element, so we override
 * getBoundingClientRect explicitly to model hidden vs. laid-out elements.
 */
const makeTarget = (target: string, rect: RectLike): HTMLDivElement => {
  const el = document.createElement("div");
  el.setAttribute("data-onboarding-target", target);
  el.getBoundingClientRect = () =>
    ({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(el);
  return el;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("getVisibleTargetElement", () => {
  it("returns the laid-out element when a duplicate target has a zero rect", () => {
    // First match models the hidden (display:none) layout tree -> 0x0 rect.
    const hidden = makeTarget("client-dashboard-metrics", { top: 0, left: 0, width: 0, height: 0 });
    // Second match models the active layout tree with real dimensions.
    const visible = makeTarget("client-dashboard-metrics", {
      top: 120,
      left: 40,
      width: 320,
      height: 80,
    });

    const resolved = getVisibleTargetElement("client-dashboard-metrics");

    expect(resolved).toBe(visible);
    expect(resolved).not.toBe(hidden);
  });

  it("returns null when no element carries the target", () => {
    makeTarget("some-other-target", { top: 10, left: 10, width: 100, height: 50 });

    expect(getVisibleTargetElement("absent-target")).toBeNull();
  });

  it("returns null when the only match has a zero rect", () => {
    makeTarget("client-dashboard-shoots", { top: 0, left: 0, width: 0, height: 0 });

    expect(getVisibleTargetElement("client-dashboard-shoots")).toBeNull();
  });
});

describe("getTargetRect", () => {
  it("returns the rect of the laid-out element among duplicates", () => {
    makeTarget("client-dashboard-invoices", { top: 0, left: 0, width: 0, height: 0 });
    makeTarget("client-dashboard-invoices", { top: 200, left: 16, width: 280, height: 96 });

    expect(getTargetRect("client-dashboard-invoices")).toEqual({
      top: 200,
      left: 16,
      width: 280,
      height: 96,
    });
  });

  it("returns null for an absent target", () => {
    expect(getTargetRect("absent-target")).toBeNull();
  });
});
