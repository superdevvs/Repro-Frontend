import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiClient, getApiHeaders } from '@/services/api';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Cloud,
  Copy,
  ExternalLink,
  MapPin,
  MoreVertical,
  Send,
  CheckCircle,
  DollarSign,
  User,
  Camera,
  Phone,
  Mail,
  Building,
  ChevronRight,
  Layers,
  Image as ImageIcon,
  Upload,
  PauseCircle,
  Download,
  Share2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { withErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAuth } from '@/components/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ShootData } from '@/types/shoots';
import { getStateFullName } from '@/utils/stateUtils';
import { format } from 'date-fns';
import { API_BASE_URL } from '@/config/env';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { registerShootDetailRefresh } from '@/realtime/realtimeRefreshBus';
import { useShootDetailsScreen } from '@/components/shoots/modal/useShootDetailsScreen';
import {
  getShootDetailsPaymentBadge,
  getShootDetailsServiceNames,
  getShootDetailsWorkflowBadge,
} from '@/components/shoots/details/shootDetailsPresentation';
import { ShootDetailsPageHeader } from '@/components/shoots/details/ShootDetailsPageHeader';
import { ShootDetailsPageDialogs } from '@/components/shoots/details/ShootDetailsPageDialogs';

// Import tab components
import { ShootDetailsMediaTab } from '@/components/shoots/tabs/ShootDetailsMediaTab';
import { ShootDetailsNotesTab } from '@/components/shoots/tabs/ShootDetailsNotesTab';
import { ShootDetailsSettingsTab } from '@/components/shoots/tabs/ShootDetailsSettingsTab';
import { ShootDetailsTourTab } from '@/components/shoots/tabs/ShootDetailsTourTab';
import { ShootDetailsSlideshowTab } from '@/components/shoots/tabs/ShootDetailsSlideshowTab';
import { ShootDetailsActivityLogTab } from '@/components/shoots/tabs/ShootDetailsActivityLogTab';
import { ShootDetailsIssuesTab } from '@/components/shoots/tabs/ShootDetailsIssuesTab';
import { ShootDetailsSidebar } from '@/components/shoots/tabs/ShootDetailsSidebar';
import { AddServiceDialog } from '@/components/shoots/AddServiceDialog';
import { MarkAsPaidDialog, MarkAsPaidPayload } from '@/components/payments/MarkAsPaidDialog';
import { RescheduleDialog } from '@/components/dashboard/RescheduleDialog';

type ShootWorkflowLog = {
  action?: string | null;
  [key: string]: unknown;
};

type ShootWithWorkflowLogs = ShootData & {
  workflowLogs?: ShootWorkflowLog[];
  workflow_logs?: ShootWorkflowLog[];
};

const getShootDetailsErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const errorWithResponse = error as {
      message?: unknown;
      response?: { data?: { message?: unknown; error?: unknown } };
    };

    const responseMessage = errorWithResponse.response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim()) {
      return responseMessage;
    }

    const responseError = errorWithResponse.response?.data?.error;
    if (typeof responseError === 'string' && responseError.trim()) {
      return responseError;
    }

    if (typeof errorWithResponse.message === 'string' && errorWithResponse.message.trim()) {
      return errorWithResponse.message;
    }
  }

  return fallback;
};

const getShootWorkflowLogs = (shoot: ShootData | null | undefined): ShootWorkflowLog[] => {
  if (!shoot) {
    return [];
  }

  const shootWithWorkflowLogs = shoot as ShootWithWorkflowLogs;
  return shootWithWorkflowLogs.workflowLogs ?? shootWithWorkflowLogs.workflow_logs ?? [];
};

const ShootDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { formatTemperature, formatTime, formatDate } = useUserPreferences();
  const [activeTab, setActiveTab] = useState('media');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);
  const [isOnHoldDialogOpen, setIsOnHoldDialogOpen] = useState(false);
  const [onHoldReason, setOnHoldReason] = useState('');
  const [isHoldApprovalDialogOpen, setIsHoldApprovalDialogOpen] = useState(false);
  const [holdProcessing, setHoldProcessing] = useState(false);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [isEditorDownloading, setIsEditorDownloading] = useState(false);
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);
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
    authRole: user?.role,
    userId: user?.id,
  });
  const normalizedRole = role.toLowerCase();
  const isSuperAdmin = normalizedRole === 'superadmin';
  const isAdminOrSuperAdmin = isAdmin;
  const canReviewHoldRequest = isAdminOrRep && isHoldRequested;
  const workflowBadge = getShootDetailsWorkflowBadge(shoot?.workflowStatus || shoot?.status);
  const paymentBadge = getShootDetailsPaymentBadge(shoot?.payment);
  const shootServices = getShootDetailsServiceNames(shoot);

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

  // Editor download raw files
  const handleEditorDownloadRaw = async () => {
    if (!shoot) return;
    try {
      setIsEditorDownloading(true);
      const headers = getApiHeaders();
      headers.Accept = 'application/json, application/zip';
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/editor-download-raw`, {
        headers,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || 'Download failed');
      }

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.type === 'redirect' && data.url) {
          window.open(data.url, '_blank');
          toast({ title: 'Download started', description: data.message || 'Raw files downloading.' });
        }
      } else {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shoot-${shoot.id}-raw-files.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ title: 'Download started', description: 'Raw files downloaded.' });
      }
    } catch (error: unknown) {
      toast({ title: 'Error', description: getShootDetailsErrorMessage(error, 'Failed to download raw files.'), variant: 'destructive' });
    } finally {
      setIsEditorDownloading(false);
    }
  };

  // Editor generate share link
  const handleGenerateShareLink = async () => {
    if (!shoot) return;
    try {
      setIsGeneratingShareLink(true);
      const headers = getApiHeaders();
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/generate-share-link`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to generate share link' }));
        throw new Error(errorData.error || 'Failed to generate share link');
      }

      const data = await res.json();
      await navigator.clipboard.writeText(data.share_link);
      toast({ title: 'Share link generated!', description: 'Link copied to clipboard. Lifetime link.' });
      loadShoot();
    } catch (error: unknown) {
      toast({ title: 'Error', description: getShootDetailsErrorMessage(error, 'Failed to generate share link.'), variant: 'destructive' });
    } finally {
      setIsGeneratingShareLink(false);
    }
  };

  const handleCreatePaymentLink = async () => {
    if (!shoot) return;
    setCreatingPayment(true);
    try {
      const response = await apiClient.post(`/shoots/${shoot.id}/create-checkout-link`);
      const url = response.data?.url || response.data?.checkout_url || response.data?.checkoutUrl;
      if (url) {
        window.open(url, '_blank');
        toast({ title: 'Payment Link Created', description: 'Payment window opened. Complete payment to update status.' });
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
    if (!shoot) return;
    try {
      const headers = getApiHeaders();
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/send-to-editing`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ editor_id: shoot.editor?.id }),
      });

      if (!res.ok) throw new Error('Failed to send to editing');

      toast({
        title: 'Success',
        description: 'Shoot sent to editing',
      });
      loadShoot();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send to editing',
        variant: 'destructive',
      });
    }
  };

  const handleFinalise = async () => {
    if (!shoot) return;
    try {
      const headers = getApiHeaders();
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/finalize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ final_status: 'admin_verified' }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to finalize shoot' }));
        throw new Error(errorData.message || 'Failed to finalize shoot');
      }

      const isQueued = res.status === 202;

      toast({
        title: isQueued ? 'Finalize started' : 'Success',
        description: isQueued
          ? 'Finalize started in background. You can continue working.'
          : 'Shoot finalized and delivered',
      });

      if (!isQueued) {
        loadShoot();
        return;
      }

      const deliveredStatuses = ['delivered', 'ready', 'ready_for_client', 'admin_verified'];
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const latestShoot = await loadShoot();
        const latestStatus = String(latestShoot?.workflowStatus || latestShoot?.status || '').toLowerCase();
        if (deliveredStatuses.includes(latestStatus)) {
          toast({
            title: 'Finalize complete',
            description: 'Shoot is now delivered.',
          });
          return;
        }

        const workflowLogs = getShootWorkflowLogs(latestShoot);
        const hasFinalizeFailure = Array.isArray(workflowLogs)
          && workflowLogs.some((log) => String(log.action || '').toLowerCase() === 'finalize_failed');

        if (hasFinalizeFailure) {
          toast({
            title: 'Finalize failed',
            description: 'Finalize failed in background. Check Activity Log for details.',
            variant: 'destructive',
          });
          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 4000));
      }

      toast({
        title: 'Still processing',
        description: 'Finalize is still running in background. Check back in a moment.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getShootDetailsErrorMessage(error, 'Failed to finalize shoot'),
        variant: 'destructive',
      });
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

    try {
      const headers = getApiHeaders();
      const endpoint = isHoldRequest ? 'request-hold' : 'put-on-hold';
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: onHoldReason.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || (isHoldRequest ? 'Failed to request hold' : 'Failed to put shoot on hold')
        );
      }

      toast({
        title: isHoldRequest ? 'Hold request submitted' : 'Shoot put on hold',
        description: isHoldRequest
          ? 'Your hold request is pending admin approval.'
          : 'The shoot has been successfully marked on hold.',
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
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve hold request');
      }

      toast({
        title: 'Hold approved',
        description: 'The shoot has been placed on hold.',
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
    const amount = outstandingAmount;

    const body: {
      payment_type: MarkAsPaidPayload['paymentMethod'];
      amount: number;
      payment_details?: MarkAsPaidPayload['paymentDetails'];
      payment_date?: MarkAsPaidPayload['paymentDate'];
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

  const fullAddress = shoot?.location?.fullAddress || 
    (shoot?.location ? `${shoot.location.address}, ${shoot.location.city}, ${getStateFullName(shoot.location.state)} ${shoot.location.zip}`.trim() : '');
  const canShowIssuesTab = visibleTabs.some((tab) => tab.id === 'issues');
  const canShowToursTab = visibleTabs.some((tab) => tab.id === 'tours');
  const canShowSettingsTab = visibleTabs.some((tab) => tab.id === 'settings');
  const canShowNotesTab = visibleTabs.some((tab) => tab.id === 'notes');

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[70vh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!shoot) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
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

  const formattedDate = shoot.scheduledDate ? formatDate(new Date(shoot.scheduledDate)) : 'Not scheduled';
  const formattedTime = shoot.time || 'TBD';
  const addressParts = fullAddress.split(',');

  return (
    <DashboardLayout className="!p-0">
      <div className="flex flex-col min-h-screen bg-background">
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
          canShowIssuesTab={canShowIssuesTab}
          canShowToursTab={canShowToursTab}
          canShowSettingsTab={canShowSettingsTab}
          canShowNotesTab={canShowNotesTab}
          canShowActivity={isAdmin || isRep}
          holdActionLabel={holdActionLabel}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          onBack={() => navigate('/shoot-history')}
          onCopyAddress={copyAddress}
          onOpenInMaps={openInMaps}
          onOpenHoldDialog={() => setIsOnHoldDialogOpen(true)}
          onOpenHoldApprovalDialog={() => setIsHoldApprovalDialogOpen(true)}
          onSendToEditing={handleSendToEditing}
          onFinalise={handleFinalise}
          onProcessPayment={handleProcessPayment}
          onDownloadRaw={handleEditorDownloadRaw}
          onGenerateShareLink={handleGenerateShareLink}
          rawFileCount={rawFileCount}
          isEditorDownloading={isEditorDownloading}
          isGeneratingShareLink={isGeneratingShareLink}
        />

          {/* Premium Summary Card */}
          <div className="px-3 sm:px-6 py-3 sm:py-4">
            <Card className="border-2 shadow-lg bg-gradient-to-br from-background via-background to-muted/20 hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 flex-1 w-full sm:w-auto">
                    {/* Service Card */}
                    <div className="flex items-start gap-3 w-full sm:w-auto">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1.5">Services</p>
                        {shootServices.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {shootServices.map((serviceName, index) => (
                              <Badge key={index} variant="outline" className="text-xs px-2 py-0.5">
                                {serviceName}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No services</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions - Stack on mobile (Admin only) */}
                  {isAdmin && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      <AddServiceDialog shoot={shoot} onShootUpdate={loadShoot} />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs w-full sm:w-auto"
                        onClick={() => setIsRescheduleDialogOpen(true)}
                      >
                        Reschedule
                      </Button>
                    </div>
                  )}
                  {/* Photographer info for editor/photographer - right aligned */}
                  {isPhotographer && shoot.photographer?.name && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                      <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Camera className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Photographer</p>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm">{shoot.photographer.name}</p>
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area with Tabs and Sidebar */}
          <div className="flex-1 flex min-h-0">
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Tab Content */}
              <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${activeTab === 'media' ? '' : 'h-auto'}`}>
                <Tabs value={activeTab} onValueChange={setActiveTab} className={`flex flex-col min-h-0 ${activeTab === 'media' ? 'flex-1 h-full' : 'h-auto'}`}>
                  <TabsContent value="media" className="!mt-0 !p-0 bg-background flex-1 flex flex-col min-h-0 overflow-hidden" style={{ display: 'flex', flexDirection: 'column', margin: 0, padding: 0, height: '100%' }}>
                    <ShootDetailsMediaTab
                      shoot={shoot}
                      isAdmin={isAdmin}
                      isPhotographer={isPhotographer}
                      isEditor={isEditor}
                      isClient={isClient}
                      role={role}
                      onShootUpdate={loadShoot}
                    />
                  </TabsContent>

                  <TabsContent value="issues" className="mt-0 p-4 sm:p-6" style={{ flex: '0 0 auto', height: 'auto' }}>
                    <div className="max-w-7xl mx-auto">
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
                      <ShootDetailsTourTab
                        shoot={shoot}
                        isAdmin={isAdmin}
                        isRep={isRep}
                        isClient={isClient}
                        onShootUpdate={loadShoot}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="slideshow" className="mt-0 p-4 sm:p-6" style={{ flex: '0 0 auto', height: 'auto' }}>
                    <div className="max-w-7xl mx-auto">
                      <ShootDetailsSlideshowTab
                        shoot={shoot}
                        isAdmin={isAdmin}
                        onShootUpdate={loadShoot}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="mt-0 p-4 sm:p-6" style={{ flex: '0 0 auto', height: 'auto' }}>
                    <div className="max-w-7xl mx-auto">
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
                      <ShootDetailsNotesTab
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

            {/* Right Sidebar - Shoot Insights Panel (hidden for photographers and editors) */}
            {!isPhotographer && !isEditor && (
            <div className="hidden lg:block flex-shrink-0">
              <ShootDetailsSidebar
                shoot={shoot}
                isSuperAdmin={isSuperAdmin}
                isAdmin={isAdmin}
                isPhotographer={isPhotographer}
                isEditor={isEditor}
                isEditingManager={isEditingManager}
                onShootUpdate={loadShoot}
                onMarkPaid={() => setIsMarkPaidDialogOpen(true)}
              />
            </div>
            )}
          </div>
        </div>

      {shoot && (
        <ShootDetailsPageDialogs
          shoot={shoot}
          amountDue={amountDue}
          shootServices={shootServices}
          formatDate={formatDate}
          formatTime={formatTime}
          isPaymentDialogOpen={isPaymentDialogOpen}
          isMarkPaidDialogOpen={isMarkPaidDialogOpen}
          isRescheduleDialogOpen={isRescheduleDialogOpen}
          isOnHoldDialogOpen={isOnHoldDialogOpen}
          isHoldApprovalDialogOpen={isHoldApprovalDialogOpen}
          onHoldReason={onHoldReason}
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
          onOnHoldReasonChange={setOnHoldReason}
          onPaymentSuccess={handlePaymentSuccess}
          onMarkPaidConfirm={handleMarkPaidConfirm}
          onSubmitHold={handleMarkOnHold}
          onRejectHold={handleRejectHold}
          onApproveHold={handleApproveHold}
        />
      )}
    </DashboardLayout>
  );
};

const ShootDetailsWithBoundary = withErrorBoundary(ShootDetails);

export default React.memo(ShootDetailsWithBoundary);
