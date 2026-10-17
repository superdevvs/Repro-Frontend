import { useHoldNotifications, describeHoldNotifications } from '@/components/shoots/details/useHoldNotifications';
import { PrivateImportReview } from '@/components/shoots/details/PrivateImportReview';
import { sendShootToEditing } from '@/services/shootEditingDispatch';
import { usePageLoading } from '@/hooks/use-page-loading';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiClient, getApiHeaders } from '@/services/api';
import { ArrowLeft, Building, Calendar, Camera, CheckCircle, ChevronRight, Clock, Cloud, Copy, DollarSign, Download, ExternalLink, Image as ImageIcon, Layers, Mail, MapPin, MoreVertical, PauseCircle, Phone, Send, Share2, Upload, User } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { withErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAuth } from '@/components/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getStateFullName } from '@/utils/stateUtils';
import { getShootLocalDate } from '@/utils/shootLocalDate';
import { format } from 'date-fns';
import { API_BASE_URL } from '@/config/env';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { registerShootDetailRefresh } from '@/realtime/realtimeRefreshBus';
import { getCheckoutLaunchToastCopy, openCheckoutLink } from '@/utils/checkoutLaunch';
import { useShootDetailsScreen } from '@/components/shoots/modal/useShootDetailsScreen';
import { getShootDetailsPaymentBadge, getShootDetailsServiceNames, getShootDetailsWorkflowBadge } from '@/components/shoots/details/shootDetailsPresentation';
import { getShootClientReleaseAccess } from '@/components/shoots/details/shootClientReleaseAccess';
import { ShootDetailsPageHeader } from '@/components/shoots/details/ShootDetailsPageHeader';
import { useShootPageOverview } from '@/components/shoots/details/useShootPageOverview';
import './shootDetailsWorkspace.css';
import { ShootUnitScopeProvider } from '@/features/shoot-units/ShootUnitScope';
import { ShootDetailsPanelUnitChrome } from '@/features/shoot-units/ShootDetailsPanelUnitChrome';
import { ShootDetailsPageDialogs } from '@/components/shoots/details/ShootDetailsPageDialogs';
import { useShootDetailsModalActions } from '@/components/shoots/modal/useShootDetailsModalActions';
import { getShootServiceItems } from '@/utils/shootServiceItems';
import { buildFinalizeRequestBody } from '@/utils/shootFinalize';
import { finalizeShootWithProgressToast } from '@/components/shoots/finalize/finalizeShootWithProgressToast';
import { buildShootPath, shootPathNeedsCanonicalising } from '@/utils/shootPath';

// Import tab components
import { ShootDetailsMediaTab } from '@/components/shoots/tabs/ShootDetailsMediaTab';
import { ShootDetailsNotesTab } from '@/components/shoots/tabs/ShootDetailsNotesTab';
import { ShootDetailsSettingsTab } from '@/components/shoots/tabs/ShootDetailsSettingsTab';
import { ShootDetailsSlideshowTab } from '@/components/shoots/tabs/ShootDetailsSlideshowTab';
import { ShootDetailsActivityLogTab } from '@/components/shoots/tabs/ShootDetailsActivityLogTab';
import { ShootDetailsIssuesTab } from '@/components/shoots/tabs/ShootDetailsIssuesTab';
import { ShootDetailsSidebar } from '@/components/shoots/tabs/ShootDetailsSidebar';
import { AddServiceDialog } from '@/components/shoots/AddServiceDialog';
import { ShootDetailsModal as ShootOverviewModal } from '@/components/shoots/ShootDetailsModal';
import { MarkAsPaidDialog, MarkAsPaidPayload } from '@/components/payments/MarkAsPaidDialog';
import { RescheduleDialog } from '@/components/dashboard/RescheduleDialog';
import { getLegacyEditedPhotoCount, getShootDetailsErrorMessage } from './shootDetailsPageUtils';

const LazyShootDetailsTourTab = React.lazy(() =>
  import('@/components/shoots/tabs/ShootDetailsTourTab').then((module) => ({
    default: module.ShootDetailsTourTab,
  })),
);
const ShootDetails: React.FC = () => {
  const { id, slug } = useParams<{ id: string; slug?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role: authRole } = useAuth();
  const { formatTemperature, formatTime, formatDate } = useUserPreferences();
  const [activeTab, setActiveTab] = useState('media');
  useEffect(() => { const lane = new URLSearchParams(location.search).get('requestMedia'); if (lane === 'edited' || lane === 'uploaded') setActiveMediaDisplayTab(lane); }, [location.search]);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [isSendingToEditing, setIsSendingToEditing] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);
  const [isOnHoldDialogOpen, setIsOnHoldDialogOpen] = useState(false);
  const [onHoldReason, setOnHoldReason] = useState('');
  const [isHoldApprovalDialogOpen, setIsHoldApprovalDialogOpen] = useState(false);
  const [holdProcessing, setHoldProcessing] = useState(false);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [activeMediaDisplayTab, setActiveMediaDisplayTab] = useState<'uploaded' | 'edited'>('uploaded');
  const {
    shoot,
    shootLoading: loading,
    shootError,
    refreshShoot: loadShoot,
    rawFileCount,
    currentUserRole: role,
    roleFlags: {
      isEditingManager,
      isAdmin,
      isRep,
      isAdminOrRep,
      isPhotographer,
      isEditor,
      isClient,
    },
    visibleTabs,
    capabilities: {
      normalizedStatus: workflowStatusKey,
      hasEditedWithoutRaw,
      canFinalise,
      isFastForwardFinalise,
      canSendToEditing,
      isHoldRequested,
      canDirectHold,
      canRequestHold,
      canUserPutOnHold,
      holdActionLabel,
      holdDialogTitle,
      holdDialogDescription,
      holdSubmitLabel,
    },
  } = useShootDetailsScreen({
    shootId: id,
    enabled: Boolean(id),
    authRole: authRole || user?.role,
    userId: user?.id,
    editorUser: user,
  });
  usePageLoading(loading);
  const { isOverviewModalOpen, openOverviewModal, closeOverviewModal } = useShootPageOverview(shoot?.id);
  const holdNotifications = useHoldNotifications(shoot, isOnHoldDialogOpen || isHoldApprovalDialogOpen);

  const normalizedRole = role.toLowerCase();
  const isSuperAdmin = normalizedRole === 'superadmin';
  const isAdminOrSuperAdmin = isAdmin;
  const canReviewHoldRequest = isAdminOrRep && (shoot?.canManageShootActions ?? true) && isHoldRequested;
  const workflowBadge = getShootDetailsWorkflowBadge(shoot?.workflowStatus || shoot?.status);
  const paymentBadge = getShootDetailsPaymentBadge(shoot);
  const shootServices = getShootDetailsServiceNames(shoot);
  const paymentServiceItems = useMemo(
    () => getShootServiceItems(shoot).filter((item) => item.balanceDue > 0.01),
    [shoot],
  );
  const clientReleaseAccess = useMemo(
    () => getShootClientReleaseAccess(shoot, isClient),
    [isClient, shoot],
  );
  const {
    isDownloadDialogOpen,
    setIsDownloadDialogOpen,
    isDownloading,
    downloadStatusMessage,
    isGeneratingShareLink,
    selectedFileIds,
    setSelectedFileIds,
    handleEditorDownloadRaw,
    handleGenerateShareLink,
    handleDownloadMedia,
    handleDownloadFile,
  } = useShootDetailsModalActions({
    shoot,
    isPhotographer,
    refreshShoot: loadShoot,
    toast,
  });
  useEffect(() => {
    if (!shootError) return;
    const errorMessage = getShootDetailsErrorMessage(shootError, 'Failed to fetch shoot details');
    toast({
      title: 'Error',
      description: errorMessage,
      variant: 'destructive',
    });
  }, [shootError]);
  useEffect(() => {
    if (!id) return;
    return registerShootDetailRefresh(id, () => {
      void loadShoot();
    });
  }, [id, loadShoot]);
  // Put the property address in the address bar. Every link in the app and in
  // emails may arrive as a bare /shoots/:id (or with a slug from before an
  // address correction); once the shoot is known the URL is rewritten in place,
  // keeping any ?action= and #tab intact and without adding a history entry.
  useEffect(() => {
    if (!shoot || String(shoot.id) !== String(id)) return;
    if (!shootPathNeedsCanonicalising(shoot, slug)) return;
    navigate(buildShootPath(shoot, { search: location.search, hash: location.hash }), { replace: true });
  }, [id, location.hash, location.search, navigate, shoot, slug]);
  useEffect(() => {
    const hashValue = location.hash.replace('#', '').toLowerCase();
    if (!hashValue) return;
    const mappedTab = hashValue === 'requests' ? 'issues' : hashValue;
    const sharedVisibleTabIds = new Set(
      visibleTabs.map((tab) => (tab.id === 'tours' ? 'tour' : tab.id)),
    );
    const validTabs = new Set([
      'media',
      'slideshow',
      'activity',
      ...sharedVisibleTabIds,
    ]);
    if (validTabs.has(mappedTab)) {
      setActiveTab(mappedTab);
    }
  }, [location.hash, visibleTabs]);
  useEffect(() => {
    setActiveMediaDisplayTab(isClient ? 'edited' : 'uploaded');
  }, [isClient, id]);
  const handleCreatePaymentLink = async () => {
    if (!shoot) return;
    setCreatingPayment(true);
    try {
      const response = await apiClient.post(`/shoots/${shoot.id}/create-checkout-link`);
      const url = response.data?.url || response.data?.checkout_url || response.data?.checkoutUrl;
      if (url) {
        const launchMode = openCheckoutLink(url);
        toast(getCheckoutLaunchToastCopy(launchMode));
      } else {
        throw new Error('Checkout URL not returned');
      }
    } catch (error: unknown) {
      const errorMessage = getShootDetailsErrorMessage(error, 'Failed to create payment link');
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setCreatingPayment(false);
    }
  };
  const handleSendToEditing = async () => {
    if (!shoot || isSendingToEditing) return;
    try {
      setIsSendingToEditing(true);
      if (!await sendShootToEditing(shoot.id)) return;

      toast({
        title: 'Success',
        description: 'Shoot sent to editing',
      });
      loadShoot();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getShootDetailsErrorMessage(error, 'Failed to send to editing'),
        variant: 'destructive',
      });
    } finally {
      setIsSendingToEditing(false);
    }
  };
  const handleFinalise = async () => {
    if (!shoot || isFinalising) return;
    try {
      setIsFinalising(true);
      // The shared runner owns the progress toast (live bar + one line per
      // background process), the polling and every outcome message.
      await finalizeShootWithProgressToast({
        shootId: shoot.id,
        shootLabel: shoot.location?.address,
        body: buildFinalizeRequestBody(shoot, 'admin_verified'),
        fetchShoot: loadShoot,
        onRefresh: loadShoot,
      });
    } finally {
      setIsFinalising(false);
    }
  };
  const handleProcessPayment = () => {
    setIsPaymentDialogOpen(true);
  };
  const handlePaymentSuccess = () => {
    toast({
      title: 'Payment Successful',
      description: 'Payment has been processed successfully.',
    });
    loadShoot(); // Reload shoot data to update payment status
  };
  const handleMarkOnHold = async () => {
    if (holdProcessing) return;
    if (!shoot || !onHoldReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for putting the shoot on hold.',
        variant: 'destructive',
      });
      return;
    }
    const isHoldRequest = isClient;
    if (isHoldRequest && shoot.holdRequestedAt) {
      toast({
        title: 'Hold already requested',
        description: 'Your hold request is already pending approval.',
      });
      return;
    }

    setHoldProcessing(true);
    try {
      const headers = getApiHeaders();
      const endpoint = isHoldRequest ? 'request-hold' : 'put-on-hold';
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: onHoldReason.trim(), ...(!isHoldRequest ? holdNotifications.payload : {}) }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || (isHoldRequest ? 'Failed to request hold' : 'Failed to put shoot on hold')
        );
      }

      const result = await response.json();
      toast({
        title: isHoldRequest ? 'Hold request submitted' : 'Shoot put on hold',
        description: isHoldRequest
          ? 'Your hold request is pending admin approval.'
          : `The shoot has been successfully marked on hold. ${describeHoldNotifications(result)}`,
      });

      setIsOnHoldDialogOpen(false);
      setOnHoldReason('');
      loadShoot(); // Reload shoot data
    } catch (error) {
      console.error('Error submitting hold request:', error);
      toast({
        title: 'Error',
        description: error instanceof Error
          ? error.message
          : isHoldRequest
            ? 'Failed to request hold. Please try again.'
            : 'Failed to put shoot on hold. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setHoldProcessing(false);
    }
  };

  const handleApproveHold = async () => {
    if (!shoot) return;
    setHoldProcessing(true);
    try {
      const headers = getApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/approve-hold`, {
        method: 'POST',
        headers,
        body: JSON.stringify(holdNotifications.payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve hold request');
      }

      const result = await response.json();
      toast({
        title: 'Hold approved',
        description: `The shoot has been placed on hold. ${describeHoldNotifications(result)}`,
      });
      setIsHoldApprovalDialogOpen(false);
      loadShoot();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve hold request.',
        variant: 'destructive',
      });
    } finally {
      setHoldProcessing(false);
    }
  };

  const handleRejectHold = async () => {
    if (!shoot) return;
    setHoldProcessing(true);
    try {
      const headers = getApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/reject-hold`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: 'Hold request rejected' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reject hold request');
      }

      toast({
        title: 'Hold request rejected',
        description: 'The hold request has been rejected.',
      });
      setIsHoldApprovalDialogOpen(false);
      loadShoot();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reject hold request.',
        variant: 'destructive',
      });
    } finally {
      setHoldProcessing(false);
    }
  };

  const amountDue = shoot ? Math.max((shoot.payment?.totalQuote || 0) - (shoot.payment?.totalPaid || 0), 0) : 0;

  const handleMarkPaidConfirm = async (payload: MarkAsPaidPayload) => {
    if (!shoot) return;
    const outstandingAmount = Math.max((shoot.payment?.totalQuote ?? 0) - (shoot.payment?.totalPaid ?? 0), 0);
    if (outstandingAmount <= 0.01) {
      toast({ title: 'Already Paid', description: 'This shoot is already fully paid.' });
      return;
    }
    const amount = payload.amount && payload.amount > 0 ? payload.amount : outstandingAmount;

    const body: {
      payment_type: MarkAsPaidPayload['paymentMethod'];
      amount: number;
      payment_details?: MarkAsPaidPayload['paymentDetails'];
      payment_date?: MarkAsPaidPayload['paymentDate'];
      shoot_service_ids?: string[];
      allocation_strategy?: MarkAsPaidPayload['allocationStrategy'];
    } = {
      payment_type: payload.paymentMethod,
      amount,
    };

    if (payload.paymentDetails) {
      body.payment_details = payload.paymentDetails;
    }
    if (payload.paymentDate) {
      body.payment_date = payload.paymentDate;
    }
    if (payload.shootServiceIds?.length) {
      body.shoot_service_ids = payload.shootServiceIds;
    }
    if (payload.allocationStrategy) {
      body.allocation_strategy = payload.allocationStrategy;
    }

    const headers = getApiHeaders();
    const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-paid`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: 'Failed to mark as paid' }));
      throw new Error(errorData.message || 'Failed to mark as paid');
    }

    toast({ title: 'Success', description: 'Shoot marked as paid successfully.' });
    loadShoot();
  };

  const copyAddress = () => {
    if (!shoot?.location?.fullAddress) return;
    navigator.clipboard.writeText(shoot.location.fullAddress);
    toast({ title: 'Copied', description: 'Address copied to clipboard' });
  };

  const openInMaps = () => {
    if (!shoot?.location) return;
    const address = encodeURIComponent(shoot.location.fullAddress);
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
  };

  const pageTabState = useMemo(() => {
    const lookup = new Map(visibleTabs.map((tab) => [tab.id, tab]));

    return {
      canShowIssuesTab: lookup.has('issues'),
      canShowToursTab: lookup.has('tours'),
      isToursTabDisabled: Boolean(lookup.get('tours')?.disabled),
      canShowSettingsTab: lookup.has('settings'),
      canShowNotesTab: lookup.has('notes'),
    };
  }, [visibleTabs]);

  const isPageTabDisabled = useCallback(
    (value: string) => {
      if (value === 'media' || value === 'slideshow') {
        return false;
      }

      if (value === 'tour') {
        return pageTabState.isToursTabDisabled;
      }

      return false;
    },
    [pageTabState.isToursTabDisabled],
  );

  const handlePageTabChange = useCallback(
    (value: string) => {
      if (isPageTabDisabled(value)) {
        return;
      }

      setActiveTab(value);
    },
    [isPageTabDisabled],
  );

  const fullAddress = shoot?.location?.fullAddress || 
    (shoot?.location ? `${shoot.location.address}, ${shoot.location.city}, ${getStateFullName(shoot.location.state)} ${shoot.location.zip}`.trim() : '');
  const {
    canShowIssuesTab,
    canShowToursTab,
    isToursTabDisabled,
    canShowSettingsTab,
    canShowNotesTab,
  } = pageTabState;
  const deliveredDownloadStatuses = new Set([
    'delivered',
    'ready',
    'ready_for_client',
    'admin_verified',
    'client_delivered',
    'workflow_completed',
    'finalized',
  ]);
  const isDeliveredShoot = deliveredDownloadStatuses.has(workflowStatusKey);
  const editedMediaCount = Number(
    shoot?.editedPhotoCount ??
      getLegacyEditedPhotoCount(shoot) ??
      shoot?.mediaSummary?.editedUploaded ??
      0,
  );
  const hasRawDownloadSelection = rawFileCount > 0 || selectedFileIds.length > 0;
  const canOpenDeliveredDownloadDialog =
    isDeliveredShoot &&
    !isEditor &&
    !isPhotographer &&
    (!isClient || clientReleaseAccess.canClientDownload);
  const canPrivilegedProgressDownload =
    !isDeliveredShoot &&
    isAdminOrSuperAdmin &&
    !isEditor &&
    !isPhotographer &&
    !isClient &&
    (
      (activeMediaDisplayTab === 'uploaded' && hasRawDownloadSelection) ||
      (activeMediaDisplayTab === 'edited' && editedMediaCount > 0)
    );
  const canShowDownloadButton =
    canOpenDeliveredDownloadDialog ||
    canPrivilegedProgressDownload ||
    isEditor;
  const isDownloadDisabled =
    isDownloading ||
    (isEditor
      ? !hasRawDownloadSelection
      : canPrivilegedProgressDownload
        ? activeMediaDisplayTab === 'uploaded'
          ? !hasRawDownloadSelection
          : editedMediaCount === 0
        : false);

  const handlePageDownload = useCallback(() => {
    if (canOpenDeliveredDownloadDialog) {
      setIsDownloadDialogOpen(true);
      return;
    }

    if (!isEditor && activeMediaDisplayTab === 'edited') {
      void handleDownloadMedia('original');
      return;
    }

    void handleEditorDownloadRaw();
  }, [
    activeMediaDisplayTab,
    canOpenDeliveredDownloadDialog,
    handleDownloadMedia,
    handleEditorDownloadRaw,
    isEditor,
    setIsDownloadDialogOpen,
  ]);

  useEffect(() => {
    if (!canOpenDeliveredDownloadDialog && isDownloadDialogOpen) {
      setIsDownloadDialogOpen(false);
    }
  }, [canOpenDeliveredDownloadDialog, isDownloadDialogOpen, setIsDownloadDialogOpen]);

  useEffect(() => {
    if (activeTab === 'tour' && isToursTabDisabled) {
      setActiveTab('media');
    }
  }, [activeTab, isToursTabDisabled]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="h-12 w-12" />
        </div>
      </DashboardLayout>
    );
  }

  if (!shoot) {
    return (
      <DashboardLayout>
        <div className="space-y-6 px-0 py-6 sm:p-6">
          <Card>
            <CardContent className="py-10 text-center">
              <h2 className="text-2xl font-semibold">Shoot not found</h2>
              <p className="mt-2 text-muted-foreground">This shoot may have been removed or you do not have access.</p>
              <Button className="mt-4" onClick={() => navigate('/shoot-history')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to shoots
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (shoot.status === 'import_draft') {
    return <DashboardLayout><PrivateImportReview shoot={shoot} isOpen onClose={() => navigate('/shoot-history')} /></DashboardLayout>;
  }

  const shootLocalDate = getShootLocalDate(shoot);
  const formattedDate = shootLocalDate ? formatDate(shootLocalDate) : 'Not scheduled';
  const formattedTime = shoot.time || 'TBD';
  const addressParts = fullAddress.split(',');

  return (
    <DashboardLayout className="!p-0">
      <ShootUnitScopeProvider shoot={shoot}>
      <div className="shoot-details-workspace flex flex-col min-h-full bg-background">
        <ShootDetailsPageHeader
          shoot={shoot}
          workflowBadge={workflowBadge}
          paymentBadge={paymentBadge}
          formattedDate={formattedDate}
          formattedTime={formattedTime}
          addressParts={addressParts}
          formatTemperature={formatTemperature}
          isEditor={isEditor}
          isPhotographer={isPhotographer}
          isEditingManager={isEditingManager}
          isAdminOrSuperAdmin={isAdminOrSuperAdmin}
          isClient={isClient}
          canDirectHold={canDirectHold}
          canRequestHold={canRequestHold}
          isHoldRequested={isHoldRequested}
          canReviewHoldRequest={canReviewHoldRequest}
          canSendToEditing={canSendToEditing}
          canFinalise={canFinalise}
          isFastForwardFinalise={isFastForwardFinalise}
          isSendingToEditing={isSendingToEditing}
          isFinalising={isFinalising}
          canShowIssuesTab={canShowIssuesTab}
          canShowToursTab={canShowToursTab}
          isToursTabDisabled={isToursTabDisabled}
          canShowSettingsTab={canShowSettingsTab}
          canShowNotesTab={canShowNotesTab}
          canShowActivity={isAdmin || isRep}
          holdActionLabel={holdActionLabel}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          onBack={() => navigate('/shoot-history')}
          onOpenOverview={openOverviewModal}
          onCopyAddress={copyAddress}
          onOpenInMaps={openInMaps}
          onOpenHoldDialog={() => setIsOnHoldDialogOpen(true)}
          onOpenHoldApprovalDialog={() => setIsHoldApprovalDialogOpen(true)}
          onSendToEditing={handleSendToEditing}
          onFinalise={handleFinalise}
          onProcessPayment={handleProcessPayment}
          canProcessPayment={amountDue > 0.01}
          canShowDownloadButton={canShowDownloadButton}
          onDownload={handlePageDownload}
          isDownloadDisabled={isDownloadDisabled}
          onGenerateShareLink={handleGenerateShareLink}
          rawFileCount={rawFileCount}
          isDownloading={isDownloading}
          isGeneratingShareLink={isGeneratingShareLink}
        />

          {/* Main Content Area with Tabs and Sidebar */}
          <div className="shoot-workspace-body" data-with-record="true">
            {/* Main Content */}
            <div className="shoot-workspace-main">
              {/* Tab Content */}
              <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${activeTab === 'media' ? '' : 'h-auto'}`}>
                <Tabs value={activeTab} onValueChange={handlePageTabChange} className={`flex flex-col min-h-0 ${activeTab === 'media' ? 'flex-1 h-full' : 'h-auto'}`}>
                  <TabsContent value="media" className="shoot-workspace-media-panel !mt-0 !p-0 bg-background" >
                    <div className="shoot-workspace-unit-chrome shrink-0">
                      <ShootDetailsPanelUnitChrome shoot={shoot} />
                    </div>
                    <ShootDetailsMediaTab
                      contextualSearch
                      shoot={shoot}
                      isAdmin={isAdmin}
                      isPhotographer={isPhotographer}
                      isEditor={isEditor}
                      isClient={isClient}
                      role={role}
                      onShootUpdate={loadShoot}
                      onSelectionChange={setSelectedFileIds}
                      displayTab={activeMediaDisplayTab}
                      onDisplayTabChange={setActiveMediaDisplayTab}
                    />
                  </TabsContent>

                  <TabsContent value="issues" className="mt-0 p-4 sm:p-6" style={{ flex: '0 0 auto', height: 'auto' }}>
                    <div className="max-w-7xl mx-auto">
                      <ShootDetailsPanelUnitChrome shoot={shoot} />
                      <ShootDetailsIssuesTab
                        shoot={shoot}
                        isAdmin={isAdmin}
                        isPhotographer={isPhotographer}
                        isEditor={isEditor}
                        isClient={isClient}
                        role={role}
                        onShootUpdate={loadShoot}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="tour" className="mt-0 p-4 sm:p-6" style={{ flex: '0 0 auto', height: 'auto' }}>
                    <div className="max-w-7xl mx-auto">
                      {activeTab === 'tour' && (
                        <React.Suspense fallback={null}>
                          <LazyShootDetailsTourTab
                            shoot={shoot}
                            editorUser={{ ...user, role }}
                            isAdmin={isAdmin}
                            isRep={isRep}
                            isClient={isClient}
                            onShootUpdate={loadShoot}
                          />
                        </React.Suspense>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="slideshow" className="mt-0 p-4 sm:p-6" style={{ flex: '0 0 auto', height: 'auto' }}>
                    <div className="max-w-7xl mx-auto">
                      <ShootDetailsPanelUnitChrome shoot={shoot} />
                      <ShootDetailsSlideshowTab
                        shoot={shoot}
                        isAdmin={isAdmin}
                        onShootUpdate={loadShoot}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="mt-0 p-4 sm:p-6" style={{ flex: '0 0 auto', height: 'auto' }}>
                    <div className="max-w-7xl mx-auto">
                      <ShootDetailsPanelUnitChrome shoot={shoot} />
                      <ShootDetailsSettingsTab
                        shoot={shoot}
                        isAdmin={isAdmin}
                        isRep={isRep}
                        onShootUpdate={loadShoot}
                      />
                    </div>
                  </TabsContent>

                  {(isAdmin || isRep) && (
                    <TabsContent value="activity" className="!mt-0 !pt-0 px-4 sm:px-6 pb-4 sm:pb-6 overflow-y-auto" style={{ marginTop: 0, paddingTop: 0, flex: '0 0 auto', height: 'auto' }}>
                      <div className="max-w-7xl mx-auto !pt-0 !mt-0" style={{ paddingTop: 0, marginTop: 0 }}>
                        <ShootDetailsPanelUnitChrome shoot={shoot} />
                        <ShootDetailsActivityLogTab
                          shoot={shoot}
                          isAdmin={isAdmin}
                          onShootUpdate={loadShoot}
                        />
                      </div>
                    </TabsContent>
                  )}

                  <TabsContent value="notes" className="!mt-0 !pt-0 px-4 sm:px-6 pb-4 sm:pb-6" style={{ flex: '0 0 auto', height: 'auto' }}>
                    <div className="max-w-7xl mx-auto pt-0">
                      <ShootDetailsPanelUnitChrome shoot={shoot} />
                      <ShootDetailsNotesTab
                        contextualSearch
                        shoot={shoot}
                        isAdmin={isAdmin}
                        isPhotographer={isPhotographer}
                        isEditor={isEditor}
                        role={role}
                        onShootUpdate={loadShoot}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* The record preserves each role's permitted service/contact details. */}
            {shoot && (
            <div className="shoot-workspace-record">
              <ShootDetailsSidebar
                shoot={shoot}
                isSuperAdmin={isSuperAdmin}
                isAdmin={isAdmin}
                isPhotographer={isPhotographer}
                isEditor={isEditor}
                isEditingManager={isEditingManager}
                onShootUpdate={loadShoot}
                onMarkPaid={() => setIsMarkPaidDialogOpen(true)}
                onReschedule={isAdmin ? () => setIsRescheduleDialogOpen(true) : undefined}
                serviceActions={isAdmin ? <AddServiceDialog shoot={shoot} onShootUpdate={loadShoot} /> : undefined}
              />
            </div>
            )}
          </div>
          {shoot && (
            <details className="shoot-workspace-mobile-record">
              <summary>Shoot record <ChevronRight /></summary>
              <div className="shoot-workspace-mobile-record-content">
                <ShootDetailsSidebar
                  shoot={shoot}
                  isSuperAdmin={isSuperAdmin}
                  isAdmin={isAdmin}
                  isPhotographer={isPhotographer}
                  isEditor={isEditor}
                  isEditingManager={isEditingManager}
                  onShootUpdate={loadShoot}
                  onMarkPaid={() => setIsMarkPaidDialogOpen(true)}
                  onReschedule={isAdmin ? () => setIsRescheduleDialogOpen(true) : undefined}
                  serviceActions={isAdmin ? <AddServiceDialog shoot={shoot} onShootUpdate={loadShoot} /> : undefined}
                />
              </div>
            </details>
          )}
        </div>

      {shoot && (
        <ShootDetailsPageDialogs
          shoot={shoot}
          amountDue={amountDue}
          shootServices={shootServices}
          serviceItems={paymentServiceItems}
          formatDate={formatDate}
          formatTime={formatTime}
          isPaymentDialogOpen={isPaymentDialogOpen}
          isMarkPaidDialogOpen={isMarkPaidDialogOpen}
          isRescheduleDialogOpen={isRescheduleDialogOpen}
          isOnHoldDialogOpen={isOnHoldDialogOpen}
          isHoldApprovalDialogOpen={isHoldApprovalDialogOpen}
          isDownloadDialogOpen={isDownloadDialogOpen}
          isDownloading={isDownloading}
          downloadStatusMessage={downloadStatusMessage}
          isClient={isClient}
          canClientDownloadWholeShoot={clientReleaseAccess.canClientDownloadWholeShoot}
          canClientAccessTours={clientReleaseAccess.canClientAccessTours}
          onHoldReason={onHoldReason}
          holdNotifications={holdNotifications}
          holdDialogTitle={holdDialogTitle}
          holdDialogDescription={holdDialogDescription}
          holdSubmitLabel={holdSubmitLabel}
          holdProcessing={holdProcessing}
          onPaymentDialogClose={() => setIsPaymentDialogOpen(false)}
          onMarkPaidDialogClose={() => setIsMarkPaidDialogOpen(false)}
          onRescheduleClose={() => {
            setIsRescheduleDialogOpen(false);
            void loadShoot();
          }}
          onOnHoldDialogChange={setIsOnHoldDialogOpen}
          onHoldApprovalDialogChange={setIsHoldApprovalDialogOpen}
          onDownloadDialogChange={setIsDownloadDialogOpen}
          onOnHoldReasonChange={setOnHoldReason}
          onPaymentSuccess={handlePaymentSuccess}
          onMarkPaidConfirm={handleMarkPaidConfirm}
          onSubmitHold={handleMarkOnHold}
          onRejectHold={handleRejectHold}
          onApproveHold={handleApproveHold}
          onDownloadMedia={handleDownloadMedia}
          onDownloadFile={handleDownloadFile}
        />
      )}
      {shoot && isOverviewModalOpen && (
        <ShootOverviewModal
          shootId={shoot.id}
          isOpen={isOverviewModalOpen}
          onClose={closeOverviewModal}
          currentRole={role}
          onShootUpdate={loadShoot}
          initialTab="overview"
          shouldHideClientDetails={isEditor}
        />
      )}
      </ShootUnitScopeProvider>
    </DashboardLayout>
  );
};

const ShootDetailsWithBoundary = withErrorBoundary(ShootDetails);

export default React.memo(ShootDetailsWithBoundary);
