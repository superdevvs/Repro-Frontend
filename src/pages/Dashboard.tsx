import React, { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useShoots } from "@/context/ShootsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import {
  filterEditingManagerUpcomingShoots,
  filterReadyToDeliverShoots,
  filterScheduledShoots,
  filterUploadedShoots,
  getGreetingPrefix,
  PENDING_REVIEW_KEYWORDS,
} from "@/utils/dashboardDerivedUtils";
import {
  isClientDeliveredShootDownloaded,
  isClientDeliveredShootViewed,
  markClientDeliveredShootDownloaded,
  markClientDeliveredShootViewed,
} from "@/utils/clientDeliveredShootTracker";
import type { ClientShootRecord } from "@/utils/dashboardDerivedUtils";
import { useDashboardDerivedData } from "@/hooks/useDashboardDerivedData";
import {
  DashboardPhotographerSummary,
  DashboardShootSummary,
} from "@/types/dashboard";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useEditingRequests } from "@/hooks/useEditingRequests";
import { useRequestManager } from "@/context/RequestManagerContext";
import { UpcomingShootsCardSkeleton } from "@/components/dashboard/v2/UpcomingShootsCardSkeleton";
import { withErrorBoundary } from "@/components/ui/ErrorBoundary";
import { UploadStatusWidget } from "@/components/dashboard/UploadStatusWidget";
import { usePermission } from "@/hooks/usePermission";
import { DashboardRouteSkeleton } from "@/components/layout/DashboardRouteSkeleton";
import { DASHBOARD_DESCRIPTION } from "@/features/dashboard/constants";
import { DevProfiler } from "@/features/dashboard/components/DevProfiler";
import { useDashboardSections } from "@/features/dashboard/components/DashboardSections";
import { resolveDashboardRoleState } from "@/features/dashboard/roleState";
import { useAvailabilityWindow } from "@/features/dashboard/hooks/useAvailabilityWindow";
import { useCancellationRequests } from "@/features/dashboard/hooks/useCancellationRequests";
import { useClientDashboardActions } from "@/features/dashboard/hooks/useClientDashboardActions";
import { useClientDashboardLayoutMeasure } from "@/features/dashboard/hooks/useClientDashboardLayoutMeasure";
import { useDashboardInvoiceDialog } from "@/features/dashboard/hooks/useDashboardInvoiceDialog";
import {
  useAdminDashboardMetrics,
  useSalesDashboardMetrics,
} from "@/features/dashboard/hooks/useDashboardMetrics";
import { useDashboardRequests } from "@/features/dashboard/hooks/useDashboardRequests";
import { useDashboardShootModal } from "@/features/dashboard/hooks/useDashboardShootModal";
import { useWorkflowPipeline } from "@/features/dashboard/hooks/useWorkflowPipeline";
import type {
  MobileClientDashboardTab,
  MobileDashboardTab,
  MobileEditingManagerTab,
} from "@/features/dashboard/types";

const DashboardViewFallback = () => (
  <DashboardRouteSkeleton pathname="/dashboard" />
);

const DashboardUnsupportedRoleFallback = ({ role }: { role: string }) => (
  <DashboardLayout>
    <div className="p-6">
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-lg font-semibold">Dashboard is not available for this role.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The current account role ({role || "unknown"}) does not have a matching dashboard layout.
        </p>
      </div>
    </div>
  </DashboardLayout>
);

const ClientDashboardView = lazy(() =>
  import("@/features/dashboard/views/ClientDashboardView").then((module) => ({
    default: module.ClientDashboardView,
  })),
);

const PhotographerDashboardView = lazy(() =>
  import("@/features/dashboard/views/PhotographerDashboardView").then((module) => ({
    default: module.PhotographerDashboardView,
  })),
);

const SalesDashboardView = lazy(() =>
  import("@/features/dashboard/views/SalesDashboardView").then((module) => ({
    default: module.SalesDashboardView,
  })),
);

const EditorDashboardView = lazy(() =>
  import("@/features/dashboard/views/EditorDashboardView").then((module) => ({
    default: module.EditorDashboardView,
  })),
);

const AdminDashboardView = lazy(() =>
  import("@/features/dashboard/views/AdminDashboardView").then((module) => ({
    default: module.AdminDashboardView,
  })),
);

const EditingManagerDashboardView = lazy(() =>
  import("@/features/dashboard/views/EditingManagerDashboardView").then((module) => ({
    default: module.EditingManagerDashboardView,
  })),
);

const LazyShootDetailsModal = lazy(() =>
  import("@/components/dashboard/v2/ShootDetailsModalWrapper").then((module) => ({
    default: module.ShootDetailsModalWrapper,
  })),
);

const LazySpecialEditingRequestDialog = lazy(() =>
  import("@/components/dashboard/SpecialEditingRequestDialog").then((module) => ({
    default: module.SpecialEditingRequestDialog,
  })),
);

const LazyInvoiceViewDialog = lazy(() =>
  import("@/components/invoices/InvoiceViewDialog").then((module) => ({
    default: module.InvoiceViewDialog,
  })),
);

const LazyShootApprovalModal = lazy(() =>
  import("@/components/shoots/ShootApprovalModal").then((module) => ({
    default: module.ShootApprovalModal,
  })),
);

const LazyShootDeclineModal = lazy(() =>
  import("@/components/shoots/ShootDeclineModal").then((module) => ({
    default: module.ShootDeclineModal,
  })),
);

const LazyShootEditModal = lazy(() =>
  import("@/components/shoots/ShootEditModal").then((module) => ({
    default: module.ShootEditModal,
  })),
);

const LazyCancellationRequestsDialog = lazy(() =>
  import("@/components/dashboard/CancellationRequestsDialog").then((module) => ({
    default: module.CancellationRequestsDialog,
  })),
);

const Dashboard = () => {
  const { role, session, user, setUser, isLoading: authLoading } = useAuth();
  const { can, isLoading: permissionsLoading } = usePermission();
  const { shoots, fetchShoots } = useShoots();
  const isMobile = useIsMobile();
  const isEditingManager = role === "editing_manager";
  const isAdminExperience = ["admin", "superadmin", "editing_manager"].includes(role);
  const canViewAdminDashboard = can("dashboard-admin", "view");
  const canViewDashboardClientRequests = canViewAdminDashboard || ["client", "editor", "photographer"].includes(role);
  const canLoadAvailability = !isEditingManager && can("dashboard-availability", "view");
  const canViewDashboardEditingRequests = can("dashboard-editing-requests", "view");
  const canViewContactActions = can("dashboard-contact-actions", "view");
  const canViewCurrentDashboard =
    role === "client"
      ? can("dashboard-client", "view")
      : role === "photographer"
        ? can("dashboard-photographer", "view")
        : role === "salesRep"
          ? can("dashboard-sales", "view")
          : role === "editor"
            ? can("dashboard-editor", "view")
            : canViewAdminDashboard;
  const dashboardRoleState = resolveDashboardRoleState({
    authLoading,
    canViewCurrentDashboard,
    permissionsLoading,
    role,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { openModal, removeRequest, registerShootOpenHandler } = useRequestManager();
  const { data, loading, error, refresh } = useDashboardOverview();
  const [selectedPhotographer, setSelectedPhotographer] =
    useState<DashboardPhotographerSummary | null>(null);
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);
  const [mobileDashboardTab, setMobileDashboardTab] = useState<MobileDashboardTab>("shoots");
  const [mobileClientTab, setMobileClientTab] = useState<MobileClientDashboardTab>("shoots");
  const [mobileEditingManagerTab, setMobileEditingManagerTab] = useState<MobileEditingManagerTab>("shoots");
  const { clientDesktopLeftColumnRef, clientDesktopShootsHeight } =
    useClientDashboardLayoutMeasure(role, isMobile);
  const {
    clientEmailActionPending,
    handleManageClientEmail,
    handleResendClientVerification,
  } = useClientDashboardActions({
    accessToken: session?.accessToken,
    navigate,
    role,
    setUser,
    toast,
    userId: user?.id,
  });

  // Invoice dialog state - must be defined before shootDetailsModal
  const {
    invoiceDialogOpen,
    selectedInvoice,
    invoiceLoading,
    handleViewInvoice,
    closeInvoiceDialog,
  } = useDashboardInvoiceDialog({
    accessToken: session?.accessToken,
    toast,
  });

  const safeUserName = typeof user?.name === 'string' ? user.name : '';
  const safeFirstName =
    typeof user?.firstName === 'string' ? user.firstName : '';
  const safeLastName =
    typeof (user as { lastName?: string | null } | null)?.lastName === 'string'
      ? ((user as { lastName?: string | null }).lastName as string)
      : '';
  const firstName = safeFirstName || safeUserName.split(' ')[0] || 'there';
  const fullName =
    safeUserName ||
    [safeFirstName, safeLastName]
      .filter((value) => value.trim().length > 0)
      .join(' ') ||
    firstName;
  const greetingPrefix = getGreetingPrefix();
  const greetingTitle = (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span className="font-light">{greetingPrefix}</span>
      <span className="font-bold">{firstName}</span>
    </span>
  );
  const greetingTitleFullName = (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span className="font-light">{greetingPrefix}</span>
      <span className="font-bold">{fullName}</span>
    </span>
  );

  const {
    availabilityWindow,
    setAvailabilityWindow,
    availablePhotographerIds,
    availabilityError,
    availabilityLoading,
  } = useAvailabilityWindow(canLoadAvailability, session?.accessToken);

  const {
    summaryMap,
    allSummaries,
    photographerSourceShoots,
    editorSourceShoots,
    photographerSummaries,
    editorSummaries,
    editorUpcoming,
    editorPendingReviews,
    editorCompleted,
    editorDelivered,
    photographerUpcoming,
    photographerCompleted,
    photographerDelivered,
    photographerPendingReviews,
    requestedShoots,
    upcomingShootsWithoutRequested,
    clientShoots,
    clientUpcomingRecords,
    clientCompletedRecords,
    clientOnHoldRecords,
    repVisibleSummaries,
    repSourceShoots,
    repUpcoming,
    repPendingReviews,
    repDelivered,
    clientLatestCompleted,
    fallbackPhotographers,
  } = useDashboardDerivedData({ shoots, role, user: user ?? null });
  const {
    selectedShoot,
    selectedShootWeather,
    shootModalInitialTab,
    openDownloadOnSelect,
    setSelectedShoot,
    setOpenDownloadOnSelect,
    handleSelectShoot,
    handleCloseShootModal,
    handleShootUpdate,
    openShootInModalById,
  } = useDashboardShootModal({
    accessToken: session?.accessToken,
    fetchShoots,
    shoots,
    summaryMap,
    toast,
  });

  const shootDetailsModal = (
    <>
      <Suspense fallback={null}>
        <LazyShootDetailsModal
          shoot={selectedShoot}
          onClose={handleCloseShootModal}
          weather={selectedShootWeather}
          onShootUpdate={handleShootUpdate}
          onViewInvoice={handleViewInvoice}
          initialTab={shootModalInitialTab}
          openDownloadDialog={openDownloadOnSelect}
        />
      </Suspense>
      {/* Invoice View Dialog */}
      {selectedInvoice && (
        <Suspense fallback={null}>
          <LazyInvoiceViewDialog
            isOpen={invoiceDialogOpen}
            onClose={closeInvoiceDialog}
            invoice={selectedInvoice}
          />
        </Suspense>
      )}
    </>
  );

  const editingManagerScheduledShoots = useMemo(
    () => filterScheduledShoots(allSummaries),
    [allSummaries],
  );

  const editingManagerUpcomingShoots = useMemo(
    () => filterEditingManagerUpcomingShoots(allSummaries),
    [allSummaries],
  );

  const editingManagerUploadedShoots = useMemo(
    () => filterUploadedShoots(allSummaries),
    [allSummaries],
  );

  const editingManagerReadyToDeliverShoots = useMemo(
    () => filterReadyToDeliverShoots(allSummaries),
    [allSummaries],
  );
  
  const shouldLoadEditingRequests = canViewDashboardEditingRequests;
  const { 
    requests: editingRequests, 
    loading: editingRequestsLoading,
    updateRequest: updateEditingRequest,
    removeRequest: removeEditingRequest,
    refresh: refreshEditingRequests,
  } = useEditingRequests(shouldLoadEditingRequests);

  const {
    clientRequests,
    clientRequestsLoading,
    specialRequestOpen,
    setSpecialRequestOpen,
    specialRequestInitialTab,
    setSpecialRequestInitialTab,
    selectedRequestId,
    setSelectedRequestId,
    openEditingRequestCenter,
    openEditingRequestById,
    openShootOverviewFromEditingRequest,
  } = useDashboardRequests({
    canViewDashboardClientRequests,
    location,
    navigate,
    openModal,
    openShootInModalById,
    registerShootOpenHandler,
    removeRequest,
    toast,
  });

  const {
    cancellationShoots,
    cancellationRequestCount,
    fetchPendingCancellationShoots,
    handleApproveCancellation,
    handleRejectCancellation,
  } = useCancellationRequests({
    canViewAdminDashboard,
    fetchShoots,
    pendingCancellations: data?.pendingCancellations,
    refresh,
    toast,
  });

  const openSupportEmail = useCallback(
    (subject: string, body?: string) => {
      const fallback = () =>
        toast({
          title: "Contact support",
          description: "Please email support@reprohq.com.",
        });

      if (typeof window === "undefined") {
        fallback();
        return;
      }

      const params = new URLSearchParams();
      if (subject) params.set("subject", subject);
      if (body) params.set("body", body);
      window.location.href = `mailto:support@reprohq.com${
        params.toString() ? `?${params.toString()}` : ""
      }`;
    },
    [toast],
  );

  const scrollToDashboardSection = useCallback(
    (
      sectionId: string,
      fallback?: {
        title: string;
        description: string;
      },
    ) => {
      if (typeof document === "undefined") return false;
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
      if (fallback) {
        toast({
          title: fallback.title,
          description: fallback.description,
        });
      }
      return false;
    },
    [toast],
  );

  const adminMetricTiles = useAdminDashboardMetrics({
    allSummaries,
    cancellationRequestCount,
    clientRequests,
    editingRequests,
    isMobile,
    navigate,
    scrollToDashboardSection,
    setCancellationDialogOpen,
    setMobileDashboardTab,
  });

  const salesMetricTiles = useSalesDashboardMetrics({
    can,
    navigate,
    repDelivered,
    repSourceShoots,
    repVisibleSummaries,
    scrollToDashboardSection,
  });

  const assignPhotographers = Array.isArray(data?.photographers) && data.photographers.length
    ? data.photographers
    : Array.isArray(fallbackPhotographers) ? fallbackPhotographers : [];

  const photographerSchedule = useMemo(() => {
    if (!selectedPhotographer) return [];
    if (data?.upcomingShoots?.length) {
      return data.upcomingShoots.filter(
        (shoot) => shoot.photographer?.id === selectedPhotographer.id,
      );
    }
    return allSummaries.filter((shoot) => shoot.photographer?.id === selectedPhotographer.id);
  }, [selectedPhotographer, data?.upcomingShoots, allSummaries]);

  const {
    deliveredShoots,
    filteredWorkflow,
    handleAdvanceStage,
    pipelineFilter,
    setPipelineFilter,
  } = useWorkflowPipeline({
    accessToken: session?.accessToken,
    refresh,
    toast,
    workflow: data?.workflow,
  });

  const [approvalModalShoot, setApprovalModalShoot] = useState<DashboardShootSummary | null>(null);
  const [declineModalShoot, setDeclineModalShoot] = useState<DashboardShootSummary | null>(null);
  const [editModalShoot, setEditModalShoot] = useState<DashboardShootSummary | null>(null);

  const {
    renderAssignPhotographersCard,
    renderCompletedShootsCard,
    renderEditingManagerReadyToDeliverCard,
    renderEditingManagerShootsTabsCard,
    renderPendingReviewsCard,
    renderPipelineSection,
    renderShootsTabsCard,
  } = useDashboardSections({
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
    overviewDataAvailable: Boolean(data),
    pendingReviews: data?.pendingReviews || [],
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
  });

  if (dashboardRoleState.kind === "loading") {
    return <DashboardViewFallback />;
  }

  if (dashboardRoleState.kind === "denied") {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-lg font-semibold">Dashboard access is disabled for this role.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Enable the matching dashboard layout permission in Accounts to restore this view.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (dashboardRoleState.kind === "unsupported") {
    return <DashboardUnsupportedRoleFallback role={dashboardRoleState.role} />;
  }

  if (!isAdminExperience) {
    if (dashboardRoleState.kind === "client") {
      return (
        <Suspense fallback={<DashboardViewFallback />}>
          <ClientDashboardView
            clientRequests={clientRequests}
            clientRequestsLoading={clientRequestsLoading}
            clientCompletedRecords={clientCompletedRecords}
            clientDesktopLeftColumnRef={clientDesktopLeftColumnRef}
            clientDesktopShootsHeight={clientDesktopShootsHeight}
            clientEmailActionPending={clientEmailActionPending}
            clientOnHoldRecords={clientOnHoldRecords}
            clientShoots={clientShoots}
            clientUpcomingRecords={clientUpcomingRecords}
            greetingTitle={greetingTitle}
            isMobile={isMobile}
            mobileClientTab={mobileClientTab}
            refresh={refresh}
            shootDetailsModal={shootDetailsModal}
            toast={toast}
            user={user}
            onManageClientEmail={handleManageClientEmail}
            onOpenSupportEmail={openSupportEmail}
            onResendClientVerification={handleResendClientVerification}
            onSetMobileClientTab={setMobileClientTab}
            onSetOpenDownloadOnSelect={setOpenDownloadOnSelect}
            onSetSelectedShoot={setSelectedShoot}
          />
        </Suspense>
      );
    }
    if (dashboardRoleState.kind === "photographer") {
      return (
        <Suspense fallback={<DashboardViewFallback />}>
          <PhotographerDashboardView
            clientRequests={clientRequests}
            clientRequestsLoading={clientRequestsLoading}
            greetingTitleFullName={greetingTitleFullName}
            photographerDelivered={photographerDelivered}
            photographerPendingReviews={photographerPendingReviews}
            photographerUpcoming={photographerUpcoming}
            shootDetailsModal={shootDetailsModal}
            onSelectShoot={handleSelectShoot}
          />
        </Suspense>
      );
    }

    if (dashboardRoleState.kind === "salesRep") {
      return (
        <Suspense fallback={<DashboardViewFallback />}>
          <SalesDashboardView
            availablePhotographerIds={availablePhotographerIds}
            availabilityError={availabilityError}
            availabilityLoading={availabilityLoading}
            availabilityWindow={availabilityWindow}
            cancellationShoots={cancellationShoots}
            clientRequests={clientRequests}
            clientRequestsLoading={clientRequestsLoading}
            editingRequests={editingRequests}
            editingRequestsLoading={editingRequestsLoading}
            greetingTitleFullName={greetingTitleFullName}
            photographers={assignPhotographers}
            pendingReviews={data?.pendingReviews || []}
            repDelivered={repDelivered}
            repPendingReviews={repPendingReviews}
            repUpcoming={repUpcoming}
            salesMetricTiles={salesMetricTiles}
            shootDetailsModal={shootDetailsModal}
            shouldLoadEditingRequests={shouldLoadEditingRequests}
            onApproveCancellation={handleApproveCancellation}
            onRejectCancellation={handleRejectCancellation}
            onSelectShoot={handleSelectShoot}
            onSetAvailabilityWindow={setAvailabilityWindow}
            onSetSelectedPhotographer={setSelectedPhotographer}
            onCreateEditingRequest={() => {
              setSelectedRequestId(null);
              setSpecialRequestOpen(true);
            }}
            onEditingRequestClick={(requestId) => {
              setSelectedRequestId(requestId);
              setSpecialRequestOpen(true);
            }}
          />
        </Suspense>
      );
    }

    if (dashboardRoleState.kind === "editor") {
      return (
        <Suspense fallback={<DashboardViewFallback />}>
          <EditorDashboardView
            clientRequests={clientRequests}
            clientRequestsLoading={clientRequestsLoading}
            editingRequests={editingRequests}
            editingRequestsLoading={editingRequestsLoading}
            editorPendingReviews={editorPendingReviews}
            greetingTitleFullName={greetingTitleFullName}
            shootDetailsModal={shootDetailsModal}
            userId={user?.id ?? null}
            onEditingRequestCenterOpen={openEditingRequestCenter}
            onEditingRequestOpenById={openEditingRequestById}
            onOpenShootInModalById={openShootInModalById}
            scrollToDashboardSection={scrollToDashboardSection}
            onSelectShoot={handleSelectShoot}
          />
        </Suspense>
      );
    }

    return <DashboardUnsupportedRoleFallback role={role} />;
  }

  return (
    <DashboardLayout>
      {isEditingManager ? (
        <div className="px-2 pt-3 pb-3 sm:p-6 flex flex-col min-h-full gap-4 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <PageHeader title={greetingTitle} description={DASHBOARD_DESCRIPTION} />
            </div>
            <div className="flex items-center gap-2 empty:hidden">
              <UploadStatusWidget />
              {cancellationRequestCount > 0 && (
                <button
                  onClick={() => setCancellationDialogOpen(true)}
                  className="flex-shrink-0 rounded-2xl border border-rose-200/80 dark:border-rose-800/40 bg-white dark:bg-card shadow-sm px-4 py-3 flex items-center gap-3 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30">
                    <span className="text-base font-bold text-rose-600 dark:text-rose-400">{cancellationRequestCount}</span>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground leading-tight text-left">Cancellation{cancellationRequestCount !== 1 ? 's' : ''}<br />pending</span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50 rounded-2xl text-sm text-rose-700 dark:text-rose-300">
              <p className="font-semibold mb-1">Error loading dashboard:</p>
              <p>{error}</p>
              <button
                onClick={() => refresh()}
                className="mt-2 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {!error && data && (!data.workflow || !Array.isArray(data.workflow.columns)) && (
            <div className="p-4 border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 rounded-2xl text-sm text-amber-700 dark:text-amber-300">
              <p>Workflow data is missing. <button onClick={() => refresh()} className="underline font-semibold">Refresh</button></p>
            </div>
          )}

          <Suspense fallback={<UpcomingShootsCardSkeleton />}>
            <EditingManagerDashboardView
              isMobile={isMobile}
              mobileEditingManagerTab={mobileEditingManagerTab}
              renderEditingManagerReadyToDeliverCard={renderEditingManagerReadyToDeliverCard}
              renderEditingManagerShootsTabsCard={renderEditingManagerShootsTabsCard}
              renderPendingReviewsCard={renderPendingReviewsCard}
              renderPipelineSection={renderPipelineSection}
              setMobileEditingManagerTab={setMobileEditingManagerTab}
            />
          </Suspense>
        </div>
      ) : (
        <Suspense fallback={<DashboardViewFallback />}>
          <AdminDashboardView
            adminMetricTiles={adminMetricTiles}
            cancellationRequestCount={cancellationRequestCount}
            data={data}
            error={error}
            greetingTitle={greetingTitle}
            isMobile={isMobile}
            mobileDashboardTab={mobileDashboardTab}
            refresh={refresh}
            renderAssignPhotographersCard={renderAssignPhotographersCard}
            renderCompletedShootsCard={renderCompletedShootsCard}
            renderPendingReviewsCard={renderPendingReviewsCard}
            renderPipelineSection={renderPipelineSection}
            renderShootsTabsCard={renderShootsTabsCard}
            setCancellationDialogOpen={setCancellationDialogOpen}
            setMobileDashboardTab={setMobileDashboardTab}
          />
        </Suspense>
      )}

      {shootDetailsModal}

      {/* Approval Modal for requested shoots */}
      {approvalModalShoot && (
        <Suspense fallback={null}>
          <LazyShootApprovalModal
            isOpen={!!approvalModalShoot}
            onClose={() => setApprovalModalShoot(null)}
            shootId={approvalModalShoot.id}
            shootAddress={approvalModalShoot.addressLine || ''}
            currentScheduledAt={approvalModalShoot.startTime}
            onApproved={() => {
              setApprovalModalShoot(null);
              refresh();
            }}
            photographers={Array.isArray(data?.photographers) ? data.photographers.map((p) => ({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
            })) : []}
          />
        </Suspense>
      )}

      {/* Decline Modal for requested shoots */}
      {declineModalShoot && (
        <Suspense fallback={null}>
          <LazyShootDeclineModal
            isOpen={!!declineModalShoot}
            onClose={() => setDeclineModalShoot(null)}
            shootId={declineModalShoot.id}
            shootAddress={declineModalShoot.addressLine || ''}
            onDeclined={() => {
              setDeclineModalShoot(null);
              refresh();
            }}
          />
        </Suspense>
      )}

      {/* Edit Modal for modifying shoot requests */}
      {editModalShoot && (
        <Suspense fallback={null}>
          <LazyShootEditModal
            isOpen={!!editModalShoot}
            onClose={() => setEditModalShoot(null)}
            shootId={editModalShoot.id}
            onSaved={() => {
              setEditModalShoot(null);
              refresh();
            }}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <LazySpecialEditingRequestDialog
          open={specialRequestOpen}
          onOpenChange={(open) => {
            setSpecialRequestOpen(open);
            if (!open) {
              setSelectedRequestId(null);
              setSpecialRequestInitialTab("new");
            }
          }}
          shoots={
            role === "salesRep"
              ? repVisibleSummaries
              : role === "editor"
                ? editorUpcoming
                : data?.upcomingShoots || []
          }
          onSuccess={refreshEditingRequests}
          requests={editingRequests}
          selectedRequestId={selectedRequestId}
          initialTab={specialRequestInitialTab}
          onUpdate={updateEditingRequest}
          onDelete={isAdminExperience ? removeEditingRequest : undefined}
          onOpenShoot={openShootOverviewFromEditingRequest}
        />
      </Suspense>

      {cancellationDialogOpen && (
        <Suspense fallback={null}>
          <LazyCancellationRequestsDialog
            open={cancellationDialogOpen}
            onOpenChange={setCancellationDialogOpen}
            onActionComplete={() => {
              refresh();
              void fetchPendingCancellationShoots();
              if (fetchShoots) fetchShoots().catch(() => {});
            }}
          />
        </Suspense>
      )}
    </DashboardLayout>
  );
};

const DashboardWithProfiler = () => (
  <DevProfiler id="Dashboard">
    <Dashboard />
  </DevProfiler>
);

const DashboardWithBoundary = withErrorBoundary(DashboardWithProfiler);

export default React.memo(DashboardWithBoundary);
