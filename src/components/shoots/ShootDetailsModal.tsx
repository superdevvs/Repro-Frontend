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
import { useUpload } from '@/context/UploadContext';
import { ConfirmSubmitDialog } from './details/ConfirmSubmitDialog';
import { useShootDetailsScreen } from './modal/useShootDetailsScreen';
import { useShootDetailsModalActions } from './modal/useShootDetailsModalActions';
import { useShootDetailsModalPayments } from './modal/useShootDetailsModalPayments';
import { useShootDetailsModalWorkflow } from './modal/useShootDetailsModalWorkflow';
import { useShootDetailsModalSave } from './modal/useShootDetailsModalSave';
import {
  getShootDetailsCreatedByLabel,
  getShootDetailsPaymentBadge,
  getShootDetailsStatusBadgeInfo,
} from './details/shootDetailsPresentation';
import {
  ShootDetailsModalActionRail,
  ShootDetailsModalHeader,
} from './details/ShootDetailsModalActionRail';
import { ShootDetailsModalBody } from './details/ShootDetailsModalBody';
import { ShootDetailsModalDialogs } from './details/ShootDetailsModalDialogs';
import { getShootClientReleaseAccess } from './details/shootClientReleaseAccess';
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary';

const sanitizeWeatherSegment = (value?: string | null) => value?.replace(/\s+/g, ' ').trim() ?? '';

const buildWeatherLocationQuery = (shoot: ShootData | null) => {
  if (!shoot) return null;

  const fullAddress = sanitizeWeatherSegment(shoot.location?.fullAddress);
  const streetAddress = sanitizeWeatherSegment(shoot.location?.address);
  const city = sanitizeWeatherSegment(shoot.location?.city);
  const state = sanitizeWeatherSegment(shoot.location?.state);
  const zip = sanitizeWeatherSegment(shoot.location?.zip);
  const fallbackAddressLine = sanitizeWeatherSegment((shoot as any).addressLine);
  const fallbackCityStateZip = sanitizeWeatherSegment((shoot as any).cityStateZip);

  if (fullAddress) {
    return fullAddress;
  }

  const parts = [
    streetAddress,
    city,
    [state, zip].filter(Boolean).join(' '),
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  const fallbackParts = [fallbackAddressLine, fallbackCityStateZip].filter(Boolean);
  return fallbackParts.length > 0 ? fallbackParts.join(', ') : null;
};

const buildWeatherDateTime = (shoot: ShootData | null) => {
  if (!shoot) return undefined;

  const startTime = (shoot as any).startTime;
  if (typeof startTime === 'string' && !Number.isNaN(Date.parse(startTime))) {
    return new Date(startTime).toISOString();
  }

  if (!shoot.scheduledDate) {
    return undefined;
  }

  const target = new Date(shoot.scheduledDate);
  if (Number.isNaN(target.getTime())) {
    const parsed = new Date(`${shoot.scheduledDate} ${shoot.time || '12:00'}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  const time = shoot.time || '12:00';
  const twelveHour = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const twentyFourHour = time.match(/^(\d{1,2}):(\d{2})$/);

  if (twelveHour) {
    let hours = parseInt(twelveHour[1], 10);
    const minutes = parseInt(twelveHour[2], 10);
    const period = twelveHour[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    target.setHours(hours, minutes, 0, 0);
  } else if (twentyFourHour) {
    target.setHours(parseInt(twentyFourHour[1], 10), parseInt(twentyFourHour[2], 10), 0, 0);
  } else {
    target.setHours(12, 0, 0, 0);
  }

  return target.toISOString();
};

interface ShootDetailsModalProps {
  shootId: string | number;
  isOpen: boolean;
  onClose: () => void;
  currentRole?: string; // Optional override, defaults to auth role
  onShootUpdate?: () => void; // Callback to refresh shoot list when shoot is updated
  initialWeather?: WeatherInfo | null; // Pre-fetched weather from dashboard to avoid re-fetching
  onModify?: () => void; // Callback to modify/edit the shoot request
  photographers?: Array<{ id: string | number; name: string; avatar?: string }>; // For approval modal
  initialTab?: 'overview' | 'notes' | 'issues' | 'tours' | 'settings' | 'activity';
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
  
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'issues' | 'tours' | 'settings' | 'activity' | 'media'>(
    initialTab,
  );
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [providerVersion, setProviderVersion] = useState(0);
  const [isMediaExpanded, setIsMediaExpanded] = useState(false);
  const [activeMediaDisplayTab, setActiveMediaDisplayTab] = useState<'uploaded' | 'edited'>('uploaded');
  const [showTourAnalytics, setShowTourAnalytics] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editActions, setEditActions] = useState<{ save: () => void; cancel: () => void } | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
  const { uploads: activeUploads } = useUpload();

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
      editedMediaCount,
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
  const weatherLocationQuery = useMemo(
    () => buildWeatherLocationQuery(shoot),
    [shoot, shoot?.location?.address, shoot?.location?.fullAddress, shoot?.location?.city, shoot?.location?.state, shoot?.location?.zip, (shoot as any)?.addressLine, (shoot as any)?.cityStateZip],
  );
  const weatherDateTime = useMemo(
    () => buildWeatherDateTime(shoot),
    [shoot, shoot?.scheduledDate, shoot?.time, (shoot as any)?.startTime],
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

    if (!isOpen) {
      return;
    }

    if (!weatherLocationQuery) {
      setWeather(null);
      return;
    }

    const controller = new AbortController();
    getWeatherForLocation(weatherLocationQuery, weatherDateTime, controller.signal)
      .then((info) => {
        setWeather(info || null);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        setWeather(null);
      });

    return () => {
      controller.abort();
    };
  }, [initialWeather, isOpen, providerVersion, weatherDateTime, weatherLocationQuery]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveMediaDisplayTab(isClient ? 'edited' : 'uploaded');
  }, [isClient, isOpen, shootId]);

  const clientReleaseAccess = useMemo(
    () => getShootClientReleaseAccess(shoot, isClient),
    [isClient, shoot],
  );
  const canOpenAiEdit = useMemo(
    () =>
      ['admin', 'superadmin', 'editing_manager'].includes((currentUserRole || '').toLowerCase()) &&
      rawFileCount > 0,
    [currentUserRole, rawFileCount],
  );
  const hasInflightShootUploads = useMemo(
    () => activeUploads.some((u) => u.shootId === String(shoot?.id) && u.status === 'uploading'),
    [activeUploads, shoot?.id],
  );
  const canSubmitRawAction = useMemo(() => {
    if (!shoot) {
      return false;
    }

    const backendFlag = Boolean(shoot.canSubmitRaw ?? (shoot as any).can_submit_raw);
    if (backendFlag) {
      return true;
    }

    const role = (currentUserRole || '').toLowerCase();
    const allowedRole =
      isAdmin ||
      isEditingManager ||
      isPhotographer ||
      ['admin', 'superadmin', 'super_admin', 'editing_manager', 'photographer'].includes(role);
    const status = String(normalizedStatus || shoot.workflowStatus || shoot.status || '').toLowerCase();
    const allowedStatus = ['scheduled', 'booked', 'raw_upload_pending', 'uploaded'].includes(status);
    const count = Math.max(
      Number(rawFileCount || 0),
      Number(shoot.rawPhotoCount || 0),
      Number((shoot as any).raw_photo_count || 0),
    );

    return allowedRole && allowedStatus && count > 0;
  }, [currentUserRole, isAdmin, isEditingManager, isPhotographer, normalizedStatus, rawFileCount, shoot]);
  const canSubmitEditsAction = useMemo(() => {
    if (!shoot) {
      return false;
    }

    const backendFlag = Boolean(shoot.canSubmitEdits ?? (shoot as any).can_submit_edits);
    if (backendFlag) {
      return true;
    }

    const role = (currentUserRole || '').toLowerCase();
    const allowedRole =
      isAdmin ||
      isEditingManager ||
      isEditor ||
      ['admin', 'superadmin', 'super_admin', 'editing_manager', 'editor'].includes(role);
    const status = String(normalizedStatus || shoot.workflowStatus || shoot.status || '').toLowerCase();
    const allowedStatus = ['uploaded', 'editing'].includes(status);
    const count = Math.max(
      Number(editedMediaCount || 0),
      Number(shoot.editedPhotoCount || 0),
      Number((shoot as any).edited_photo_count || 0),
    );

    return allowedRole && allowedStatus && count > 0;
  }, [currentUserRole, editedMediaCount, isAdmin, isEditingManager, isEditor, normalizedStatus, shoot]);
  const handleOpenAiEdit = useCallback(() => {
    if (typeof window === 'undefined' || !shoot?.id) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent('shoot-ai-edit-open', {
        detail: { shootId: String(shoot.id) },
      }),
    );
  }, [shoot?.id]);

  const handleTabChange = (value: string) => {
    const selectedTab = visibleTabs.find((tab) => tab.id === value);
    if (selectedTab?.disabled) {
      return;
    }

    setActiveTab(value as typeof activeTab);
    if (value !== 'tours') setShowTourAnalytics(false);
  };

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
    pendingAction,
    setPendingAction,
    isCancelShootDialogOpen,
    setIsCancelShootDialogOpen,
    cancelShootReason,
    setCancelShootReason,
    cancelWithoutNotification,
    setCancelWithoutNotification,
    isCancellingShoot,
    isSendingToEditing,
    isFinalising,
    handleSendToEditing,
    handleFinalise,
    handleMarkOnHoldClick,
    handleMarkOnHold,
    handleCancellationFeeConfirm,
    handleCancelShoot,
    handleCancelShootClick,
    handleResumeFromHold,
    submitConfirm,
    isSubmittingRaw,
    isSubmittingEdits,
    handleSubmitRaw,
    handleSubmitEdits,
    closeSubmitConfirm,
    confirmSubmit,
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
    downloadStatusMessage,
    isGeneratingShareLink,
    isStartingMmmPunchout,
    isMmmDialogOpen,
    setIsMmmDialogOpen,
    mmmDialogRedirectUrl,
    mmmDialogError,
    setMmmDialogError,
    selectedFileIds,
    setSelectedFileIds,
    handleSendToBrightMls,
    handleOpenMmm,
    handleStartMmmPunchout,
    handleEditorDownloadRaw,
    handleGenerateShareLink,
    handleDownloadMedia,
    handleDownloadFile,
  } = useShootDetailsModalActions({
    shoot,
    isPhotographer,
    refreshShoot,
    toast,
  });

  const handleProgressMediaDownload = useCallback(() => {
    if (activeMediaDisplayTab === 'edited') {
      void handleDownloadMedia('original');
      return;
    }

    void handleEditorDownloadRaw();
  }, [activeMediaDisplayTab, handleDownloadMedia, handleEditorDownloadRaw]);

  useEffect(() => {
    if (!isOpen || !openDownloadDialog || !clientReleaseAccess.canClientDownload) return;
    setIsDownloadDialogOpen(true);
  }, [clientReleaseAccess.canClientDownload, isOpen, openDownloadDialog, setIsDownloadDialogOpen]);

  useEffect(() => {
    if (!clientReleaseAccess.canClientDownload && isDownloadDialogOpen) {
      setIsDownloadDialogOpen(false);
    }
  }, [clientReleaseAccess.canClientDownload, isDownloadDialogOpen, setIsDownloadDialogOpen]);
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
    ? getStatusBadge(shoot.workflowStatus || shoot.status || 'booked')
    : null;
  const paymentBadge = useMemo(() => {
    if (!shoot) return null;
    if (isEditor) return null;

    const paymentSummary = normalizeShootPaymentSummary(shoot);
    const hasMeaningfulPaymentState =
      paymentSummary.paymentStatus !== null ||
      paymentSummary.totalQuote > 0 ||
      paymentSummary.totalPaid > 0;

    if (!hasMeaningfulPaymentState) {
      return null;
    }

    const badge = getShootDetailsPaymentBadge(shoot.payment);
    if (!badge) return null;

    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  }, [shoot, isEditor]);
  const addressTitle = shoot
    ? (() => {
        const address = shoot.location?.address || (shoot as any).address || '';
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
                  disabled={isSendingToEditing}
                >
                  {isSendingToEditing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  <span>{isSendingToEditing ? 'Sending...' : 'Send to Editing'}</span>
                </Button>
              )}
              {canFinalise && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                  onClick={handleFinalise}
                  disabled={isFinalising}
                >
                  {isFinalising ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  <span>{isFinalising ? 'Finalizing...' : 'Finalize'}</span>
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
      <DialogContent className="w-screen h-[100dvh] max-w-none rounded-none overflow-hidden flex flex-col gap-0 p-0 sm:max-w-[95vw] sm:max-h-[95vh] sm:h-[95vh] sm:rounded-lg [&>button.absolute]:hidden [&>button.absolute]:sm:flex">
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
          canOpenAiEdit={canOpenAiEdit}
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
          isEditingManager={isEditingManager}
          isClient={isClient}
          isEditor={isEditor}
          isPhotographer={isPhotographer}
          canClientDownload={clientReleaseAccess.canClientDownload}
          isDownloading={isDownloading}
          isGeneratingShareLink={isGeneratingShareLink}
          isStartingMmmPunchout={isStartingMmmPunchout}
          isSendingToEditing={isSendingToEditing}
          isFinalising={isFinalising}
          rawFileCount={rawFileCount}
          editedMediaCount={editedMediaCount}
          activeMediaDisplayTab={activeMediaDisplayTab}
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
          handleOpenAiEdit={handleOpenAiEdit}
          handleMarkOnHoldClick={handleMarkOnHoldClick}
          handleResumeFromHold={handleResumeFromHold}
          handleCancelShootClick={handleCancelShootClick}
          handleSendToEditing={handleSendToEditing}
          handleFinalise={handleFinalise}
          handleDownloadMedia={handleDownloadMedia}
          handleSendToBrightMls={handleSendToBrightMls}
          handleOpenMmm={handleOpenMmm}
          handleStartMmmPunchout={handleStartMmmPunchout}
          handleEditorDownloadRaw={handleEditorDownloadRaw}
          handleProgressMediaDownload={handleProgressMediaDownload}
          handleGenerateShareLink={handleGenerateShareLink}
          onClose={onClose}
        />
        
        <ShootDetailsModalHeader
          addressTitle={addressTitle}
          createdByLabel={createdByLabel}
          statusBadge={statusBadge}
          paymentBadge={paymentBadge}
          activeTab={activeTab}
          visibleTabs={visibleTabs}
          handleTabChange={handleTabChange}
          setIsMobileActionsOpen={setIsMobileActionsOpen}
          onClose={onClose}
        />

        <ShootDetailsModalBody
          shoot={shoot}
          canSubmitRaw={canSubmitRawAction}
          canSubmitEdits={canSubmitEditsAction}
          hasInflightUploads={hasInflightShootUploads}
          isSubmittingRaw={isSubmittingRaw}
          isSubmittingEdits={isSubmittingEdits}
          handleSubmitRaw={handleSubmitRaw}
          handleSubmitEdits={handleSubmitEdits}
          activeTab={activeTab}
          activeMediaDisplayTab={activeMediaDisplayTab}
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
          isClientReleaseLocked={clientReleaseAccess.isClientReleaseLocked}
          isEditMode={isEditMode}
          isSavingChanges={isSavingChanges}
          editActions={editActions}
          isMediaExpanded={isMediaExpanded}
          showTourAnalytics={showTourAnalytics}
          canResumeFromHold={canResumeFromHold}
          canSendToEditing={canSendToEditing}
          canFinalise={canFinalise}
          canShowInvoiceButton={canShowInvoiceButton}
          isLoadingInvoice={isLoadingInvoice}
          isSendingToEditing={isSendingToEditing}
          isFinalising={isFinalising}
          setShowTourAnalytics={setShowTourAnalytics}
          setIsMediaExpanded={setIsMediaExpanded}
          setActiveMediaDisplayTab={setActiveMediaDisplayTab}
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
        pendingAction={pendingAction}
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
        isAdmin={isAdmin}
        isClient={isClient}
        cancelWithoutNotification={cancelWithoutNotification}
        canClientDownloadWholeShoot={clientReleaseAccess.canClientDownloadWholeShoot}
        canClientAccessTours={clientReleaseAccess.canClientAccessTours}
        isDownloadDialogOpen={clientReleaseAccess.canClientDownload ? isDownloadDialogOpen : false}
        isDownloading={isDownloading}
        downloadStatusMessage={downloadStatusMessage}
        isApprovalModalOpen={isApprovalModalOpen}
        isDeclineModalOpen={isDeclineModalOpen}
        selectedInvoice={selectedInvoice}
        isInvoiceDialogOpen={isInvoiceDialogOpen}
        brightMlsRedirectUrl={brightMlsRedirectUrl}
        isMmmDialogOpen={isMmmDialogOpen}
        isStartingMmmPunchout={isStartingMmmPunchout}
        mmmDialogRedirectUrl={mmmDialogRedirectUrl}
        mmmDialogError={mmmDialogError}
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
        setCancelWithoutNotification={setCancelWithoutNotification}
        setIsDownloadDialogOpen={setIsDownloadDialogOpen}
        setIsApprovalModalOpen={setIsApprovalModalOpen}
        setIsDeclineModalOpen={setIsDeclineModalOpen}
        setIsInvoiceDialogOpen={setIsInvoiceDialogOpen}
        setSelectedInvoice={setSelectedInvoice}
        setBrightMlsRedirectUrl={setBrightMlsRedirectUrl}
        setIsMmmDialogOpen={setIsMmmDialogOpen}
        setMmmDialogError={setMmmDialogError}
        handlePaymentSuccess={handlePaymentSuccess}
        handleMarkPaidConfirm={handleMarkPaidConfirm}
        handleConfirmSave={handleConfirmSave}
        handleCancellationFeeConfirm={handleCancellationFeeConfirm}
        handleMarkOnHold={handleMarkOnHold}
        handleCancelShoot={handleCancelShoot}
        handleDownloadMedia={handleDownloadMedia}
        handleDownloadFile={handleDownloadFile}
        handleStartMmmPunchout={handleStartMmmPunchout}
        onShootUpdate={onShootUpdate}
        onClose={onClose}
        formatTime={formatTime}
      />

      {shoot && submitConfirm && (
        <ConfirmSubmitDialog
          open={Boolean(submitConfirm)}
          kind={submitConfirm.kind}
          fileCount={
            submitConfirm.kind === 'raw'
              ? (shoot.rawPhotoCount ?? (shoot as any).raw_photo_count ?? 0)
              : (shoot.editedPhotoCount ?? (shoot as any).edited_photo_count ?? 0)
          }
          isSubmitting={submitConfirm.kind === 'raw' ? isSubmittingRaw : isSubmittingEdits}
          hasInflightUploads={activeUploads.some(
            (u) => u.shootId === String(shoot.id) && u.status === 'uploading',
          )}
          onCancel={closeSubmitConfirm}
          onConfirm={confirmSubmit}
        />
      )}
    </>
  );
}
