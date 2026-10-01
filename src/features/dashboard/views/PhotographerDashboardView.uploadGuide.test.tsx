import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhotographerDashboardView } from "./PhotographerDashboardView";
import { photographerUploadGuide as guide } from "../config/photographerUploadGuide";

vi.mock("@/components/auth", () => ({ useAuth: () => ({ user: { id: "42", role: "photographer" } }) }));
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/components/dashboard/v2/PendingReviewsCard", () => ({ PendingReviewsCard: () => null }));
vi.mock("@/components/dashboard/v2/UpcomingShootsCard", () => ({ UpcomingShootsCard: () => <div>Assigned shoots</div> }));
vi.mock("../components/RoleDashboardLayout", () => ({
  RoleDashboardLayout: ({ upcomingCard }: { upcomingCard: React.ReactNode }) => <main>{upcomingCard}</main>,
}));
vi.mock("../hooks/useDashboardOnboarding", () => ({
  useDashboardOnboarding: () => ({ welcomeOpen: false, tourOpen: false, onboardingState: {},
    startTour: vi.fn(), dismiss: vi.fn(), complete: vi.fn(), saveProgress: vi.fn(), replay: vi.fn(),
  }),
}));

afterEach(cleanup);

function LocationStatus() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname}{location.search}</output>;
}

function renderDashboard(entry: string) {
  return render(<MemoryRouter initialEntries={[entry]}>
    <LocationStatus />
    <PhotographerDashboardView
      clientRequests={[]}
      clientRequestsLoading={false}
      greetingTitleFullName="Hello, photographer"
      photographerDelivered={[]}
      photographerPendingReviews={[]}
      photographerUpcoming={[]}
      shootDetailsModal={null}
      onSelectShoot={vi.fn()}
    />
  </MemoryRouter>);
}

describe("photographer dashboard upload guide", () => {
  it("opens an email deep link and removes only its query parameter when closed", async () => {
    renderDashboard("/dashboard?guide=uploads&view=compact");
    expect(screen.getByLabelText(guide.title, { selector: "video" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?view=compact"));
    expect(screen.queryByLabelText(guide.title, { selector: "video" })).not.toBeInTheDocument();
  });

  it("keeps a replay entry available without any upcoming shoots or active onboarding", () => {
    renderDashboard("/dashboard");
    expect(screen.queryByLabelText(guide.title, { selector: "video" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload guide" }));
    expect(screen.getByLabelText(guide.title, { selector: "video" })).toBeInTheDocument();
  });
});
