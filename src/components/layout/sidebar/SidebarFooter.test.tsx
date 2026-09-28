import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { SidebarFooter } from "@/components/layout/sidebar/SidebarFooter";
import { emitDashboardOnboardingState } from "@/lib/dashboardOnboardingEvents";

const LocationProbe = () => {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
};

const renderFooter = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <SidebarFooter isCollapsed={false} logout={() => undefined} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe("SidebarFooter Take tour", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("keeps the client Take tour click and opens the dashboard from another page", () => {
    emitDashboardOnboardingState({
      roleKey: "client",
      visible: true,
      label: "Take tour",
    });

    renderFooter("/shoot-history");

    const button = screen.getByRole("button", { name: "Take tour" });
    expect(button.hasAttribute("data-onboarding-replay")).toBe(true);
    fireEvent.click(button);

    expect(window.sessionStorage.getItem("dashboard-onboarding-pending-replay")).toBe("client");
    expect(screen.getByTestId("location").textContent).toBe("/dashboard");
  });
});
