import React, { Suspense, lazy, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PendingReviewsCard } from "@/components/dashboard/v2/PendingReviewsCard";
import { UpcomingShootsCard } from "@/components/dashboard/v2/UpcomingShootsCard";
import { CompletedShootsCardSkeleton } from "@/components/dashboard/v2/CompletedShootsCardSkeleton";
import { useAuth } from "@/components/auth";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { WeatherInfo } from "@/services/weatherService";
import type { DashboardClientRequest, DashboardShootSummary } from "@/types/dashboard";

import { RoleDashboardLayout } from "../components/RoleDashboardLayout";
import { DashboardOnboarding } from "../components/DashboardOnboarding";
import { dashboardOnboardingConfig } from "../config/dashboardOnboardingConfig";
import { useDashboardOnboarding } from "../hooks/useDashboardOnboarding";

const LazyCompletedShootsCard = lazy(() =>
  import("@/components/dashboard/v2/CompletedShootsCard").then((module) => ({
    default: module.CompletedShootsCard,
  })),
);

interface PhotographerDashboardViewProps {
  clientRequests: DashboardClientRequest[];
  clientRequestsLoading: boolean;
  greetingTitleFullName: React.ReactNode;
  photographerDelivered: DashboardShootSummary[];
  photographerPendingReviews: DashboardShootSummary[];
  photographerUpcoming: DashboardShootSummary[];
  shootDetailsModal: React.ReactNode;
  onSelectShoot: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
}

export const PhotographerDashboardView = ({
  clientRequests,
  clientRequestsLoading,
  greetingTitleFullName,
  photographerDelivered,
  photographerPendingReviews,
  photographerUpcoming,
  shootDetailsModal,
  onSelectShoot,
}: PhotographerDashboardViewProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Mirror RoleDashboardLayout's compact breakpoint so the tour and the
  // controlled mobile tabs stay in sync with the rendered layout.
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [mobileTab, setMobileTab] = useState<string>("shoots");
  const onboarding = useDashboardOnboarding(user, "photographer");

  const upcomingCard = (
    <UpcomingShootsCard
      shoots={photographerUpcoming}
      onSelect={(shoot, weather) => onSelectShoot(shoot, weather)}
      role="photographer"
    />
  );

  const completedCard = (
    <Suspense fallback={<CompletedShootsCardSkeleton />}>
      <LazyCompletedShootsCard
        shoots={photographerDelivered}
        title="Completed shoots"
        subtitle="Ready for clients"
        emptyStateText="No completed shoots yet."
        onSelect={(shoot) => onSelectShoot(shoot)}
        onViewAll={() => navigate("/shoot-history?tab=delivered")}
      />
    </Suspense>
  );

  const requestsCard = (
    <div id="requests-queue" data-onboarding-target="photographer-requests">
      <PendingReviewsCard
        reviews={[]}
        issues={[]}
        onSelect={(shoot) => onSelectShoot(shoot)}
        emptyRequestsText="No active requests."
        title="Requests"
        clientRequests={clientRequests}
        clientRequestsLoading={clientRequestsLoading}
        showClientTab
      />
    </div>
  );

  const photographerMobileTabs = [
    {
      id: "shoots",
      label: "Shoots",
      content: (
        <div data-onboarding-target="photographer-upcoming-shoots">{upcomingCard}</div>
      ),
    },
    {
      id: "requests",
      label: "Requests",
      content: requestsCard,
    },
    {
      id: "completed",
      label: "Completed",
      content: (
        <div data-onboarding-target="photographer-completed">{completedCard}</div>
      ),
    },
  ] as const;

  return (
    <>
      <RoleDashboardLayout
        title={greetingTitleFullName}
        description="Field schedule, uploads, and delivery milestones."
        hideLeftColumn
        leftColumnCard={null}
        rightColumnCards={[
          <div key="completed-shoots" data-onboarding-target="photographer-completed">
            {completedCard}
          </div>,
        ]}
        upcomingShoots={photographerUpcoming}
        upcomingOnboardingTarget="photographer-upcoming-shoots"
        pendingReviews={photographerPendingReviews}
        pendingCard={requestsCard}
        onSelectShoot={onSelectShoot}
        role="photographer"
        mobileTab={mobileTab}
        onMobileTabChange={setMobileTab}
        mobileTabs={photographerMobileTabs.map((tab) => ({ ...tab }))}
      />
      <DashboardOnboarding
        roleKey="photographer"
        steps={dashboardOnboardingConfig.photographer.steps}
        copy={dashboardOnboardingConfig.photographer.copy}
        welcomeOpen={onboarding.welcomeOpen}
        tourOpen={onboarding.tourOpen}
        isMobile={isMobile}
        currentMobileTab={mobileTab}
        lastStep={onboarding.onboardingState.lastStep}
        onStart={onboarding.startTour}
        onDismiss={onboarding.dismiss}
        onComplete={(lastStep) => onboarding.complete({ lastStep })}
        onProgress={onboarding.saveProgress}
        onReplay={onboarding.replay}
        onSetMobileTab={setMobileTab}
        onStepView={onboarding.recordStepView}
        onStepBack={onboarding.recordStepBack}
        onHelpOpened={onboarding.recordHelpOpened}
        onHelpMessage={onboarding.recordHelpMessage}
      />
      {shootDetailsModal}
    </>
  );
};
