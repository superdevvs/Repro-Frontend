import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarIcon,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClockIcon,
  Loader2,
  MapPinIcon,
  PauseCircle,
  PlayCircle,
  Send,
  Upload,
} from "lucide-react";
import { ShootData } from '@/types/shoots';
import { transformShootFromApi } from '@/context/ShootsContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useShoots } from '@/context/ShootsContext';
import { useShootRealtime } from '@/hooks/use-shoot-realtime';
import { getWeatherForLocation, WeatherInfo } from '@/services/weatherService';
import { subscribeToWeatherProvider } from '@/state/weatherProviderStore';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useShootDetailsScreen } from './modal/useShootDetailsScreen';
import { useShootDetailsModalActions } from './modal/useShootDetailsModalActions';
import { useShootDetailsModalPayments } from './modal/useShootDetailsModalPayments';
import { useShootDetailsModalWorkflow } from './modal/useShootDetailsModalWorkflow';
import { useShootDetailsModalSave } from './modal/useShootDetailsModalSave';
import {
  getShootDetailsCreatedByLabel,
  getShootDetailsStatusBadgeInfo,
} from './details/shootDetailsPresentation';
import {
  ShootDetailsModalActionRail,
  ShootDetailsModalHeader,
} from './details/ShootDetailsModalActionRail';
import { ShootDetailsModalBody } from './details/ShootDetailsModalBody';
import { ShootDetailsModalDialogs } from './details/ShootDetailsModalDialogs';

interface ShootDetailsModalProps {
  shootId: string | number;
  isOpen: boolean;
  onClose: () => void;
  currentRole?: string; // Optional override, defaults to auth role
  onShootUpdate?: () => void; // Callback to refresh shoot list when shoot is updated
  initialWeather?: WeatherInfo | null; // Pre-fetched weather from dashboard to avoid re-fetching
  onModify?: () => void; // Callback to modify/edit the shoot request
  photographers?: Array<{ id: string | number; name: string; avatar?: string }>; // For approval modal
  initialTab?: 'overview' | 'notes' | 'issues' | 'tours' | 'settings';
  openDownloadDialog?: boolean;
  shouldHideClientDetails?: boolean;
}

export function ShootDetailsModal({ 
  shootId, 
  isOpen, 
  onClose,
  currentRole,
  onShootUpdate,
  initialWeather,
  onModify,
  photographers = [],
  initialTab = 'overview',
  openDownloadDialog = false,
  shouldHideClientDetails: shouldHideClientDetailsProp = false,
}: ShootDetailsModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role: authRole, user } = useAuth();
  const { toast } = useToast();
  const { updateShoot } = useShoots();
  const { formatTemperature, formatTime } = useUserPreferences();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'issues' | 'tours' | 'settings' | 'media'>(
    initialTab,
  );
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [providerVersion, setProviderVersion] = useState(0);
  const [isMediaExpanded, setIsMediaExpanded] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [showTourAnalytics, setShowTourAnalytics] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editActions, setEditActions] = useState<{ save: () => void; cancel: () => void } | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);

  const {
    shoot,
    setShoot,
    shootLoading: loading,
    shootError,
    refreshShoot,
    rawFileCount,
    currentUserRole,
    roleFlags: {
      isEditingManager,
      isAdmin,
      isRep,
      isAdminOrRep,
      isPhotographer,
      isEditor,
      isClient,
    },
    shouldHideClientDetails,
    isRequestedStatus,
    visibleTabs,
    capabilities: {
      normalizedStatus,
      isDelivered,
      isUploadedStatus,
      isEditingStatus,
      isCancelledOrDeclined,
      canShowInvoiceButton,
      canFinalise,
      canSendToEditing,
      mmmRedirectUrl,
      canStartMmmPunchout,
      showMmmPunchoutButtons,
      canNotifyClient,
      canNotifyPhotographer,
      isScheduledOrOnHold,
      canAdminEdit,
      isOnHold,
      canPutOnHold,
      isHoldRequested,
      canDirectHold,
      canRequestHold,
      canUserPutOnHold,
      holdActionLabel,
      holdDialogTitle,
      holdDialogDescription,
      holdSubmitLabel,
      canResumeFromHold,
      canWithdrawRequestedShoot,
      canRequestCancellation,
      canCancelShoot,
      cancelActionLabel,
      cancelDialogTitle,
      cancelDialogDescription,
      cancelSubmitLabel,
    },
  } = useShootDetailsScreen({
    shootId: isOpen ? shootId : null,
    enabled: isOpen && Boolean(shootId),
    currentRole,
    authRole,
    userId: user?.id,
    shouldHideClientDetailsProp,
  });
  const createdByLabel = useMemo(
    () => getShootDetailsCreatedByLabel(shoot),
    [shoot],
  );

  // Subscribe to weather provider updates
  useEffect(() => {
    const unsubscribe = subscribeToWeatherProvider(() => {
      setProviderVersion((version) => version + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Handle errors - only show toast if modal is open and we have an error
  useEffect(() => {
    if (isOpen && shootError) {
      const errorMessage = shootError instanceof Error 
        ? shootError.message 
        : 'Failed to load shoot details';
      
      // Provide more helpful error messages
      let userMessage = errorMessage;
      if (errorMessage.includes('Network error') || errorMessage.includes('Failed to fetch')) {
        userMessage = 'Unable to load shoot details. Please check your connection and try again.';
      } else if (errorMessage.includes('Unauthorized')) {
        userMessage = 'Session expired. Please refresh the page.';
      } else if (errorMessage.includes('not found')) {
        userMessage = 'Shoot not found. It may have been deleted.';
      }
      
      toast({
        title: 'Error',
        description: userMessage,
        variant: 'destructive',
      });
    }
  }, [isOpen, shootError, toast]);

  // Use initialWeather from dashboard if provided, otherwise fetch
  useEffect(() => {
    if (initialWeather) {
      setWeather(initialWeather);
      return;
    }

    // If initialWeather is provided from dashboard, use it immediately
    if (initialWeather) {
      setWeather(initialWeather);
      return;
    }

    // Only fetch if no initialWeather and we have shoot data
    if (!shoot) {
      return;
    }

    // Build the fullest possible location string for weather accuracy.
    let location: string | null = null;
    
    if (shoot.location?.address || shoot.location?.fullAddress || shoot.location?.city || shoot.location?.state) {
      const parts = [
        shoot.location?.fullAddress ?? shoot.location?.address ?? null,
        [shoot.location?.city, shoot.location?.state, shoot.location?.zip].filter(Boolean).join(', '),
      ].filter((part): part is string => Boolean(part && part.trim()));
      location = parts.join(', ');
    } else if ((shoot as any).addressLine || (shoot as any).cityStateZip) {
      const parts = [(shoot as any).addressLine, (shoot as any).cityStateZip]
        .filter((part): part is string => Boolean(part && part.trim()));
      location = parts.join(', ');
    }
    
    if (!location) {
      setWeather(null);
      return;
    }

    const controller = new AbortController();

    // Build datetime for weather - combine scheduledDate and time
    let dateInput: string | undefined = (shoot as any).startTime;
    if (!dateInput && shoot.scheduledDate) {
      // Combine date and time for accurate weather lookup
      const time = shoot.time || '12:00';
      dateInput = `${shoot.scheduledDate} ${time}`;
    }

    getWeatherForLocation(location, dateInput, controller.signal)
      .then((info) => {
        setWeather(info || null);
      })
      .catch(() => {
        setWeather(null);
      });

    return () => {
      controller.abort();
    };
  }, [shoot?.id, shoot?.location?.city, shoot?.location?.state, shoot?.scheduledDate, shoot?.time, isOpen, providerVersion, initialWeather, formatTemperature]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as typeof activeTab);
    if (value !== 'tours') setShowTourAnalytics(false);
  };

  useEffect(() => {
    if (!isOpen || !openDownloadDialog) return;
    setIsDownloadDialogOpen(true);
  }, [isOpen, openDownloadDialog]);

  // Refresh shoot data AND notify parent to update its list/cards
  const refreshShootAndParent = useCallback(async (): Promise<ShootData | null> => {
    const result = await refreshShoot();
    if (onShootUpdate) {
      try { onShootUpdate(); } catch (e) { /* ignore */ }
    }
    return result;
  }, [refreshShoot, onShootUpdate]);

  const {
    amountDue,
    isPaid,
    isPaymentDialogOpen,
    setIsPaymentDialogOpen,
    isMarkPaidDialogOpen,
    setIsMarkPaidDialogOpen,
    isInvoiceDialogOpen,
    setIsInvoiceDialogOpen,
    selectedInvoice,
    setSelectedInvoice,
    isLoadingInvoice,
    handleProcessPayment,
    handleMarkPaidConfirm,
    handlePaymentSuccess,
    handleShowInvoice,
  } = useShootDetailsModalPayments({
    shoot,
    queryClient,
    refreshShoot,
    formatTime,
    navigate,
    toast,
  });

  useShootRealtime({
    shootId: Number(shootId) || null,
    userRole: currentUserRole,
    userId: user?.id ?? null,
    onActivity: () => {
      queryClient.invalidateQueries({ queryKey: ['shoot', shootId] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shootId] });
      refreshShootAndParent().catch((error) => {
        console.error('Failed to refresh shoot after realtime activity:', error);
      });
    },
  });

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusInfo = getShootDetailsStatusBadgeInfo(status);
    return <Badge className={statusInfo.className}>{statusInfo.label}</Badge>;
  };

  // Check if shoot is within 3-4 hours of scheduled time
  const isWithinCancellationFeeWindow = useMemo(() => {
    if (!shoot?.scheduledDate || !shoot?.time) return false;
    
    try {
      // Parse scheduled date and time
      const scheduledDate = new Date(shoot.scheduledDate);
      const [hours, minutes] = shoot.time.split(':').map(Number);
      scheduledDate.setHours(hours, minutes || 0, 0, 0);
      
      // Get current time
      const now = new Date();
      
      // Calculate time difference in hours
      const hoursUntilShoot = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Check if within 3-4 hours (between 0 and 4 hours)
      return hoursUntilShoot >= 0 && hoursUntilShoot <= 4;
    } catch (error) {
      console.error('Error calculating cancellation fee window:', error);
      return false;
    }
  }, [shoot?.scheduledDate, shoot?.time]);

  const {
    isOnHoldDialogOpen,
    setIsOnHoldDialogOpen,
    onHoldReason,
    setOnHoldReason,
    isCancellationFeeDialogOpen,
    setIsCancellationFeeDialogOpen,
    shouldAddCancellationFee,
    setShouldAddCancellationFee,
    setPendingAction,
    isCancelShootDialogOpen,
    setIsCancelShootDialogOpen,
    cancelShootReason,
    setCancelShootReason,
    isCancellingShoot,
    handleSendToEditing,
    handleFinalise,
    handleMarkOnHoldClick,
    handleMarkOnHold,
    handleCancellationFeeConfirm,
    handleCancelShoot,
    handleCancelShootClick,
    handleResumeFromHold,
  } = useShootDetailsModalWorkflow({
    shoot,
    isClient,
    canWithdrawRequestedShoot,
    canRequestCancellation,
    isWithinCancellationFeeWindow,
    refreshShoot,
    setShoot,
    updateShoot,
    onShootUpdate,
    toast,
  });

  const {
    isPublishingToBrightMls,
    brightMlsRedirectUrl,
    setBrightMlsRedirectUrl,
    isDownloadDialogOpen,
    setIsDownloadDialogOpen,
    isDownloading,
    isGeneratingShareLink,
    printComingSoonOpen,
    setPrintComingSoonOpen,
    selectedFileIds,
    setSelectedFileIds,
    handleSendToBrightMls,
    handleEditorDownloadRaw,
    handleGenerateShareLink,
    handleDownloadMedia,
  } = useShootDetailsModalActions({
    shoot,
    isPhotographer,
    refreshShoot,
    toast,
  });
  const {
    isSavingChanges,
    isSaveConfirmOpen,
    pendingUpdates,
    notifyClientOnSave,
    notifyPhotographerOnSave,
    setIsSaveConfirmOpen,
    setPendingUpdates,
    setNotifyClientOnSave,
    setNotifyPhotographerOnSave,
    handleSaveRequest,
    handleConfirmSave,
  } = useShootDetailsModalSave({
    shoot,
    setShoot,
    setIsEditMode,
    refreshShoot,
    updateShoot,
    onShootUpdate,
    toast,
    canNotifyClient,
    canNotifyPhotographer,
  });

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  const statusBadge = shoot
    ? getStatusBadge(shoot.status || shoot.workflowStatus || 'booked')
    : null;
  const addressTitle = shoot
    ? (() => {
        let address = shoot.location?.address || (shoot as any).address || '';
        const city = shoot.location?.city || (shoot as any).city || '';
        const state = shoot.location?.state || (shoot as any).state || '';
        const zip = shoot.location?.zip || (shoot as any).zip || '';
        if (address && (city || state || zip)) {
          let streetAddress = address;
          if (city) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${city}\\s*,?`, 'i'), '');
          if (state) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${state}\\s*,?`, 'i'), '');
          if (zip) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${zip}\\s*`, 'i'), '');
          streetAddress = streetAddress.replace(/[,\s]+$/, '').trim();
          if (streetAddress) return streetAddress;
        }
        return address || shoot.location?.fullAddress || 'Shoot Details';
      })()
    : 'Shoot Details';

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[min(90vw,16rem)] sm:max-w-6xl max-h-[90vh] rounded-2xl sm:rounded-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {shoot ? (
                <>
                  #{shoot.id} · Shoot Details
                </>
              ) : (
                'Shoot Details'
              )}
            </DialogTitle>
            <DialogDescription>Loading shoot details</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-12 sm:p-8 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <div className="text-sm text-muted-foreground">Loading shoot details...</div>
          </div>

        {!isEditMode && !isRequestedStatus && (canUserPutOnHold || canResumeFromHold || canSendToEditing || canFinalise) && (
          <div className="hidden sm:flex sticky bottom-0 w-full border-t bg-background/95 backdrop-blur z-40 px-4 py-3">
            <div className="flex flex-wrap items-center justify-end gap-2 w-full">
              {canUserPutOnHold && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-300 dark:border-amber-800"
                  onClick={handleMarkOnHoldClick}
                >
                  <PauseCircle className="h-3.5 w-3.5 mr-1.5" />
                  <span>{holdActionLabel}</span>
                </Button>
              )}
              {canResumeFromHold && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                  onClick={handleResumeFromHold}
                >
                  <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                  <span>Resume from hold</span>
                </Button>
              )}
              {isAdmin && canSendToEditing && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-800"
                  onClick={handleSendToEditing}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  <span>Send to Editing</span>
                </Button>
              )}
              {canFinalise && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                  onClick={handleFinalise}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  <span>Finalize</span>
                </Button>
              )}
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>
    );
  }

  if (!shoot) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Shoot Details</DialogTitle>
            <DialogDescription>Shoot not found</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Shoot not found</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-screen h-[100dvh] max-w-none rounded-none overflow-hidden flex flex-col p-0 sm:max-w-[95vw] sm:max-h-[95vh] sm:h-[95vh] sm:rounded-lg [&>button.absolute]:hidden [&>button.absolute]:sm:flex">
        {/* DialogHeader for accessibility - must be first child */}
        <DialogHeader className="sr-only">
            <DialogTitle>
              {shoot ? `#${shoot.id} · ${shoot.location?.address || shoot.location?.fullAddress || 'Shoot Details'}` : 'Shoot Details'}
            </DialogTitle>
          <DialogDescription>
            View and manage shoot details including media, notes, issues, and settings
          </DialogDescription>
        </DialogHeader>
        
        <ShootDetailsModalActionRail
          shootAddress={shoot.location?.address || 'Shoot'}
          statusBadge={statusBadge}
          isEditMode={isEditMode}
          editActions={editActions}
          isSavingChanges={isSavingChanges}
          isAdminOrRep={isAdminOrRep}
          isRequestedStatus={isRequestedStatus}
          canAdminEdit={canAdminEdit}
          isScheduledOrOnHold={isScheduledOrOnHold}
          canUserPutOnHold={canUserPutOnHold}
          canResumeFromHold={canResumeFromHold}
          canCancelShoot={canCancelShoot}
          canSendToEditing={canSendToEditing}
          canFinalise={canFinalise}
          canStartMmmPunchout={canStartMmmPunchout}
          showMmmPunchoutButtons={showMmmPunchoutButtons}
          mmmRedirectUrl={mmmRedirectUrl}
          isDelivered={isDelivered}
          isAdmin={isAdmin}
          isEditor={isEditor}
          isPhotographer={isPhotographer}
          isDownloading={isDownloading}
          isGeneratingShareLink={isGeneratingShareLink}
          rawFileCount={rawFileCount}
          selectedFileIds={selectedFileIds}
          isPublishingToBrightMls={isPublishingToBrightMls}
          holdActionLabel={holdActionLabel}
          cancelActionLabel={cancelActionLabel}
          isMobileActionsOpen={isMobileActionsOpen}
          setIsMobileActionsOpen={setIsMobileActionsOpen}
          setIsApprovalModalOpen={setIsApprovalModalOpen}
          setIsDeclineModalOpen={setIsDeclineModalOpen}
          setIsEditMode={setIsEditMode}
          setIsDownloadDialogOpen={setIsDownloadDialogOpen}
          setPrintComingSoonOpen={setPrintComingSoonOpen}
          handleMarkOnHoldClick={handleMarkOnHoldClick}
          handleResumeFromHold={handleResumeFromHold}
          handleCancelShootClick={handleCancelShootClick}
          handleSendToEditing={handleSendToEditing}
          handleFinalise={handleFinalise}
          handleDownloadMedia={handleDownloadMedia}
          handleSendToBrightMls={handleSendToBrightMls}
          handleEditorDownloadRaw={handleEditorDownloadRaw}
          handleGenerateShareLink={handleGenerateShareLink}
          onClose={onClose}
        />
        
        <ShootDetailsModalHeader
          addressTitle={addressTitle}
          createdByLabel={createdByLabel}
          statusBadge={statusBadge}
          activeTab={activeTab}
          visibleTabs={visibleTabs}
          isEditMode={isEditMode}
          isSavingChanges={isSavingChanges}
          editActions={editActions}
          setActiveTab={setActiveTab}
          setIsMobileActionsOpen={setIsMobileActionsOpen}
          onClose={onClose}
        />

        <ShootDetailsModalBody
          shoot={shoot}
          activeTab={activeTab}
          visibleTabs={visibleTabs}
          currentUserRole={currentUserRole}
          weather={weather || null}
          isAdmin={isAdmin}
          isRep={isRep}
          isAdminOrRep={isAdminOrRep}
          isPhotographer={isPhotographer}
          isEditor={isEditor}
          isClient={isClient}
          isEditingManager={isEditingManager}
          shouldHideClientDetails={shouldHideClientDetails}
          isRequestedStatus={isRequestedStatus}
          isCancelledOrDeclined={isCancelledOrDeclined}
          isPaid={isPaid}
          isEditMode={isEditMode}
          isMediaExpanded={isMediaExpanded}
          showHidden={showHidden}
          showTourAnalytics={showTourAnalytics}
          canResumeFromHold={canResumeFromHold}
          canSendToEditing={canSendToEditing}
          canFinalise={canFinalise}
          canShowInvoiceButton={canShowInvoiceButton}
          isLoadingInvoice={isLoadingInvoice}
          setActiveTab={setActiveTab}
          setShowTourAnalytics={setShowTourAnalytics}
          setIsMediaExpanded={setIsMediaExpanded}
          setShowHidden={setShowHidden}
          setSelectedFileIds={setSelectedFileIds}
          setEditActions={setEditActions}
          setIsMarkPaidDialogOpen={setIsMarkPaidDialogOpen}
          handleTabChange={handleTabChange}
          handleProcessPayment={handleProcessPayment}
          handleShowInvoice={handleShowInvoice}
          handleResumeFromHold={handleResumeFromHold}
          handleSendToEditing={handleSendToEditing}
          handleFinalise={handleFinalise}
          handleSaveRequest={handleSaveRequest}
          handleCancelEdit={handleCancelEdit}
          refreshShootAndParent={refreshShootAndParent}
        />
      </DialogContent>
    </Dialog>

      <ShootDetailsModalDialogs
        shoot={shoot}
        shouldHideClientDetails={shouldHideClientDetails}
        photographers={photographers}
        amountDue={amountDue}
        isPaymentDialogOpen={isPaymentDialogOpen}
        isMarkPaidDialogOpen={isMarkPaidDialogOpen}
        isSaveConfirmOpen={isSaveConfirmOpen}
        notifyClientOnSave={notifyClientOnSave}
        notifyPhotographerOnSave={notifyPhotographerOnSave}
        canNotifyClient={canNotifyClient}
        canNotifyPhotographer={canNotifyPhotographer}
        isSavingChanges={isSavingChanges}
        isCancellationFeeDialogOpen={isCancellationFeeDialogOpen}
        shouldAddCancellationFee={shouldAddCancellationFee}
        isOnHoldDialogOpen={isOnHoldDialogOpen}
        onHoldReason={onHoldReason}
        holdDialogTitle={holdDialogTitle}
        holdDialogDescription={holdDialogDescription}
        holdSubmitLabel={holdSubmitLabel}
        isCancelShootDialogOpen={isCancelShootDialogOpen}
        isDelivered={isDelivered}
        cancelDialogTitle={cancelDialogTitle}
        cancelDialogDescription={cancelDialogDescription}
        cancelSubmitLabel={cancelSubmitLabel}
        cancelShootReason={cancelShootReason}
        isWithinCancellationFeeWindow={isWithinCancellationFeeWindow}
        isCancellingShoot={isCancellingShoot}
        isClient={isClient}
        isDownloadDialogOpen={isDownloadDialogOpen}
        isDownloading={isDownloading}
        isApprovalModalOpen={isApprovalModalOpen}
        isDeclineModalOpen={isDeclineModalOpen}
        selectedInvoice={selectedInvoice}
        isInvoiceDialogOpen={isInvoiceDialogOpen}
        brightMlsRedirectUrl={brightMlsRedirectUrl}
        printComingSoonOpen={printComingSoonOpen}
        pendingUpdates={pendingUpdates}
        setIsPaymentDialogOpen={setIsPaymentDialogOpen}
        setIsMarkPaidDialogOpen={setIsMarkPaidDialogOpen}
        setIsSaveConfirmOpen={setIsSaveConfirmOpen}
        setPendingUpdates={setPendingUpdates}
        setNotifyClientOnSave={setNotifyClientOnSave}
        setNotifyPhotographerOnSave={setNotifyPhotographerOnSave}
        setIsCancellationFeeDialogOpen={setIsCancellationFeeDialogOpen}
        setShouldAddCancellationFee={setShouldAddCancellationFee}
        setPendingAction={setPendingAction}
        setIsOnHoldDialogOpen={setIsOnHoldDialogOpen}
        setOnHoldReason={setOnHoldReason}
        setIsCancelShootDialogOpen={setIsCancelShootDialogOpen}
        setCancelShootReason={setCancelShootReason}
        setIsDownloadDialogOpen={setIsDownloadDialogOpen}
        setIsApprovalModalOpen={setIsApprovalModalOpen}
        setIsDeclineModalOpen={setIsDeclineModalOpen}
        setIsInvoiceDialogOpen={setIsInvoiceDialogOpen}
        setSelectedInvoice={setSelectedInvoice}
        setBrightMlsRedirectUrl={setBrightMlsRedirectUrl}
        setPrintComingSoonOpen={setPrintComingSoonOpen}
        handlePaymentSuccess={handlePaymentSuccess}
        handleMarkPaidConfirm={handleMarkPaidConfirm}
        handleConfirmSave={handleConfirmSave}
        handleCancellationFeeConfirm={handleCancellationFeeConfirm}
        handleMarkOnHold={handleMarkOnHold}
        handleCancelShoot={handleCancelShoot}
        handleDownloadMedia={handleDownloadMedia}
        onShootUpdate={onShootUpdate}
        onClose={onClose}
        formatTime={formatTime}
      />
    </>
  );
}
