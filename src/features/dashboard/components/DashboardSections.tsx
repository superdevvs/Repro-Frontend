import React, { Suspense, lazy } from "react";

import { cn } from "@/lib/utils";
import { UpcomingShootsCard } from "@/components/dashboard/v2/UpcomingShootsCard";
import { PendingReviewsCard } from "@/components/dashboard/v2/PendingReviewsCard";
import { UpcomingShootsCardSkeleton } from "@/components/dashboard/v2/UpcomingShootsCardSkeleton";
import { PendingReviewsCardSkeleton } from "@/components/dashboard/v2/PendingReviewsCardSkeleton";
import { CompletedShootsCardSkeleton } from "@/components/dashboard/v2/CompletedShootsCardSkeleton";
import { AssignPhotographersCardSkeleton } from "@/components/dashboard/v2/AssignPhotographersCardSkeleton";
import { EditingRequestsCardSkeletonWrapper } from "@/components/dashboard/v2/EditingRequestsCardSkeletonWrapper";
import { ProductionWorkflowBoardSkeleton } from "@/components/dashboard/v2/ProductionWorkflowBoardSkeleton";
import { RequestedShootsCardSkeleton } from "@/components/dashboard/v2/RequestedShootsCardSkeleton";
import { RequestedShootsSection } from "@/components/dashboard/v2/RequestedShootsSection";
import { ShootsTabsCard } from "@/components/dashboard/v2/ShootsTabsCard";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type {
  DashboardCancellationItem,
  DashboardClientRequest,
  DashboardPhotographerSummary,
  DashboardShootSummary,
  DashboardWorkflow,
} from "@/types/dashboard";
import type { EditingRequest, EditingRequestUpdatePayload } from "@/services/editingRequestService";

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

const LazyProductionWorkflowBoard = lazy(() =>
  import("@/components/dashboard/v2/ProductionWorkflowBoard").then((module) => ({
    default: module.ProductionWorkflowBoard,
  })),
);

const LazyEditingRequestsCard = lazy(() =>
  import("@/components/dashboard/EditingRequestsCard").then((module) => ({
    default: module.EditingRequestsCard,
  })),
);

type PipelineFilter = "today" | "this_week" | "month";

interface DashboardSectionsParams {
  assignPhotographers: DashboardPhotographerSummary[];
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
  deliveredShoots: DashboardShootSummary[];
  editingManagerReadyToDeliverShoots: DashboardShootSummary[];
  editingManagerScheduledShoots: DashboardShootSummary[];
  editingManagerUpcomingShoots: DashboardShootSummary[];
  editingManagerUploadedShoots: DashboardShootSummary[];
  editingRequests: EditingRequest[];
  editingRequestsLoading: boolean;
  filteredWorkflow: DashboardWorkflow | null;
  isAdminExperience: boolean;
  loading: boolean;
  overviewDataAvailable: boolean;
  pendingReviews: DashboardShootSummary[];
  pipelineFilter: PipelineFilter;
  requestedShoots: DashboardShootSummary[];
  role: string;
  shouldLoadEditingRequests: boolean;
  upcomingShootsWithoutRequested: DashboardShootSummary[];
  canViewContactActions: boolean;
  handleAdvanceStage: (shoot: DashboardShootSummary) => void | Promise<void>;
  handleApproveCancellation: (shootId: number) => Promise<void>;
  handleRejectCancellation: (shootId: number) => Promise<void>;
  handleSelectShoot: (shoot: DashboardShootSummary) => void;
  handleViewInvoice: (shoot: DashboardShootSummary) => void | Promise<void>;
  navigate: (path: string) => void;
  removeEditingRequest?: (id: number) => Promise<void>;
  setApprovalModalShoot: (shoot: DashboardShootSummary | null) => void;
  setAvailabilityWindow: (window: { date: string; start_time: string; end_time: string }) => void;
  setDeclineModalShoot: (shoot: DashboardShootSummary | null) => void;
  setEditModalShoot: (shoot: DashboardShootSummary | null) => void;
  setPipelineFilter: (filter: PipelineFilter) => void;
  setSelectedPhotographer: (photographer: DashboardPhotographerSummary) => void;
  setSelectedRequestId: (requestId: number | null) => void;
  setSpecialRequestOpen: (open: boolean) => void;
  updateEditingRequest: (id: number, payload: EditingRequestUpdatePayload) => Promise<void>;
}

export const useDashboardSections = ({
  assignPhotographers,
  availablePhotographerIds,
  availabilityError,
  availabilityLoading,
  availabilityWindow,
  cancellationShoots,
  clientRequests,
  clientRequestsLoading,
  deliveredShoots,
  editingManagerReadyToDeliverShoots,
  editingManagerScheduledShoots,
  editingManagerUpcomingShoots,
  editingManagerUploadedShoots,
  editingRequests,
  editingRequestsLoading,
  filteredWorkflow,
  isAdminExperience,
  loading,
  overviewDataAvailable,
  pendingReviews,
  pipelineFilter,
  requestedShoots,
  role,
  shouldLoadEditingRequests,
  upcomingShootsWithoutRequested,
  canViewContactActions,
  handleAdvanceStage,
  handleApproveCancellation,
  handleRejectCancellation,
  handleSelectShoot,
  handleViewInvoice,
  navigate,
  removeEditingRequest,
  setApprovalModalShoot,
  setAvailabilityWindow,
  setDeclineModalShoot,
  setEditModalShoot,
  setPipelineFilter,
  setSelectedPhotographer,
  setSelectedRequestId,
  setSpecialRequestOpen,
  updateEditingRequest,
}: DashboardSectionsParams) => {
  const renderAssignPhotographersCard = () => (
    <ErrorBoundary
      fallback={
        <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Unable to load photographers
        </div>
      }
    >
      <Suspense fallback={<AssignPhotographersCardSkeleton />}>
        <LazyAssignPhotographersCard
          photographers={assignPhotographers}
          onPhotographerSelect={setSelectedPhotographer}
          onViewSchedule={() => navigate("/availability")}
          availablePhotographerIds={availablePhotographerIds}
          availabilityWindow={availabilityWindow}
          onAvailabilityWindowChange={setAvailabilityWindow}
          availabilityLoading={availabilityLoading}
          availabilityError={availabilityError}
          showContactActions={canViewContactActions}
        />
      </Suspense>
    </ErrorBoundary>
  );

  const renderUpcomingCard = () =>
    loading && !overviewDataAvailable ? (
      <UpcomingShootsCardSkeleton />
    ) : (
      <UpcomingShootsCard
        shoots={upcomingShootsWithoutRequested}
        onSelect={handleSelectShoot}
        onViewInvoice={handleViewInvoice}
        role={role}
      />
    );

  const renderPendingReviewsCard = () =>
    loading && !overviewDataAvailable ? (
      <PendingReviewsCardSkeleton />
    ) : (
      <div id="requests-queue">
        <PendingReviewsCard
          reviews={pendingReviews}
          issues={[]}
          onSelect={(shoot) => handleSelectShoot(shoot)}
          emptyRequestsText="No active requests."
          title="Requests"
          editingRequests={editingRequests}
          editingRequestsLoading={editingRequestsLoading}
          onCreateEditingRequest={() => {
            setSelectedRequestId(null);
            setSpecialRequestOpen(true);
          }}
          onEditingRequestClick={(requestId) => {
            setSelectedRequestId(requestId);
            setSpecialRequestOpen(true);
          }}
          showEditingTab={shouldLoadEditingRequests}
          clientRequests={clientRequests}
          clientRequestsLoading={clientRequestsLoading}
          showClientTab={isAdminExperience}
          cancellationShoots={cancellationShoots}
          showCancellationTab={isAdminExperience}
          onApproveCancellation={handleApproveCancellation}
          onRejectCancellation={handleRejectCancellation}
        />
      </div>
    );

  const renderCompletedShootsCard = ({ stretch = false }: { stretch?: boolean } = {}) => (
    <Suspense fallback={<CompletedShootsCardSkeleton />}>
      <LazyCompletedShootsCard
        shoots={deliveredShoots}
        stretch={stretch}
        onSelect={handleSelectShoot}
        onViewInvoice={handleViewInvoice}
        onViewAll={() => navigate("/shoot-history?tab=delivered")}
      />
    </Suspense>
  );

  const renderEditingManagerReadyToDeliverCard = () => (
    <div id="ready-to-deliver">
      <Suspense fallback={<CompletedShootsCardSkeleton />}>
        <LazyCompletedShootsCard
          shoots={editingManagerReadyToDeliverShoots.slice(0, 6)}
          title="Ready to deliver"
          subtitle="Shoots with ready status"
          emptyStateText="No ready shoots waiting for delivery."
          ctaLabel="View all shoots"
          onSelect={handleSelectShoot}
          onViewInvoice={handleViewInvoice}
          onViewAll={() => navigate("/shoot-history")}
        />
      </Suspense>
    </div>
  );

  const renderEditingRequestsCard = () =>
    shouldLoadEditingRequests ? (
      <div id="editing-requests">
        <Suspense fallback={<EditingRequestsCardSkeletonWrapper />}>
          <LazyEditingRequestsCard
            requests={editingRequests}
            loading={editingRequestsLoading}
            onCreate={() => {
              setSelectedRequestId(null);
              setSpecialRequestOpen(true);
            }}
            onRequestClick={(requestId) => {
              setSelectedRequestId(requestId);
              setSpecialRequestOpen(true);
            }}
            onUpdate={updateEditingRequest}
            onDelete={isAdminExperience ? removeEditingRequest : undefined}
          />
        </Suspense>
      </div>
    ) : null;

  const renderRequestedShootsSection = () =>
    loading && !overviewDataAvailable ? (
      <RequestedShootsCardSkeleton />
    ) : requestedShoots.length > 0 ? (
      <RequestedShootsSection
        shoots={requestedShoots}
        onSelect={handleSelectShoot}
        onApprove={(shoot) => setApprovalModalShoot(shoot)}
        onDecline={(shoot) => setDeclineModalShoot(shoot)}
        onModify={(shoot) => setEditModalShoot(shoot)}
      />
    ) : null;

  const renderShootsTabsCard = () =>
    loading && !overviewDataAvailable ? (
      <UpcomingShootsCardSkeleton />
    ) : (
      <ShootsTabsCard
        upcomingShoots={upcomingShootsWithoutRequested}
        requestedShoots={requestedShoots}
        onSelect={handleSelectShoot}
        onApprove={(shoot) => setApprovalModalShoot(shoot)}
        onDecline={(shoot) => setDeclineModalShoot(shoot)}
        onModify={(shoot) => setEditModalShoot(shoot)}
        onViewInvoice={handleViewInvoice}
        role={role}
      />
    );

  const renderEditingManagerShootsTabsCard = () =>
    loading && !overviewDataAvailable ? (
      <UpcomingShootsCardSkeleton />
    ) : (
      <ShootsTabsCard
        mode="editing_manager"
        title="Shoots"
        customTabs={[
          {
            id: "scheduled",
            label: "Scheduled",
            shoots: editingManagerScheduledShoots,
            emptyStateText: "No scheduled shoots found.",
          },
          {
            id: "upcoming",
            label: "Upcoming",
            shoots: editingManagerUpcomingShoots,
            emptyStateText: "No upcoming shoots found.",
          },
          {
            id: "uploaded",
            label: "Uploaded",
            shoots: editingManagerUploadedShoots,
            emptyStateText: "No uploaded shoots found.",
          },
          {
            id: "ready",
            label: "Ready",
            shoots: editingManagerReadyToDeliverShoots,
            emptyStateText: "No ready shoots found.",
          },
        ]}
        upcomingShoots={[]}
        requestedShoots={[]}
        onSelect={handleSelectShoot}
        onApprove={(shoot) => setApprovalModalShoot(shoot)}
        onDecline={(shoot) => setDeclineModalShoot(shoot)}
        onModify={(shoot) => setEditModalShoot(shoot)}
        onViewInvoice={handleViewInvoice}
        role={role}
      />
    );

  const pipelineFilterButtons = [
    { key: "today" as const, label: "Today" },
    { key: "this_week" as const, label: "This Week" },
    { key: "month" as const, label: "Month" },
  ];

  const renderPipelineSection = () => (
    <div id="pipeline-section" className="space-y-3 w-full max-w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-[0.3em]">
          Pipeline
        </h2>
        <div className="flex gap-1">
          {pipelineFilterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setPipelineFilter(btn.key)}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-all border-b-2",
                pipelineFilter === btn.key
                  ? "text-foreground border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground",
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      <ErrorBoundary
        fallback={
          <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-3xl text-muted-foreground">
            <p className="text-sm">Unable to load workflow board</p>
          </div>
        }
      >
        <Suspense fallback={<ProductionWorkflowBoardSkeleton />}>
          <LazyProductionWorkflowBoard
            workflow={filteredWorkflow}
            loading={loading}
            onSelectShoot={handleSelectShoot}
            onAdvanceStage={handleAdvanceStage}
            filter={pipelineFilter}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );

  return {
    renderAssignPhotographersCard,
    renderCompletedShootsCard,
    renderEditingManagerReadyToDeliverCard,
    renderEditingManagerShootsTabsCard,
    renderEditingRequestsCard,
    renderPendingReviewsCard,
    renderPipelineSection,
    renderRequestedShootsSection,
    renderShootsTabsCard,
    renderUpcomingCard,
  };
};
