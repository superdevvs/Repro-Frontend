import type { HoldRequestsState } from "@/features/dashboard/hooks/useHoldRequests";
import type { RescheduleRequestsState } from "@/features/dashboard/hooks/useRescheduleRequests";
import React, { Suspense, lazy, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, MessageCircle, Users } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useMediaQuery } from "@/hooks/use-media-query";
import { PendingReviewsCard } from "@/components/dashboard/v2/PendingReviewsCard";
import { ShootsTabsCard } from "@/components/dashboard/v2/ShootsTabsCard";
import { CompletedShootsCardSkeleton } from "@/components/dashboard/v2/CompletedShootsCardSkeleton";
import { AssignPhotographersCardSkeleton } from "@/components/dashboard/v2/AssignPhotographersCardSkeleton";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type { DashboardMetricTile } from "@/components/dashboard/v2/RoleMetricTilesCard";
import type {
  DashboardCancellationItem,
  DashboardClientRequest,
  DashboardPhotographerSummary,
  DashboardShootSummary,
} from "@/types/dashboard";
import type { EditingRequest } from "@/services/editingRequestService";
import type { WeatherInfo } from "@/services/weatherService";

import { DashboardOnboarding } from "../components/DashboardOnboarding";
import { RoleDashboardLayout } from "../components/RoleDashboardLayout";
import { dashboardOnboardingConfig } from "../config/dashboardOnboardingConfig";
import { useDashboardOnboarding } from "../hooks/useDashboardOnboarding";

const LazyAssignPhotographersCard = lazy(() =>
  import("@/components/dashboard/v2/AssignPhotographersCard").then((module) => ({
    default: module.AssignPhotographersCard,
  })),
);

const LazyCompletedShootsCard = lazy(() =>
  import("@/components/dashboard/v2/CompletedShootsCard").then((module) => ({
    default: module.CompletedShootsCard,
  })),
);

interface SalesDashboardViewProps {
  availablePhotographerIds: number[];
  availabilityError: string | null;
  availabilityLoading: boolean;
  availabilityWindow: {
    date: string;
    start_time: string;
    end_time: string;
  };
  holdRequests?: HoldRequestsState;
  rescheduleRequests?: RescheduleRequestsState;
  cancellationShoots: DashboardCancellationItem[];
  clientRequests: DashboardClientRequest[];
  clientRequestsLoading: boolean;
  editingRequests: EditingRequest[];
  editingRequestsLoading: boolean;
  greetingTitleFullName: React.ReactNode;
  photographers: DashboardPhotographerSummary[];
  pendingReviews: DashboardShootSummary[];
  repDelivered: DashboardShootSummary[];
  repPendingReviews: DashboardShootSummary[];
  repUpcoming: DashboardShootSummary[];
  requestedShoots: DashboardShootSummary[];
  requestedShootsLoading: boolean;
  requestedShootsError?: string;
  onReloadRequestedShoots: () => void;
  requestedShootModals: React.ReactNode;
  onApproveShoot: (shoot: DashboardShootSummary) => void;
  onDeclineShoot: (shoot: DashboardShootSummary) => void;
  onModifyShoot: (shoot: DashboardShootSummary) => void;
  salesMetricTiles: DashboardMetricTile[];
  shootDetailsModal: React.ReactNode;
  shouldLoadEditingRequests: boolean;
  onApproveCancellation: (shootId: number, decision?: 'charge_fee' | 'waive_fee') => Promise<void>;
  onRejectCancellation: (shootId: number) => Promise<void>;
  onSelectShoot: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
  onSetAvailabilityWindow: (value: { date: string; start_time: string; end_time: string }) => void;
  onSetSelectedPhotographer: (photographer: DashboardPhotographerSummary | null) => void;
  onCreateEditingRequest: () => void;
  onEditingRequestClick: (requestId: number) => void;
}

export const SalesDashboardView = ({
  availablePhotographerIds,
  availabilityError,
  availabilityLoading,
  availabilityWindow,
  holdRequests,
  rescheduleRequests,
  cancellationShoots,
  clientRequests,
  clientRequestsLoading,
  editingRequests,
  editingRequestsLoading,
  greetingTitleFullName,
  photographers,
  pendingReviews,
  repDelivered,
  repPendingReviews,
  repUpcoming,
  requestedShoots,
  requestedShootsError,
  onReloadRequestedShoots,
  requestedShootModals,
  onApproveShoot,
  onDeclineShoot,
  onModifyShoot,
  salesMetricTiles,
  shootDetailsModal,
  shouldLoadEditingRequests,
  onApproveCancellation,
  onRejectCancellation,
  onSelectShoot,
  onSetAvailabilityWindow,
  onSetSelectedPhotographer,
  onCreateEditingRequest,
  onEditingRequestClick,
}: SalesDashboardViewProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCompactDashboardViewport = useMediaQuery("(max-width: 1024px)");
  const [mobileTab, setMobileTab] = useState("shoots");
  const salesOnboarding = useDashboardOnboarding(user, "salesRep");
  const clientRequestCount = clientRequests.filter((request) =>
    ['open', 'in-progress', 'in_progress'].includes(request.status),
  ).length;
  const pendingRequestCount = pendingReviews.length + clientRequestCount + cancellationShoots.length
    + (holdRequests?.shoots.length ?? 0) + (rescheduleRequests?.pendingCount ?? 0);
  const salesRepRequestsCard = (
    <div id="requests-queue" data-onboarding-target="salesrep-requests">
      <PendingReviewsCard
        reviews={pendingReviews}
        issues={[]}
        onSelect={(shoot) => onSelectShoot(shoot)}
        emptyRequestsText="No active requests."
        title="Requests"
        editingRequests={editingRequests}
        editingRequestsLoading={editingRequestsLoading}
        onCreateEditingRequest={onCreateEditingRequest}
        onEditingRequestClick={onEditingRequestClick}
        showEditingTab={shouldLoadEditingRequests}
        clientRequests={clientRequests}
        clientRequestsLoading={clientRequestsLoading}
        showClientTab
        holdRequests={holdRequests}
        rescheduleRequests={rescheduleRequests}
        cancellationShoots={cancellationShoots}
        showCancellationTab
        onApproveCancellation={onApproveCancellation}
        onRejectCancellation={onRejectCancellation}
      />
    </div>
  );

  const assignCard = (
    <ErrorBoundary
      fallback={
        <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Unable to load photographers
        </div>
      }
    >
      <div
        id="assign-card"
        data-onboarding-target="salesrep-assign"
        className="h-full flex flex-col"
      >
        <Suspense fallback={<AssignPhotographersCardSkeleton />}>
          <LazyAssignPhotographersCard
            initialTab="all"
            photographers={photographers}
            onPhotographerSelect={onSetSelectedPhotographer}
            onViewSchedule={() => navigate("/availability")}
            availablePhotographerIds={availablePhotographerIds}
            availabilityWindow={availabilityWindow}
            onAvailabilityWindowChange={onSetAvailabilityWindow}
            availabilityLoading={availabilityLoading}
            availabilityError={availabilityError}
          />
        </Suspense>
      </div>
    </ErrorBoundary>
  );

  const deliveredCard = (
    <div
      key="rep-delivered"
      data-onboarding-target="salesrep-delivered"
      className="flex flex-1 min-h-0"
    >
      <Suspense fallback={<CompletedShootsCardSkeleton />}>
        <LazyCompletedShootsCard
          shoots={repDelivered}
          title="Delivered shoots"
          subtitle="Most recent handoffs"
          emptyStateText="No delivered shoots yet."
          onSelect={(shoot) => onSelectShoot(shoot)}
          onViewAll={() => navigate("/shoot-history?tab=delivered")}
          stretch
        />
      </Suspense>
    </div>
  );

  const shootsCard = (
    <>
      {requestedShootsError ? (
        <div role="alert" className="mb-3 rounded-2xl border p-4 text-sm">
          <p>Unable to load requested shoots.</p>
          <button className="mt-2 underline" onClick={onReloadRequestedShoots}>Retry</button>
        </div>
      ) : null}
      <ShootsTabsCard
        upcomingShoots={repUpcoming.filter((shoot) => (shoot.workflowStatus || shoot.status) !== 'requested')}
        requestedShoots={requestedShoots}
        onSelect={onSelectShoot}
        onApprove={onApproveShoot}
        onDecline={onDeclineShoot}
        onModify={onModifyShoot}
        role="salesRep"
      />
    </>
  );

  const salesMobileTabs = [
    {
      id: "shoots",
      label: "Shoots",
      icon: Camera,
      content: (
        <div data-onboarding-target="salesrep-upcoming">
          {shootsCard}
        </div>
      ),
    },
    {
      id: "assign",
      label: "Assign",
      icon: Users,
      content: assignCard,
    },
    {
      id: "requests",
      label: "Requests",
      icon: MessageCircle,
      content: salesRepRequestsCard,
    },
    {
      id: "completed",
      label: "Completed",
      icon: CheckCircle2,
      content: deliveredCard,
    },
  ];

  return (
    <>
      <RoleDashboardLayout
        title={greetingTitleFullName}
        description="Assign coverage, monitor reviews, and close the loop."
        metricTiles={salesMetricTiles}
        collapsibleColumns
        pendingIndicatorCount={pendingRequestCount}
        metricsOnboardingTarget="salesrep-metrics"
        upcomingOnboardingTarget="salesrep-upcoming"
        pendingOnboardingTarget="salesrep-requests"
        leftColumnCard={assignCard}
        rightColumnCards={[deliveredCard]}
        upcomingShoots={repUpcoming}
        upcomingCard={shootsCard}
        pendingReviews={repPendingReviews}
        pendingCard={salesRepRequestsCard}
        onSelectShoot={onSelectShoot}
        mobileTab={mobileTab}
        onMobileTabChange={setMobileTab}
        mobileTabs={salesMobileTabs}
      />
      <DashboardOnboarding
        roleKey="salesRep"
        steps={dashboardOnboardingConfig.salesRep.steps}
        copy={dashboardOnboardingConfig.salesRep.copy}
        welcomeOpen={salesOnboarding.welcomeOpen}
        tourOpen={salesOnboarding.tourOpen}
        isMobile={isCompactDashboardViewport}
        currentMobileTab={mobileTab}
        onSetMobileTab={setMobileTab}
        lastStep={salesOnboarding.onboardingState.lastStep}
        onStart={salesOnboarding.startTour}
        onDismiss={salesOnboarding.dismiss}
        onComplete={(lastStep) => salesOnboarding.complete({ lastStep })}
        onProgress={salesOnboarding.saveProgress}
        onReplay={salesOnboarding.replay}
        onStepView={salesOnboarding.recordStepView}
        onStepBack={salesOnboarding.recordStepBack}
        onHelpOpened={salesOnboarding.recordHelpOpened}
        onHelpMessage={salesOnboarding.recordHelpMessage}
      />
      {shootDetailsModal}
      {requestedShootModals}
    </>
  );
};
