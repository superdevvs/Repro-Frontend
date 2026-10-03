import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhotographerDashboardView } from "./PhotographerDashboardView";
import { PhotographerHelpProvider } from "../components/PhotographerHelpProvider";
import { photographerUploadGuide as guide } from "../config/photographerUploadGuide";

vi.mock("@/components/auth", () => ({ useAuth: () => ({ user: { id: "42", role: "photographer" } }) }));
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/hooks/usePermission", () => ({ usePermission: () => ({ can: () => true, isLoading: false }) }));
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
    <PhotographerHelpProvider enabled userId="42">
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
    </PhotographerHelpProvider>
  </MemoryRouter>);
}

describe("photographer dashboard help hub upload guide", () => {
  it("opens an email deep link through the shared provider and preserves unrelated parameters on close", async () => {
    renderDashboard("/dashboard?guide=uploads&view=compact");
    expect(await screen.findByLabelText(guide.title, { selector: "video" })).toHaveAttribute("src", guide.video);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?view=compact"));
    expect(screen.queryByLabelText(guide.title, { selector: "video" })).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "How can we help?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close help panel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Need help?" })).toBeVisible();
  });

  it("replaces the top shortcut with Need help and opens the upload guide without upcoming shoots or active onboarding", async () => {
    renderDashboard("/dashboard");
    expect(within(screen.getByRole("main")).queryByRole("button", { name: "Upload guide" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(guide.title, { selector: "video" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Need help?" }));
    expect(screen.getByRole("dialog", { name: "How can we help?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Upload shoot media/ }));
    expect(await screen.findByLabelText(guide.title, { selector: "video" })).toHaveAttribute("src", guide.video);
    expect(screen.queryByRole("dialog", { name: "How can we help?" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?guide=uploads");
  });
});
