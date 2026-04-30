import React, { Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";

import { PendingReviewsCard } from "@/components/dashboard/v2/PendingReviewsCard";
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

import { RoleDashboardLayout } from "../components/RoleDashboardLayout";

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
  salesMetricTiles: DashboardMetricTile[];
  shootDetailsModal: React.ReactNode;
  shouldLoadEditingRequests: boolean;
  onApproveCancellation: (shootId: number) => Promise<void>;
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
  const salesRepRequestsCard = (
    <div id="requests-queue">
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
        cancellationShoots={cancellationShoots}
        showCancellationTab
        onApproveCancellation={onApproveCancellation}
        onRejectCancellation={onRejectCancellation}
      />
    </div>
  );

  return (
    <>
      <RoleDashboardLayout
        title={greetingTitleFullName}
        description="Assign coverage, monitor reviews, and close the loop."
        metricTiles={salesMetricTiles}
        leftColumnCard={
          <ErrorBoundary
            fallback={
              <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Unable to load photographers
              </div>
            }
          >
            <div id="assign-card" className="h-full flex flex-col">
              <Suspense fallback={<AssignPhotographersCardSkeleton />}>
                <LazyAssignPhotographersCard
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
        }
        rightColumnCards={[
          <div key="rep-delivered" className="flex flex-1 min-h-0">
            <Suspense fallback={<CompletedShootsCardSkeleton />}>
              <LazyCompletedShootsCard
                shoots={repDelivered}
                title="Delivered shoots"
                subtitle="Most recent handoffs"
                emptyStateText="No delivered shoots yet."
                onViewAll={() => navigate("/shoot-history?tab=delivered")}
                stretch
              />
            </Suspense>
          </div>,
        ]}
        upcomingShoots={repUpcoming}
        pendingReviews={repPendingReviews}
        pendingCard={salesRepRequestsCard}
        onSelectShoot={onSelectShoot}
      />
      {shootDetailsModal}
    </>
  );
};
