import React, { Suspense, lazy, useState } from "react";
import { useNavigate } from "react-router-dom";

import { UpcomingShootsCard } from "@/components/dashboard/v2/UpcomingShootsCard";
import { PendingReviewsCard } from "@/components/dashboard/v2/PendingReviewsCard";
import { EditorRawLinksCard } from "@/components/dashboard/v2/EditorRawLinksCard";
import { CompletedShootsCardSkeleton } from "@/components/dashboard/v2/CompletedShootsCardSkeleton";
import type {
  DashboardClientRequest,
  DashboardShootSummary,
} from "@/types/dashboard";
import type { EditingRequest } from "@/services/editingRequestService";
import type { WeatherInfo } from "@/services/weatherService";
import { useEditorDashboardQueue } from "@/hooks/useEditorDashboardQueue";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMediaQuery } from "@/hooks/use-media-query";

import { RoleDashboardLayout } from "../components/RoleDashboardLayout";
import { DashboardOnboarding } from "../components/DashboardOnboarding";
import { dashboardOnboardingConfig } from "../config/dashboardOnboardingConfig";
import { useDashboardOnboarding } from "../hooks/useDashboardOnboarding";
import { useEditorDashboardMetrics } from "../hooks/useDashboardMetrics";

const LazyCompletedShootsCard = lazy(() =>
  import("@/components/dashboard/v2/CompletedShootsCard").then((module) => ({
    default: module.CompletedShootsCard,
  })),
);

interface EditorDashboardViewProps {
  clientRequests: DashboardClientRequest[];
  clientRequestsLoading: boolean;
  editingRequests: EditingRequest[];
  editingRequestsLoading: boolean;
  editorPendingReviews: DashboardShootSummary[];
  greetingTitleFullName: React.ReactNode;
  shootDetailsModal: React.ReactNode;
  userId?: string | number | null;
  onEditingRequestCenterOpen: () => void;
  onEditingRequestOpenById: (requestId: number) => void;
  onOpenShootInModalById: (shootId: string | number, options?: { initialTab?: "overview" }) => void;
  scrollToDashboardSection: (
    sectionId: string,
    fallback?: {
      title: string;
      description: string;
    },
  ) => boolean;
  onSelectShoot: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
}

export const EditorDashboardView = ({
  clientRequests,
  clientRequestsLoading,
  editingRequests,
  editingRequestsLoading,
  editorPendingReviews,
  greetingTitleFullName,
  shootDetailsModal,
  userId,
  onEditingRequestCenterOpen,
  onEditingRequestOpenById,
  onOpenShootInModalById,
  scrollToDashboardSection,
  onSelectShoot,
}: EditorDashboardViewProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [mobileTab, setMobileTab] = useState<string>("queue");
  const editorOnboarding = useDashboardOnboarding(user, "editor");
  const {
    sourceShoots: freshEditorSourceShoots,
    upcomingShoots: freshEditorUpcomingShoots,
    upcomingSummaries: effectiveEditorUpcoming,
    deliveredSummaries: effectiveEditorDelivered,
    isLoading: freshEditorQueueLoading,
    isError: freshEditorQueueError,
  } = useEditorDashboardQueue(userId ?? null, Boolean(userId));
  const editorMetricTiles = useEditorDashboardMetrics({
    clientRequests,
    editingRequests,
    effectiveEditorDelivered,
    effectiveEditorSourceShoots: freshEditorSourceShoots,
    effectiveEditorUpcoming,
    navigate,
    scrollToDashboardSection,
  });
  const editorRawLinksCard = (
    <div
      id="editor-raw-links-card"
      data-onboarding-target="editor-raw-links"
      className="h-full flex flex-col"
    >
      <EditorRawLinksCard
        shoots={freshEditorUpcomingShoots}
        editorId={userId ?? null}
        isLoading={freshEditorQueueLoading}
        isError={freshEditorQueueError}
        onOpenShoot={(shootId) => {
          void onOpenShootInModalById(shootId, { initialTab: "overview" });
        }}
      />
    </div>
  );

  const editorRequestsCard = (
    <div id="requests-queue" data-onboarding-target="editor-requests">
      <PendingReviewsCard
        reviews={[]}
        issues={[]}
        onSelect={(shoot) => onSelectShoot(shoot)}
        title="Requests"
        emptyRequestsText="No active requests."
        editingRequests={editingRequests}
        editingRequestsLoading={editingRequestsLoading}
        onCreateEditingRequest={onEditingRequestCenterOpen}
        onEditingRequestClick={onEditingRequestOpenById}
        editingActionLabel="View all"
        clientRequests={clientRequests}
        clientRequestsLoading={clientRequestsLoading}
        showEditingTab
        showClientTab
      />
    </div>
  );

  const editorMobileTabs = [
    {
      id: "queue",
      label: "Queue",
      content: (
        <div data-onboarding-target="editor-queue">
          <UpcomingShootsCard
            shoots={effectiveEditorUpcoming}
            onSelect={(shoot, weather) => onSelectShoot(shoot, weather)}
            role="editor"
            title="Editing queue"
            subtitle="Uploads & active edits"
            emptyStateText="No edits in progress yet."
          />
        </div>
      ),
    },
    {
      id: "requests",
      label: "Requests",
      content: editorRequestsCard,
    },
    {
      id: "delivered",
      label: "Delivered",
      content: (
        <div data-onboarding-target="editor-delivered">
          <Suspense fallback={<CompletedShootsCardSkeleton />}>
            <LazyCompletedShootsCard
              shoots={effectiveEditorDelivered}
              title="Delivered edits"
              subtitle="Recently published"
              emptyStateText="No delivered edits yet."
              onSelect={onSelectShoot}
              onViewAll={() => navigate("/shoot-history?tab=delivered")}
            />
          </Suspense>
        </div>
      ),
    },
  ] as const;

  return (
    <>
      <RoleDashboardLayout
        title={greetingTitleFullName}
        description="Upcoming edits, requests, and delivery progress."
        metricTiles={editorMetricTiles}
        metricsOnboardingTarget="editor-metrics"
        upcomingOnboardingTarget="editor-queue"
        leftColumnCard={editorRawLinksCard}
        rightColumnCards={[
          <div key="delivered-edits" data-onboarding-target="editor-delivered">
            <Suspense fallback={<CompletedShootsCardSkeleton />}>
              <LazyCompletedShootsCard
                shoots={effectiveEditorDelivered}
                title="Delivered edits"
                subtitle="Recently published"
                emptyStateText="No delivered edits yet."
                onSelect={onSelectShoot}
                onViewAll={() => navigate("/shoot-history?tab=delivered")}
              />
            </Suspense>
          </div>,
          null,
        ]}
        upcomingShoots={effectiveEditorUpcoming}
        upcomingTitle="Editing queue"
        upcomingSubtitle="Uploads & active edits"
        upcomingEmptyStateText="No edits in progress yet."
        pendingReviews={editorPendingReviews}
        pendingCard={editorRequestsCard}
        onSelectShoot={onSelectShoot}
        role="editor"
        mobileTab={mobileTab}
        onMobileTabChange={setMobileTab}
        mobileTabs={editorMobileTabs.map((tab) => ({ ...tab }))}
      />
      <DashboardOnboarding
        roleKey="editor"
        steps={dashboardOnboardingConfig.editor.steps}
        copy={dashboardOnboardingConfig.editor.copy}
        welcomeOpen={editorOnboarding.welcomeOpen}
        tourOpen={editorOnboarding.tourOpen}
        isMobile={isMobile}
        currentMobileTab={mobileTab}
        lastStep={editorOnboarding.onboardingState.lastStep}
        onStart={editorOnboarding.startTour}
        onDismiss={editorOnboarding.dismiss}
        onComplete={(lastStep) => editorOnboarding.complete({ lastStep })}
        onProgress={editorOnboarding.saveProgress}
        onReplay={editorOnboarding.replay}
        onSetMobileTab={setMobileTab}
        onStepView={editorOnboarding.recordStepView}
        onStepBack={editorOnboarding.recordStepBack}
        onHelpOpened={editorOnboarding.recordHelpOpened}
        onHelpMessage={editorOnboarding.recordHelpMessage}
      />
      {shootDetailsModal}
    </>
  );
};
