import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardOnboarding } from "@/features/dashboard/components/DashboardOnboarding";
import { dashboardOnboardingConfig } from "@/features/dashboard/config/dashboardOnboardingConfig";

afterEach(() => {
  cleanup();
});

describe("DashboardOnboarding tour layer", () => {
  it("renders the client tour outside the page so overflow and transforms cannot clip it", () => {
    const { container } = render(
      <div data-testid="clipping-page" style={{ overflow: "hidden", transform: "translateX(0px)" }}>
        <DashboardOnboarding
          roleKey="client"
          steps={dashboardOnboardingConfig.client.steps}
          copy={dashboardOnboardingConfig.client.copy}
          welcomeOpen={false}
          tourOpen
          isMobile={false}
          lastStep={0}
          onStart={vi.fn()}
          onDismiss={vi.fn()}
          onComplete={vi.fn()}
          onProgress={vi.fn()}
          onReplay={vi.fn()}
        />
      </div>,
    );

    const step = screen.getByRole("heading", { name: "Start with your snapshot" });
    expect(container.querySelector("[data-testid=clipping-page]")?.contains(step)).toBe(false);
    expect(step.closest("body")).toBe(document.body);
  });
});
