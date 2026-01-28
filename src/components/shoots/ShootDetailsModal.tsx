import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, ExternalLink, CalendarIcon, MapPinIcon, ClockIcon, Send, CheckCircle, DollarSign as DollarSignIcon, ChevronUp, ChevronDown, Edit, Save, XCircle, PauseCircle, PlayCircle, Upload, Download, UserIcon, Check, FileText, Loader2, Share2, Link2, Printer } from "lucide-react";
import { format } from 'date-fns';
import { ShootData } from '@/types/shoots';
import { transformShootFromApi } from '@/context/ShootsContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useShoots } from '@/context/ShootsContext';
import { useShoot } from '@/hooks/useShoot';
import { getWeatherForLocation, WeatherInfo } from '@/services/weatherService';
import { subscribeToWeatherProvider } from '@/state/weatherProviderStore';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { mmmService } from '@/services/mmmService';

// Import tab components
import { ShootDetailsOverviewTab } from './tabs/ShootDetailsOverviewTab';
import { ShootDetailsMediaTab } from './tabs/ShootDetailsMediaTab';
import { ShootDetailsNotesTab } from './tabs/ShootDetailsNotesTab';
import { ShootDetailsIssuesTab } from './tabs/ShootDetailsIssuesTab';
import { ShootDetailsSettingsTab } from './tabs/ShootDetailsSettingsTab';
import { ShootDetailsTourTab } from './tabs/ShootDetailsTourTab';
import { ShootDetailsQuickActions } from './tabs/ShootDetailsQuickActions';
import { SquarePaymentDialog } from '@/components/payments/SquarePaymentDialog';
import { ShootApprovalModal } from './ShootApprovalModal';
import { ShootDeclineModal } from './ShootDeclineModal';
import { InvoiceViewDialog } from '@/components/invoices/InvoiceViewDialog';
import { InvoiceData } from '@/utils/invoiceUtils';

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
  const { role: authRole, user } = useAuth();
  const { toast } = useToast();
  const { updateShoot } = useShoots();
  const { formatTemperature, formatTime } = useUserPreferences();
  
  const [shoot, setShoot] = useState<ShootData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [providerVersion, setProviderVersion] = useState(0);
  const [isMediaExpanded, setIsMediaExpanded] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isOnHoldDialogOpen, setIsOnHoldDialogOpen] = useState(false);
  const [onHoldReason, setOnHoldReason] = useState('');
  const [isCancellationFeeDialogOpen, setIsCancellationFeeDialogOpen] = useState(false);
  const [shouldAddCancellationFee, setShouldAddCancellationFee] = useState(false);
  const [pendingAction, setPendingAction] = useState<'hold' | 'cancel' | null>(null);
  const [isCancelShootDialogOpen, setIsCancelShootDialogOpen] = useState(false);
  const [cancelShootReason, setCancelShootReason] = useState('');
  const [isCancellingShoot, setIsCancellingShoot] = useState(false);
  const [isPublishingToBrightMls, setIsPublishingToBrightMls] = useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);
  const [isStartingMmmPunchout, setIsStartingMmmPunchout] = useState(false);
  const [rawFileCount, setRawFileCount] = useState<number>(0);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [editActions, setEditActions] = useState<{ save: () => void; cancel: () => void } | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  
  // Use provided role or fallback to auth role
  const currentUserRole = currentRole || authRole;

  const createdByLabel = useMemo(() => {
    if (!shoot) return null;
    return (
      shoot.createdBy ||
      (shoot as any).created_by ||
      (shoot as any).created_by_name ||
      (shoot as any).userCreatedBy ||
      null
    );
  }, [shoot]);
  
  // Role checks
  const isAdmin = ['admin', 'superadmin'].includes(currentUserRole);
  const isRep = currentUserRole === 'rep' || currentUserRole === 'representative';
  const isAdminOrRep = isAdmin || isRep;
  const isPhotographer = currentUserRole === 'photographer';
  const isEditor = currentUserRole === 'editor';
  const isClient = currentUserRole === 'client';
  const shouldHideClientDetails = shouldHideClientDetailsProp || isEditor;

  // Subscribe to weather provider updates
  useEffect(() => {
    const unsubscribe = subscribeToWeatherProvider(() => {
      setProviderVersion((version) => version + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch shoot data using React Query hook for caching and deduplication
  const { data: shootData, isLoading: shootLoading, error: shootError, refetch: refetchShoot } = useShoot(
    isOpen ? shootId : null,
    { enabled: isOpen && Boolean(shootId) }
  );

  // Update local state when data changes
  useEffect(() => {
    if (shootData) {
      setShoot(shootData);
    }
  }, [shootData]);

  // Fetch raw file count for editor download button
  useEffect(() => {
    const fetchRawFileCount = async () => {
      if (!shoot?.id || !isEditor) return;
      try {
        const headers = getApiHeaders();
        headers['Accept'] = 'application/json';
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files?type=raw`, {
          headers,
        });
        if (res.ok) {
          const data = await res.json();
          const files = data.data || data.files || data || [];
          setRawFileCount(Array.isArray(files) ? files.length : 0);
        }
      } catch (error) {
        console.error('Failed to fetch raw file count:', error);
        // Try to use raw_photo_count from shoot data
        if ((shoot as any).raw_photo_count) {
          setRawFileCount((shoot as any).raw_photo_count);
        }
      }
    };
    fetchRawFileCount();
  }, [shoot?.id, isEditor]);

  // Update loading state
  useEffect(() => {
    setLoading(shootLoading);
  }, [shootLoading]);

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

    // Build location string - use city, state, zip for best weather accuracy
    // This matches what dashboard uses: shoot.cityStateZip || shoot.addressLine
    let location: string | null = null;
    
    // Try to build city/state/zip format first (most accurate for weather)
    if (shoot.location?.city && shoot.location?.state) {
      const parts = [shoot.location.city, shoot.location.state];
      if (shoot.location.zip) parts.push(shoot.location.zip);
      location = parts.join(', ');
    } else if ((shoot as any).cityStateZip) {
      location = (shoot as any).cityStateZip;
    } else if ((shoot as any).addressLine) {
      location = (shoot as any).addressLine;
    } else if (shoot.location?.fullAddress) {
      location = shoot.location.fullAddress;
    } else if (shoot.location?.address) {
      location = shoot.location.address;
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

  useEffect(() => {
    if (!isOpen || !openDownloadDialog) return;
    setIsDownloadDialogOpen(true);
  }, [isOpen, openDownloadDialog]);

  // Refresh shoot data
  // Refresh shoot using React Query refetch
  const refreshShoot = async (): Promise<ShootData | null> => {
    if (!shootId || !refetchShoot) return null;
    try {
      const result = await refetchShoot();
      if (result.data) {
        setShoot(result.data);
        return result.data;
      }
      // If refetch didn't return data, return current shoot data
      if (shootData) {
        return shootData;
      }
    } catch (error) {
      console.error('Error refreshing shoot:', error);
      // Return current shoot data as fallback
      if (shootData) {
        return shootData;
      }
    }
    return null;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const key = status.toLowerCase();
    const statusMap: Record<string, { label: string; className: string }> = {
      'requested': { label: 'Requested', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
      'scheduled': { label: 'Scheduled', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      'booked': { label: 'Scheduled', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      'raw_upload_pending': { label: 'Scheduled', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      'uploaded': { label: 'Uploaded', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
      'raw_uploaded': { label: 'Uploaded', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
      'photos_uploaded': { label: 'Uploaded', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
      'in_progress': { label: 'Uploaded', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
      'completed': { label: 'Uploaded', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' }, // legacy alias
      'editing': { label: 'Editing', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
      'review': { label: 'In review', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
      'in_review': { label: 'In review', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
      'editing_uploaded': { label: 'Ready for review', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
      'ready_for_review': { label: 'Ready for review', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
      'pending_review': { label: 'In review', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
      'delivered': { label: 'Delivered', className: 'bg-green-600/10 text-green-700 border-green-600/20' },
      'ready_for_client': { label: 'Delivered', className: 'bg-green-600/10 text-green-700 border-green-600/20' },
      'ready': { label: 'Delivered', className: 'bg-green-600/10 text-green-700 border-green-600/20' },
      'admin_verified': { label: 'Delivered', className: 'bg-green-600/10 text-green-700 border-green-600/20' },
      'on_hold': { label: 'On hold', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
      'hold_on': { label: 'On hold', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
      'cancelled': { label: 'Cancelled', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
      'canceled': { label: 'Cancelled', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
      'declined': { label: 'Declined', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
    };
    
    const statusInfo = statusMap[key] || { label: status, className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' };
    return <Badge className={statusInfo.className}>{statusInfo.label}</Badge>;
  };

  // Get weather badge
  const getWeatherBadge = () => {
    const weatherData = weather || shoot?.weather;
    if (!weatherData && !shoot?.weather?.temperature && !(shoot as any).temperature) return null;
    
    // Use same unified fallback logic as dashboard
    const temperature = weather?.temperature ?? shoot?.weather?.temperature ?? (shoot as any).temperature;
    const description = weather?.description;
    
    // Format temperature using user preference
    const formattedTemp = (() => {
      if (!temperature) return null;
      if (typeof temperature === 'number') return formatTemperature(temperature);
      const match = String(temperature).match(/^(-?\d+)/);
      if (match) return formatTemperature(parseInt(match[1], 10));
      return `${temperature}°`;
    })();
    
    return (
      <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
        {formattedTemp}
        {description && ` • ${description}`}
      </Badge>
    );
  };

  // Send to editing handler
  const handleSendToEditing = async () => {
    if (!shoot) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const currentStatus = shoot.status || shoot.workflowStatus || 'booked';

      // Unified flow: only send to editing once photos are uploaded
      if (String(currentStatus).toLowerCase() !== 'uploaded') {
        throw new Error('Shoot must be in Uploaded status before sending to editing');
      }
      
      // Now transition to editing
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/start-editing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to send to editing' }));
        throw new Error(errorData.message || 'Failed to send to editing');
      }
      
      toast({
        title: 'Success',
        description: 'Shoot sent to editing',
      });
      refreshShoot();
    } catch (error: any) {
      console.error('Send to editing error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to send to editing',
        variant: 'destructive',
      });
    }
  };

  const handleStartMmmPunchout = async () => {
    if (!shoot?.id) return;
    setIsStartingMmmPunchout(true);
    try {
      const response = await mmmService.startPunchout(shoot.id);
      const redirectUrl = response.redirect_url || mmmRedirectUrl;
      toast({
        title: response.success ? 'Print session started' : 'Print session failed',
        description:
          response.message ||
          (response.success ? 'MMM punchout started.' : 'MMM punchout failed.'),
        variant: response.success ? 'default' : 'destructive',
      });
      if (response.success && redirectUrl) {
        window.open(redirectUrl, '_blank', 'noopener,noreferrer');
      }
      refreshShoot();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to start MMM punchout.';
      toast({
        title: 'Print session failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsStartingMmmPunchout(false);
    }
  };

  // Mark complete handler
  const handleFinalise = async () => {
    if (!shoot) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      // Use the dedicated finalize endpoint
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/finalize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ final_status: 'admin_verified' }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to finalise shoot' }));
        throw new Error(errorData.message || 'Failed to finalise shoot');
      }
      
      toast({
        title: 'Success',
        description: 'Shoot finalised successfully',
      });
      refreshShoot();
    } catch (error: any) {
      console.error('Finalize error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to finalise shoot',
        variant: 'destructive',
      });
    }
  };

  const amountDue = shoot ? (shoot.payment?.totalQuote || 0) - (shoot.payment?.totalPaid || 0) : 0;
  const isPaid = amountDue <= 0.01;

  const handleProcessPayment = () => {
    // Debug logging to check payment data
    console.log('Payment Debug:', {
      shoot: !!shoot,
      shootId: shoot?.id,
      payment: shoot?.payment,
      totalQuote: shoot?.payment?.totalQuote,
      totalPaid: shoot?.payment?.totalPaid,
      amountDue: amountDue,
      amountDueCondition: amountDue > 0
    });
    
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = (payment: any) => {
    toast({
      title: 'Payment Successful',
      description: 'Payment has been processed successfully.',
    });
    refreshShoot(); // Reload shoot data to update payment status
  };

  const handleShowInvoice = async () => {
    if (!shoot) return;
    
    setIsLoadingInvoice(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/invoice`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch invoice');
      }

      const data = await res.json();
      const invoiceData = data.data || data;

      // Convert API response to InvoiceData format
      const invoice: InvoiceData = {
        id: invoiceData.id?.toString() || '',
        number: invoiceData.invoice_number || invoiceData.number || `Invoice ${invoiceData.id}`,
        client: typeof invoiceData.client === 'string' 
          ? invoiceData.client 
          : invoiceData.client?.name || invoiceData.shoot?.client?.name || 'Unknown Client',
        property: invoiceData.shoot?.location?.fullAddress 
          || invoiceData.shoot?.address 
          || invoiceData.property 
          || 'N/A',
        date: invoiceData.issue_date || invoiceData.date || new Date().toISOString(),
        dueDate: invoiceData.due_date || invoiceData.dueDate || new Date().toISOString(),
        amount: invoiceData.total || invoiceData.amount || 0,
        status: invoiceData.status === 'paid' ? 'paid' : invoiceData.status === 'sent' ? 'pending' : 'pending',
        services: invoiceData.items?.map((item: any) => item.description) || invoiceData.services || [],
        paymentMethod: invoiceData.paymentMethod || 'N/A',
      };

      setSelectedInvoice(invoice);
      setIsInvoiceDialogOpen(true);
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load invoice',
        variant: 'destructive',
      });
      // Fallback: navigate to accounting page
      navigate('/accounting');
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  const normalizeStatus = (value?: string | null) => {
    if (!value) return '';
    const key = value.toLowerCase();
    const map: Record<string, string> = {
      booked: 'scheduled',
      raw_upload_pending: 'scheduled',
      raw_uploaded: 'uploaded',
      photos_uploaded: 'uploaded',
      in_progress: 'uploaded',
      completed: 'uploaded',
      editing_uploaded: 'review',
      editing_complete: 'review',
      editing_issue: 'review',
      pending_review: 'review',
      ready_for_review: 'review',
      qc: 'review',
      ready: 'delivered',
      ready_for_client: 'delivered',
      admin_verified: 'delivered',
    };
    return map[key] || key;
  };

  const normalizedStatus = normalizeStatus(shoot?.workflowStatus || shoot?.status);
  const isDelivered = normalizedStatus === 'delivered';
  const isUploadedStatus = normalizedStatus === 'uploaded';
  const isEditingStatus = normalizedStatus === 'editing';
  const canShowInvoiceButton = isUploadedStatus || isEditingStatus;
  const canFinalise = isAdmin && !isDelivered && ['uploaded', 'editing'].includes(normalizedStatus);
  const canSendToEditing = isAdmin && !isDelivered && (normalizedStatus === 'uploaded' || normalizedStatus === 'scheduled');
  const mmmRedirectUrl =
    shoot?.mmmRedirectUrl || (shoot as any)?.mmm_redirect_url || undefined;
  const canStartMmmPunchout = [
    'admin',
    'superadmin',
    'client',
    'salesRep',
    'sales_rep',
    'rep',
    'representative',
  ].includes(currentUserRole || '');
  const showMmmPunchoutButtons = isDelivered && (canStartMmmPunchout || mmmRedirectUrl);

  // Check if shoot is scheduled or on hold - make it more lenient
  const isScheduledOrOnHold = shoot && (
    shoot.status === 'scheduled' || 
    shoot.status === 'booked' ||
    shoot.status === 'on_hold' || 
    shoot.workflowStatus === 'on_hold' ||
    shoot.workflowStatus === 'booked' ||
    !shoot.photographer?.id // Hold-on shoots (no photographer assigned)
  );

  // Check if admin/superadmin can edit (allow editing for most statuses except delivered/cancelled)
  const canAdminEdit = isAdmin && shoot && !['delivered', 'cancelled', 'declined'].includes(normalizedStatus);

  // Check if shoot is on hold (defined first as it's used in canPutOnHold)
  const isOnHold = shoot && (
    shoot.status === 'on_hold' || 
    shoot.status === 'hold_on' ||
    shoot.workflowStatus === 'on_hold'
  );

  // Check if shoot can be put on hold (scheduled, booked, editing, uploaded - not already on hold)
  const canPutOnHold = shoot && !isOnHold && (
    shoot.status === 'scheduled' || 
    shoot.status === 'booked' || 
    shoot.workflowStatus === 'booked' ||
    normalizedStatus === 'editing' ||
    normalizedStatus === 'uploaded'
  );

  // Check if user can put shoot on hold
  // For photographers: only allow until status reaches 'editing' (i.e., scheduled, booked, uploaded)
  const photographerCanPutOnHold = isPhotographer && shoot?.photographer?.id === user?.id && canPutOnHold && normalizedStatus !== 'editing';
  const canUserPutOnHold = (isAdminOrRep && canPutOnHold) || photographerCanPutOnHold;

  // Check if user can resume from hold (admin, rep, or assigned photographer)
  const canResumeFromHold = isOnHold && (isAdminOrRep || (isPhotographer && shoot?.photographer?.id === user?.id));

  // Check if admin can cancel shoot (not already cancelled/declined)
  const canCancelShoot = isAdmin && shoot && !['cancelled', 'canceled', 'declined'].includes(normalizedStatus);

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


  const to24Hour = (timeString?: string | null) => {
    if (!timeString) return undefined;
    const match = timeString.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return timeString; // return as-is if already in desired format
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const seconds = match[3] ?? '00';
    const period = match[4]?.toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  };

  // Handle save changes
  const handleSaveChanges = async (updates: Partial<ShootData>) => {
    if (!shoot) {
      console.error('💾 Cannot save: shoot is null');
      return;
    }
    
    if (!shoot.id) {
      console.error('💾 Cannot save: shoot.id is missing');
      toast({
        title: 'Error',
        description: 'Cannot save: Shoot ID is missing',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        console.error('💾 Cannot save: No authentication token');
        toast({
          title: 'Error',
          description: 'Authentication required. Please refresh the page.',
          variant: 'destructive',
        });
        return;
      }
      
      const payload: Record<string, unknown> = {};
      
      // Map updates to API format (support snake_case from API)
      const shootAny = shoot as any;
      const scheduledDate = updates.scheduledDate || shoot.scheduledDate || shootAny.scheduled_date;
      const scheduledTime = updates.time !== undefined ? updates.time : (shoot.time as string | undefined);
      if (scheduledDate) payload.scheduled_date = scheduledDate;
      if (scheduledTime !== undefined) payload.time = scheduledTime;
      if (scheduledDate && scheduledTime) {
        const time24 = to24Hour(scheduledTime);
        payload.scheduled_at = `${scheduledDate} ${time24 ?? scheduledTime}`;
      }
      if (updates.status) payload.status = updates.status;
      if (updates.workflowStatus) payload.workflow_status = updates.workflowStatus;
      
      // Location fields
      if (updates.location?.address) payload.address = updates.location.address;
      if (updates.location?.city) payload.city = updates.location.city;
      if (updates.location?.state) payload.state = updates.location.state;
      if (updates.location?.zip) payload.zip = updates.location.zip;
      
      // Client and photographer - ensure IDs are numbers and valid
      if (updates.client?.id !== undefined && updates.client.id !== null) {
        const clientId = typeof updates.client.id === 'string' 
          ? parseInt(updates.client.id, 10) 
          : Number(updates.client.id);
        // Only send if it's a valid number
        if (!isNaN(clientId) && clientId > 0) {
          const currentClientId = shoot.client?.id 
            ? (typeof shoot.client.id === 'string' ? parseInt(String(shoot.client.id), 10) : Number(shoot.client.id))
            : null;
          // Always send if explicitly set, even if same (allows clearing/resetting)
          console.log('💾 Client ID update:', { new: clientId, current: currentClientId, shootClient: shoot.client });
          payload.client_id = clientId;
        } else {
          console.warn('💾 Invalid client_id:', updates.client.id);
        }
      }
      // Handle photographer update - check if it's being cleared (null) or updated
      if (updates.photographer === null) {
        // Explicitly clearing photographer
        console.log('💾 Clearing photographer assignment');
        payload.photographer_id = null;
      } else if (updates.photographer?.id !== undefined && updates.photographer.id !== null) {
        const photographerId = typeof updates.photographer.id === 'string' 
          ? parseInt(updates.photographer.id, 10) 
          : Number(updates.photographer.id);
        // Only send if it's a valid number
        if (!isNaN(photographerId) && photographerId > 0) {
          const currentPhotographerId = shoot.photographer?.id 
            ? (typeof shoot.photographer.id === 'string' ? parseInt(String(shoot.photographer.id), 10) : Number(shoot.photographer.id))
            : null;
          // Always send if explicitly set, even if same (allows clearing/resetting)
          console.log('💾 Photographer ID update:', { 
            new: photographerId, 
            current: currentPhotographerId, 
            shootPhotographer: shoot.photographer,
            updatesPhotographer: updates.photographer
          });
          payload.photographer_id = photographerId;
        } else {
          console.warn('💾 Invalid photographer_id:', updates.photographer.id, 'Type:', typeof updates.photographer.id);
        }
      }
      
      // Payment fields
      if (updates.payment?.baseQuote !== undefined) payload.base_quote = updates.payment.baseQuote;
      if (updates.payment?.taxAmount !== undefined) payload.tax_amount = updates.payment.taxAmount;
      if (updates.payment?.totalQuote !== undefined) payload.total_quote = updates.payment.totalQuote;
      
      // Property details (beds, baths, sqft, access info)
      if (updates.propertyDetails) {
        // Ensure numeric fields are properly converted to numbers
        const propertyDetails: any = { ...updates.propertyDetails };
        
        // Convert beds/bedrooms to number
        if (propertyDetails.beds !== undefined && propertyDetails.beds !== null) {
          const bedsNum = typeof propertyDetails.beds === 'string' 
            ? parseInt(propertyDetails.beds, 10) 
            : Number(propertyDetails.beds);
          if (!isNaN(bedsNum) && bedsNum > 0) {
            payload.bedrooms = bedsNum;
            propertyDetails.beds = bedsNum;
            propertyDetails.bedrooms = bedsNum;
          }
        }
        
        // Convert baths/bathrooms to number
        if (propertyDetails.baths !== undefined && propertyDetails.baths !== null) {
          const bathsNum = typeof propertyDetails.baths === 'string' 
            ? parseInt(propertyDetails.baths, 10) 
            : Number(propertyDetails.baths);
          if (!isNaN(bathsNum) && bathsNum > 0) {
            payload.bathrooms = bathsNum;
            propertyDetails.baths = bathsNum;
            propertyDetails.bathrooms = bathsNum;
          }
        }
        
        // Convert sqft to number
        if (propertyDetails.sqft !== undefined && propertyDetails.sqft !== null) {
          const sqftNum = typeof propertyDetails.sqft === 'string' 
            ? parseInt(propertyDetails.sqft, 10) 
            : Number(propertyDetails.sqft);
          if (!isNaN(sqftNum) && sqftNum > 0) {
            payload.sqft = sqftNum;
            propertyDetails.sqft = sqftNum;
            propertyDetails.squareFeet = sqftNum;
          }
        }
        
        // Send the full property_details object (excluding the numeric fields we already sent)
        // Keep other fields like presenceOption, lockboxCode, lockboxLocation, accessContactName, accessContactPhone, etc.
        // Only include fields that are not undefined/null and are serializable
        const cleanPropertyDetails: Record<string, unknown> = {};
        Object.keys(propertyDetails).forEach(key => {
          const value = propertyDetails[key];
          // Skip numeric fields we already sent separately, and skip undefined/null
          // But keep all other fields including lockbox fields
          if (key !== 'beds' && key !== 'baths' && key !== 'sqft' && 
              key !== 'bedrooms' && key !== 'bathrooms' && key !== 'squareFeet' &&
              value !== undefined && value !== null) {
            // Ensure string values are properly trimmed
            if (typeof value === 'string') {
              cleanPropertyDetails[key] = value.trim();
            } else {
              cleanPropertyDetails[key] = value;
            }
          }
        });
        
        // Always include property_details if there are any fields
        // This ensures lockbox and access fields are sent
        // Include property_details even if only numeric fields were updated (for lockbox/access preservation)
        if (Object.keys(cleanPropertyDetails).length > 0 || 
            payload.bedrooms !== undefined || 
            payload.bathrooms !== undefined || 
            payload.sqft !== undefined) {
          // Merge numeric fields back into property_details for consistency
          if (payload.bedrooms !== undefined) {
            cleanPropertyDetails.bedrooms = payload.bedrooms;
            cleanPropertyDetails.beds = payload.bedrooms;
          }
          if (payload.bathrooms !== undefined) {
            cleanPropertyDetails.bathrooms = payload.bathrooms;
            cleanPropertyDetails.baths = payload.bathrooms;
          }
          if (payload.sqft !== undefined) {
            cleanPropertyDetails.sqft = payload.sqft;
            cleanPropertyDetails.squareFeet = payload.sqft;
          }
          payload.property_details = cleanPropertyDetails;
        }
        
        console.log('💾 Property details update:', { 
          bedrooms: payload.bedrooms, 
          bathrooms: payload.bathrooms, 
          sqft: payload.sqft,
          property_details: payload.property_details 
        });
      }
      
      // Services - convert to API format
      if (updates.services && Array.isArray(updates.services)) {
        const servicesPayload = updates.services.map((service: any) => {
          if (typeof service === 'string') {
            // If it's just a string (service name), we can't update it without ID
            // Return null to skip
            return null;
          }
          if (service.id !== undefined && service.id !== null) {
            // Ensure service ID is a number
            const serviceId = typeof service.id === 'string' 
              ? parseInt(service.id, 10) 
              : Number(service.id);
            
            if (!isNaN(serviceId) && serviceId > 0) {
              const serviceData: any = {
                id: serviceId,
                quantity: service.quantity || 1,
              };
              
              // Include price if provided
              if (service.price !== undefined && service.price !== null) {
                const price = typeof service.price === 'string' 
                  ? parseFloat(service.price) 
                  : Number(service.price);
                if (!isNaN(price) && price >= 0) {
                  serviceData.price = price;
                }
              }
              
              // Include photographer_pay if provided
              if (service.photographer_pay !== undefined && service.photographer_pay !== null) {
                const photographerPay = typeof service.photographer_pay === 'string' 
                  ? parseFloat(service.photographer_pay) 
                  : Number(service.photographer_pay);
                if (!isNaN(photographerPay) && photographerPay >= 0) {
                  serviceData.photographer_pay = photographerPay;
                }
              }
              
              return serviceData;
            }
          }
          return null;
        }).filter(Boolean);
        
        if (servicesPayload.length > 0) {
          payload.services = servicesPayload;
          console.log('💾 Services update:', servicesPayload);
        }
      }
      
      // Don't send empty payloads
      if (Object.keys(payload).length === 0) {
        console.log('💾 No changes to save');
        toast({
          title: 'Info',
          description: 'No changes to save',
        });
        setIsEditMode(false);
        return;
      }
      
      console.log('💾 Saving shoot updates:', payload);
      console.log('💾 API URL:', `${API_BASE_URL}/api/shoots/${shoot.id}`);
      console.log('💾 API_BASE_URL:', API_BASE_URL);
      console.log('💾 Shoot ID:', shoot.id);
      console.log('💾 Token present:', !!token);
      console.log('💾 Token length:', token ? token.length : 0);
      
      // Validate payload can be stringified (catch circular references, etc.)
      let payloadString: string;
      try {
        payloadString = JSON.stringify(payload);
        console.log('💾 Payload stringified successfully, length:', payloadString.length);
      } catch (stringifyError) {
        console.error('💾 Failed to stringify payload:', stringifyError);
        throw new Error('Invalid data format - cannot serialize request');
      }
      
      let res: Response;
      try {
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: payloadString,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
      } catch (fetchError) {
        // Network error (CORS, connection issue, timeout, etc.)
        console.error('💾 Network error during fetch:', fetchError);
        console.error('💾 Error details:', {
          name: fetchError instanceof Error ? fetchError.name : 'Unknown',
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
          stack: fetchError instanceof Error ? fetchError.stack : undefined,
          url: `${API_BASE_URL}/api/shoots/${shoot.id}`,
          method: 'PATCH',
        });
        
        let errorMessage = 'Network error - please check your connection and try again';
        
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            errorMessage = 'Request timed out - please try again';
          } else if (fetchError.message.includes('Failed to fetch') || 
                     fetchError.message.includes('NetworkError') ||
                     fetchError.message.includes('Network request failed')) {
            // This is a true network error - server unreachable, CORS, etc.
            errorMessage = 'Unable to connect to server. Please check:\n' +
              '1. Your internet connection\n' +
              '2. The backend server is running\n' +
              '3. CORS is properly configured';
          } else {
            errorMessage = fetchError.message;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      console.log('💾 Save response status:', res.status, res.statusText);
      console.log('💾 Response headers:', Object.fromEntries(res.headers.entries()));
      
      if (!res.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to update shoot';
        let errorData: any = null;
        
        try {
          // Try to read response as text first to see what we got
          const responseText = await res.text();
          console.error('💾 Save error response text:', responseText);
          
          if (responseText) {
            try {
              errorData = JSON.parse(responseText);
              console.error('💾 Save error response (parsed):', errorData);
            } catch (parseError) {
              // Response is not JSON, use the text as error message
              errorMessage = responseText || `Failed to update shoot (${res.status} ${res.statusText})`;
            }
          }
          
          // Handle validation errors
          if (errorData) {
            if (errorData.errors && typeof errorData.errors === 'object') {
              const errorMessages = Object.entries(errorData.errors)
                .map(([key, value]) => {
                  if (Array.isArray(value)) {
                    return `${key}: ${value.join(', ')}`;
                  }
                  return `${key}: ${value}`;
                })
                .join('; ');
              errorMessage = errorMessages || errorData.message || errorMessage;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `Failed to update shoot (${res.status} ${res.statusText})`;
        }
        
        // Provide more specific error messages based on status code
        if (res.status === 401 || res.status === 403) {
          errorMessage = 'Unauthorized - please refresh the page and try again';
        } else if (res.status === 404) {
          errorMessage = 'Shoot not found - it may have been deleted';
        } else if (res.status === 422) {
          errorMessage = errorMessage || 'Validation error - please check your input';
        } else if (res.status >= 500) {
          errorMessage = 'Server error - please try again later';
        }
        
        throw new Error(errorMessage);
      }
      
      let responseData: any;
      try {
        const responseText = await res.text();
        if (responseText) {
          responseData = JSON.parse(responseText);
        } else {
          responseData = {};
        }
      } catch (parseError) {
        console.warn('💾 Failed to parse response as JSON, using empty object:', parseError);
        responseData = {};
      }
      
      console.log('💾 Save success response:', responseData);
      
      // Get updated shoot data from response or refresh
      let updatedShootData: ShootData | null = responseData.data || responseData;

      const shouldTransform = updatedShootData && (
        'scheduled_date' in (updatedShootData as any) ||
        'workflow_status' in (updatedShootData as any) ||
        'base_quote' in (updatedShootData as any) ||
        'services_list' in (updatedShootData as any)
      );

      if (updatedShootData && shouldTransform) {
        try {
          updatedShootData = transformShootFromApi(updatedShootData as any);
        } catch (error) {
          console.warn('💾 Failed to normalize shoot response, using raw data:', error);
        }
      }

      // If response doesn't have valid data, refresh from API using React Query
      if (!updatedShootData || Object.keys(updatedShootData).length === 0 || !updatedShootData.id) {
        console.log('💾 Response missing data, refreshing from API...');
        updatedShootData = await refreshShoot();
      } else {
        // Normalize location if needed (raw responses may omit location wrapper)
        const shootAny = updatedShootData as any;
        if (!updatedShootData.location && (shootAny.address || shootAny.city)) {
          updatedShootData.location = {
            address: shootAny.address || '',
            city: shootAny.city || '',
            state: shootAny.state || '',
            zip: shootAny.zip || '',
            fullAddress: shootAny.fullAddress || shootAny.address || '',
          };
        }
        // Update local state
        setShoot(updatedShootData);
      }
      
      // Invalidate React Query cache to ensure fresh data on next load
      if (refetchShoot) {
        refetchShoot().catch((err) => {
          console.log('💾 Background refetch error (non-critical):', err);
        });
      }
      
      // Update shoot in context to refresh dashboard cards (SYNCHRONOUS - happens immediately)
      // We only pass the fields that changed to avoid triggering unnecessary API calls
      // The context's updateShoot only makes an API call for status, workflowStatus, scheduledDate, or time
      if (updatedShootData && updatedShootData.id) {
        const shootIdStr = String(updatedShootData.id);
        console.log('💾 Updating shoot in context for dashboard refresh:', shootIdStr);
        
        // Pass the entire updated shoot data to context
        // The context's updateShoot updates local state IMMEDIATELY and SYNCHRONOUSLY
        // It may make an API call for status/time fields, but that happens async and errors are suppressed
        // The important part is the synchronous state update, which triggers dashboard re-render
        const contextUpdates: Partial<ShootData> = updatedShootData;
        
        // Update context - this updates local state IMMEDIATELY and SYNCHRONOUSLY
        // The setShoots call in the context happens first, before any async API call
        // This means the dashboard will update right away via React re-render
        updateShoot(shootIdStr, contextUpdates, { skipApi: true }).catch((contextError) => {
          // Silently ignore errors from context's API call - local state is already updated
          console.log('💾 Context updateShoot API call had an error (ignored, state already updated):', contextError);
        });
      } else {
        console.warn('💾 No updated shoot data to update context');
      }
      
      toast({
        title: 'Success',
        description: 'Shoot updated successfully',
      });
      
      setIsEditMode(false);
      
      // Call onShootUpdate callback to refresh parent components (like dashboard)
      // This runs in the background - the context is already updated, so dashboard shows changes immediately
      if (onShootUpdate) {
        console.log('💾 Calling onShootUpdate callback (background, non-blocking)');
        // Use setTimeout to ensure this runs after the current execution context
        // This prevents any errors from blocking the success flow
        setTimeout(() => {
          try {
            onShootUpdate();
          } catch (error) {
            // Silently handle errors - context is already updated, so dashboard already shows changes
            console.log('💾 onShootUpdate callback had an error (non-critical, background sync):', error);
          }
        }, 0);
      }
    } catch (error) {
      console.error('💾 Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update shoot';
      
      // Provide more helpful error messages
      let userMessage = errorMessage;
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        userMessage = 'Network error - please check your connection and try again. If the problem persists, the changes may have been saved. Please refresh the page to verify.';
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        userMessage = 'Authentication error - please refresh the page and try again.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        userMessage = 'You do not have permission to update this shoot.';
      } else if (errorMessage.includes('404')) {
        userMessage = 'Shoot not found - it may have been deleted.';
      } else if (errorMessage.includes('422') || errorMessage.includes('validation')) {
        userMessage = `Validation error: ${errorMessage}`;
      }
      
      toast({
        title: 'Error',
        description: userMessage,
        variant: 'destructive',
      });
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  // Handle mark as on hold - check for cancellation fee first
  const handleMarkOnHoldClick = () => {
    if (isWithinCancellationFeeWindow) {
      setPendingAction('hold');
      setIsCancellationFeeDialogOpen(true);
    } else {
      setIsOnHoldDialogOpen(true);
    }
  };

  // Handle mark as on hold
  const handleMarkOnHold = async () => {
    if (!shoot || !onHoldReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for putting the shoot on hold.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const payload: Record<string, unknown> = { reason: onHoldReason.trim() };
      
      // Add cancellation fee if within window and user selected it
      if (isWithinCancellationFeeWindow && shouldAddCancellationFee) {
        payload.cancellation_fee = 60;
      }

      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/put-on-hold`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to put shoot on hold');
      }

      const result = await response.json();
      
      // Update the shoot data
      if (result.data) {
        setShoot(result.data);
        updateShoot(shoot.id.toString(), result.data);
      }

      toast({
        title: 'Shoot put on hold',
        description: shouldAddCancellationFee 
          ? 'The shoot has been marked as on hold. $60 cancellation fee has been added.'
          : 'The shoot has been successfully marked as on hold.',
      });

      setIsOnHoldDialogOpen(false);
      setIsCancellationFeeDialogOpen(false);
      setOnHoldReason('');
      setShouldAddCancellationFee(false);
      setPendingAction(null);
      
      // Refresh the shoot list if callback is provided
      if (onShootUpdate) {
        onShootUpdate();
      }
    } catch (error) {
      console.error('Error putting shoot on hold:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to put shoot on hold. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle cancellation fee dialog confirmation
  const handleCancellationFeeConfirm = () => {
    setIsCancellationFeeDialogOpen(false);
    if (pendingAction === 'hold') {
      setIsOnHoldDialogOpen(true);
    } else if (pendingAction === 'cancel') {
      setIsCancelShootDialogOpen(true);
    }
  };

  // Handle cancel shoot (admin only - direct cancel without client request)
  const handleCancelShoot = async () => {
    if (!shoot) return;

    setIsCancellingShoot(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const payload: Record<string, unknown> = { 
        reason: cancelShootReason.trim() || 'Cancelled by admin',
        notify_client: true,
      };
      
      // Add cancellation fee if within window and user selected it
      if (isWithinCancellationFeeWindow && shouldAddCancellationFee) {
        payload.cancellation_fee = 60;
      }

      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel shoot');
      }

      const result = await response.json();
      
      // Update the shoot data
      if (result.data) {
        setShoot(result.data);
        updateShoot(shoot.id.toString(), result.data);
      }

      toast({
        title: 'Shoot cancelled',
        description: shouldAddCancellationFee 
          ? 'The shoot has been cancelled. $60 cancellation fee has been added.'
          : 'The shoot has been successfully cancelled.',
      });

      setIsCancelShootDialogOpen(false);
      setCancelShootReason('');
      setShouldAddCancellationFee(false);
      
      // Refresh the shoot list if callback is provided
      if (onShootUpdate) {
        onShootUpdate();
      }
    } catch (error) {
      console.error('Error cancelling shoot:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel shoot. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCancellingShoot(false);
    }
  };

  // Handle cancel shoot click - check for cancellation fee first
  const handleCancelShootClick = () => {
    if (isWithinCancellationFeeWindow) {
      setPendingAction('cancel');
      setIsCancellationFeeDialogOpen(true);
    } else {
      setIsCancelShootDialogOpen(true);
    }
  };

  // Handle resume from hold
  const handleResumeFromHold = async () => {
    if (!shoot) return;

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      // Use the scheduled date/time from the shoot, or set a default future date if not set
      let scheduledDate: Date;
      if (shoot.scheduledDate && !isNaN(new Date(shoot.scheduledDate).getTime())) {
        scheduledDate = new Date(shoot.scheduledDate);
        // Ensure the date is in the future
        const now = new Date();
        if (scheduledDate <= now) {
          // If the date is in the past, set to tomorrow
          scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + 1);
          scheduledDate.setHours(10, 0, 0, 0);
        }
      } else {
        // Default to tomorrow at 10 AM if no scheduled date
        scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 1);
        scheduledDate.setHours(10, 0, 0, 0);
      }
      
      // Apply time if available
      if (shoot.time) {
        const scheduledTime = shoot.time;
        // Combine date and time - handle both HH:MM and HH:MM:SS formats
        const timeParts = scheduledTime.split(':');
        const hours = parseInt(timeParts[0]) || 10;
        const minutes = parseInt(timeParts[1]) || 0;
        scheduledDate.setHours(hours, minutes, 0, 0);
      }
      
      // Format as ISO string for backend (Laravel expects ISO 8601 format)
      const scheduledAt = scheduledDate.toISOString();
      
      // Prepare payload - ensure photographer_id is a number if it exists
      const payload: Record<string, unknown> = {
        scheduled_at: scheduledAt,
      };
      
      if (shoot.photographer?.id) {
        // Convert photographer_id to number if it's a string
        const photographerId = typeof shoot.photographer.id === 'string' 
          ? parseInt(shoot.photographer.id, 10) 
          : shoot.photographer.id;
        if (!isNaN(photographerId)) {
          payload.photographer_id = photographerId;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/schedule`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        // Get validation errors if they exist
        const validationErrors = errorData.errors || {};
        const errorMessage = errorData.message || 
          errorData.error || 
          (Object.keys(validationErrors).length > 0 
            ? `Validation failed: ${Object.entries(validationErrors).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ')}`
            : 'Failed to resume shoot from hold');
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Update the shoot data immediately from response
      if (result.data) {
        let updatedShootData = result.data;
        
        // Ensure status is properly normalized
        if (updatedShootData.status === 'scheduled' || updatedShootData.workflowStatus === 'booked') {
          updatedShootData.status = 'scheduled';
          updatedShootData.workflowStatus = 'booked';
        }
        
        // Remove any hold_on status
        if (updatedShootData.status === 'hold_on' || updatedShootData.status === 'on_hold') {
          updatedShootData.status = 'scheduled';
        }
        if (updatedShootData.workflowStatus === 'hold_on' || updatedShootData.workflowStatus === 'on_hold') {
          updatedShootData.workflowStatus = 'booked';
        }
        
        setShoot(updatedShootData);
        updateShoot(shoot.id.toString(), updatedShootData);
      }

      toast({
        title: 'Shoot resumed',
        description: 'The shoot has been moved back to scheduled status.',
      });

      // Refresh shoot data from server to ensure consistency
      await refreshShoot();
      
      // Refresh the shoot list if callback is provided
      if (onShootUpdate) {
        onShootUpdate();
      }
    } catch (error) {
      console.error('Error resuming shoot from hold:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resume shoot from hold. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle send images to brightmls
  const handleSendToBrightMls = async () => {
    if (!shoot) return;

    try {
      setIsPublishingToBrightMls(true);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      // Get photos from shoot files - filter for valid URLs
      const photos: Array<{ url: string; filename: string; selected: boolean }> = [];
      
      // Try to get photos from files first
      if (shoot.files && Array.isArray(shoot.files)) {
        shoot.files
          .filter((f: any) => {
            const isImage = f.fileType === 'image' || 
                          f.workflowStage === 'edited' || 
                          f.file_type === 'image' ||
                          (f.filename && /\.(jpg|jpeg|png|gif|webp)$/i.test(f.filename));
            const hasUrl = !!(f.url || f.path || f.original_url || f.large_url);
            return isImage && hasUrl;
          })
          .forEach((f: any) => {
            const url = f.url || f.path || f.original_url || f.large_url || '';
            if (url) {
              photos.push({
                url: url,
                filename: f.filename || `photo-${f.id}`,
                selected: true,
              });
            }
          });
      }

      // If no photos from files, try to get from media
      if (photos.length === 0 && shoot.media?.images && Array.isArray(shoot.media.images)) {
        shoot.media.images.forEach((img: any, idx: number) => {
          const url = img.url || img.path || img.original_url || img.large_url || '';
          if (url) {
            photos.push({
              url: url,
              filename: img.filename || `photo-${idx + 1}`,
              selected: true,
            });
          }
        });
      }

      // If still no photos, show error
      if (photos.length === 0) {
        throw new Error('No images found to send. Please ensure the shoot has completed images.');
      }

      // Prepare documents
      const documents: Array<{ url: string; filename: string; visibility: string }> = [];
      const iguideFloorplans = (shoot as any)?.iguide_floorplans;
      if (iguideFloorplans && Array.isArray(iguideFloorplans)) {
        iguideFloorplans.forEach((fp: any) => {
          const url = typeof fp === 'string' ? fp : (fp?.url || fp);
          if (url) {
            documents.push({
              url,
              filename: typeof fp === 'string' ? 'floorplan.pdf' : (fp?.filename || 'floorplan.pdf'),
              visibility: 'private',
            });
          }
        });
      }

      const response = await fetch(`${API_BASE_URL}/api/integrations/shoots/${shoot.id}/bright-mls/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          photos: photos,
          iguide_tour_url: (shoot as any)?.iguide_tour_url || null,
          documents: documents,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        const errorMessage = errorData.message || 
          (errorData.errors ? JSON.stringify(errorData.errors) : null) ||
          'Failed to send images to Bright MLS';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      toast({
        title: 'Success',
        description: result.message || 'Images sent to Bright MLS successfully.',
      });

      refreshShoot();
    } catch (error) {
      console.error('Error sending images to Bright MLS:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send images to Bright MLS. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPublishingToBrightMls(false);
    }
  };

  // Handle editor download raw files with activity logging
  const handleEditorDownloadRaw = async () => {
    if (!shoot) return;

    try {
      setIsDownloading(true);
      const headers = getApiHeaders();
      headers['Accept'] = 'application/json, application/zip';
      const queryParams = new URLSearchParams();
      if (selectedFileIds.length > 0) {
        queryParams.set('file_ids', selectedFileIds.join(','));
      }
      const queryString = queryParams.toString();
      
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/editor-download-raw${queryString ? `?${queryString}` : ''}`, {
        method: 'GET',
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
          toast({
            title: 'Download started',
            description: data.message || 'Raw files downloading. Switch to Edited tab to upload your edits.',
          });
        }
      } else {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shoot-${shoot.id}-raw-files-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Download started',
          description: 'Raw files downloaded. Switch to Edited tab to upload your edits.',
        });
      }
    } catch (error) {
      console.error('Error downloading raw files:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to download raw files.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle generate share link for editors
  const handleGenerateShareLink = async () => {
    if (!shoot) return;

    try {
      setIsGeneratingShareLink(true);
      const headers = getApiHeaders();
      headers['Accept'] = 'application/json';
      headers['Content-Type'] = 'application/json';
      
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/generate-share-link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_ids: selectedFileIds,
          expires_in_hours: 72,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to generate share link' }));
        throw new Error(errorData.error || 'Failed to generate share link');
      }

      const data = await res.json();
      
      // Copy to clipboard
      await navigator.clipboard.writeText(data.share_link);
      
      toast({
        title: 'Share link generated!',
        description: `Link copied to clipboard. Valid for ${data.expires_in_hours} hours.`,
      });
      
      // Refresh shoot to show new link in Media Links section
      refreshShoot();
      
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate share link.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingShareLink(false);
    }
  };

  // Handle download media with size selection
  const handleDownloadMedia = async (size: 'original' | 'small' | 'medium' | 'large') => {
    if (!shoot) return;

    try {
      setIsDownloading(true);
      setIsDownloadDialogOpen(false);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      // Use the download-zip endpoint with edited type (final images)
      // Size parameter is passed but backend may not use it yet
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/media/download-zip?type=edited&size=${size}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        // Check if response is JSON (error) or blob (success)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || 'Failed to download media');
        } else {
          throw new Error('Failed to download media');
        }
      }

      // Check if response is a redirect (JSON) or blob (ZIP)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.type === 'redirect' && data.url) {
          // Redirect to Dropbox link
          window.open(data.url, '_blank');
          toast({
            title: 'Download started',
            description: 'Opening download link in new tab...',
          });
        } else {
          throw new Error('Unexpected response format');
        }
      } else {
        // Get the blob and create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const sizeLabel = size === 'original' ? 'original' : size === 'small' ? 'small' : size === 'medium' ? 'medium' : 'large';
        a.download = `${shoot.location?.address?.replace(/[^a-zA-Z0-9]/g, '_') || 'shoot'}-${sizeLabel}-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Download started',
          description: `Downloading media files in ${sizeLabel} size...`,
        });
      }
    } catch (error) {
      console.error('Error downloading media:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to download media. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Full page path
  const fullPagePath = useMemo(() => {
    if (!shoot?.id) return null;
    const parsedId = Number(shoot.id);
    return Number.isFinite(parsedId) ? `/shoots/${parsedId}` : null;
  }, [shoot?.id]);

  // Check if shoot is in requested status (awaiting approval)
  const isRequestedStatus = useMemo(() => {
    const status = (shoot?.status || shoot?.workflowStatus || '').toLowerCase();
    return status === 'requested';
  }, [shoot?.status, shoot?.workflowStatus]);

  // Determine visible tabs based on role and status (excluding media which is always in right pane)
  const visibleTabs = useMemo(() => {
    const tabs = [];
    tabs.push({ id: 'overview', label: 'Overview' });
    tabs.push({ id: 'notes', label: 'Notes' });
    
    // For requested shoots (pending approval), only show Overview and Notes tabs
    if (isRequestedStatus) {
      return tabs;
    }
    
    // Requests tab - visible to all but with different permissions
    tabs.push({ id: 'issues', label: 'Requests' });
    
    // Tours tab - visible to admin and clients (clients can view delivered tours)
    if (isAdmin || isClient) {
      tabs.push({ id: 'tours', label: 'Tours' });
    }
    
    // Settings tab - admin only
    if (isAdmin) {
      tabs.push({ id: 'settings', label: 'Settings' });
    }
    
    return tabs;
  }, [isAdmin, isClient, isRequestedStatus]);

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
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
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading shoot details...</div>
          </div>
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full max-h-[98vh] h-auto sm:max-h-[95vh] sm:h-[95vh] overflow-y-auto flex flex-col p-0">
        {/* DialogHeader for accessibility - must be first child */}
        <DialogHeader className="sr-only">
            <DialogTitle>
              {shoot ? `#${shoot.id} · ${shoot.location?.address || shoot.location?.fullAddress || 'Shoot Details'}` : 'Shoot Details'}
            </DialogTitle>
          <DialogDescription>
            View and manage shoot details including media, notes, issues, and settings
          </DialogDescription>
        </DialogHeader>
        
        {/* Action buttons - Top right: Edit, Send to editing, Finalise, View full page (before close) - Desktop only */}
        <div className="hidden sm:flex absolute top-4 z-[80] flex-col items-end right-14">
          <div className="flex items-center gap-1.5">
            {isEditMode ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs px-3"
                  onClick={() => editActions?.save()}
                  disabled={!editActions}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3"
                  onClick={() => editActions?.cancel()}
                  disabled={!editActions}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {/* Approve/Decline buttons for requested shoots */}
                {isAdminOrRep && isRequestedStatus && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs px-3 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => setIsApprovalModalOpen(true)}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      <span>Approve</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={() => setIsDeclineModalOpen(true)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      <span>Decline</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3"
                      onClick={() => setIsEditMode(true)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      <span>Modify</span>
                    </Button>
                  </>
                )}
                {(canAdminEdit || (isAdminOrRep && isScheduledOrOnHold)) && !isRequestedStatus && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
                    onClick={() => setIsEditMode(true)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    <span>Edit</span>
                  </Button>
                )}
                {canUserPutOnHold && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-300 dark:border-amber-800"
                    onClick={handleMarkOnHoldClick}
                  >
                    <PauseCircle className="h-3 w-3 mr-1" />
                    <span>Mark as on hold</span>
                  </Button>
                )}
                {canCancelShoot && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs px-3 bg-red-50 hover:bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:hover:bg-red-900 dark:text-red-300 dark:border-red-800"
                    onClick={handleCancelShootClick}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    <span>Cancel Shoot</span>
                  </Button>
                )}
                {canResumeFromHold && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                    onClick={handleResumeFromHold}
                  >
                    <PlayCircle className="h-3 w-3 mr-1" />
                    <span>Resume from hold</span>
                  </Button>
                )}
                {isAdmin && (
                  <>
                    {canSendToEditing && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-800"
                        onClick={handleSendToEditing}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        <span>Send to editing</span>
                      </Button>
                    )}
                    {canFinalise && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                        onClick={handleFinalise}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        <span>Finalise</span>
                      </Button>
                    )}
                  </>
                )}
                {canShowInvoiceButton && !isPhotographer && !isEditor && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
                    onClick={handleShowInvoice}
                    disabled={isLoadingInvoice}
                  >
                    {isLoadingInvoice ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <FileText className="h-3 w-3 mr-1" />
                    )}
                    <span>{isLoadingInvoice ? 'Loading…' : 'Invoice'}</span>
                  </Button>
                )}
                {/* Publish to Bright MLS button - before View full page (hidden from editors) */}
                {isDelivered && !isEditor && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-800"
                    onClick={handleSendToBrightMls}
                    disabled={isPublishingToBrightMls}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    <span>{isPublishingToBrightMls ? 'Sending...' : 'Publish to Bright MLS'}</span>
                  </Button>
                )}
                {showMmmPunchoutButtons && (
                  <>
                    {mmmRedirectUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-950 dark:hover:bg-slate-900 dark:text-slate-300 dark:border-slate-800"
                        onClick={() => window.open(mmmRedirectUrl, '_blank', 'noopener,noreferrer')}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        <span>Open MMM</span>
                      </Button>
                    )}
                    {canStartMmmPunchout && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800"
                        onClick={handleStartMmmPunchout}
                        disabled={isStartingMmmPunchout}
                      >
                        {isStartingMmmPunchout ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Printer className="h-3 w-3 mr-1" />
                        )}
                        <span>{isStartingMmmPunchout ? 'Starting...' : 'Print'}</span>
                      </Button>
                    )}
                  </>
                )}
                {/* Editor-specific: Download Raw and Share Link buttons */}
                {isEditor && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                      onClick={handleEditorDownloadRaw}
                      disabled={isDownloading || rawFileCount === 0}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      <span>
                        {isDownloading
                          ? 'Downloading...'
                          : selectedFileIds.length > 0
                            ? `Download Selected (${selectedFileIds.length})`
                            : `Download All (${rawFileCount})`}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-800"
                      onClick={handleGenerateShareLink}
                      disabled={isGeneratingShareLink || rawFileCount === 0}
                    >
                      <Share2 className="h-3 w-3 mr-1" />
                      <span>
                        {isGeneratingShareLink
                          ? 'Generating...'
                          : selectedFileIds.length > 0
                            ? `Share Selected (${selectedFileIds.length})`
                            : `Share All (${rawFileCount})`}
                      </span>
                    </Button>
                  </>
                )}
                {fullPagePath && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={() => {
                      onClose();
                      navigate(fullPagePath);
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    <span>View full page</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Mobile: Edit button, Mark as on hold, Resume from hold, and View full page button - Top right before close button */}
        <div className="sm:hidden absolute top-3 right-12 z-[60] flex items-center gap-1.5">
          {canUserPutOnHold && !isEditMode && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
              onClick={handleMarkOnHoldClick}
            >
              <PauseCircle className="h-3 w-3" />
            </Button>
          )}
          {canResumeFromHold && !isEditMode && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              onClick={handleResumeFromHold}
            >
              <PlayCircle className="h-3 w-3" />
            </Button>
          )}
          {isAdmin && !isEditMode && canSendToEditing && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
              onClick={handleSendToEditing}
            >
              <Send className="h-3 w-3" />
            </Button>
          )}
          {(canAdminEdit || (isAdminOrRep && isScheduledOrOnHold)) && !isEditMode && !isRequestedStatus && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              onClick={() => setIsEditMode(true)}
            >
              <Edit className="h-3 w-3" />
            </Button>
          )}
          {(isAdmin || isClient) && isDelivered && !isEditMode && !isEditor && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
              onClick={handleSendToBrightMls}
              disabled={isPublishingToBrightMls}
            >
              <Upload className="h-3 w-3" />
            </Button>
          )}
          {showMmmPunchoutButtons && (
            <>
              {mmmRedirectUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  onClick={() => window.open(mmmRedirectUrl, '_blank', 'noopener,noreferrer')}
                >
                  <Link2 className="h-3 w-3" />
                </Button>
              )}
              {canStartMmmPunchout && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                  onClick={handleStartMmmPunchout}
                  disabled={isStartingMmmPunchout}
                >
                  {isStartingMmmPunchout ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Printer className="h-3 w-3" />
                  )}
                </Button>
              )}
            </>
          )}
          {fullPagePath && !isEditMode && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => {
                onClose();
                navigate(fullPagePath);
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              <span className="hidden xs:inline">View full page</span>
              <span className="xs:hidden">View</span>
            </Button>
          )}
        </div>
        
        {/* Header */}
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4">
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              {/* "Shoot details" label - Left aligned on mobile */}
              <div className="text-xs sm:text-sm text-primary mb-1.5 sm:mb-2 font-medium text-left">
                Shoot details
              </div>
              
              {/* Main Title - Location/Address with Status Badge inline */}
              <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold truncate text-left">
                  {(() => {
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
                  })()}
                </h2>
                <div className="flex-shrink-0">
                  {getStatusBadge(shoot.status || shoot.workflowStatus || 'booked')}
                </div>
              </div>
              
              {/* Created By Info */}
              {createdByLabel && (
                <div className="text-[11px] text-muted-foreground text-left flex items-center gap-1.5">
                  <UserIcon className="h-3 w-3" />
                  <span>Created by: {createdByLabel}</span>
                </div>
              )}
            </div>
            {isEditMode && (
              <div className="w-full sm:hidden flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs px-3"
                    onClick={() => editActions?.save()}
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-3"
                    onClick={() => editActions?.cancel()}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Split Pane Layout - Stack on mobile, expandable media */}
        <div className={`flex flex-col sm:flex-row overflow-hidden pb-20 sm:pb-0 ${isMediaExpanded ? 'min-h-[70vh]' : 'min-h-[50vh]'} sm:flex-1 sm:min-h-0`}>
          {/* Left Pane - Full width on mobile, 37.5% on desktop */}
          <div className={`relative w-full sm:w-[37.5%] border-r sm:border-r border-b sm:border-b-0 flex flex-col ${isMediaExpanded ? 'min-h-[35vh]' : 'flex-1'} sm:min-h-0 overflow-hidden bg-muted/30 flex-1 sm:flex-none`}>
            {/* Tab Navigation */}
            <div className="px-2 sm:px-4 py-1.5 sm:py-2 border-b bg-background flex-shrink-0 overflow-x-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full justify-start h-7 sm:h-8 bg-transparent p-0 min-w-max sm:min-w-0">
                  {visibleTabs.filter(tab => tab.id !== 'media').map(tab => (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id} 
                      className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none whitespace-nowrap"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Main Content Area - Independent scrolling */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 sm:px-4 py-2 sm:py-2.5">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="overview" className="mt-0">
                  <ShootDetailsOverviewTab
                    shoot={shoot}
                    isAdmin={isAdmin}
                    isPhotographer={isPhotographer}
                    isEditor={isEditor}
                    isClient={isClient}
                    shouldHideClientDetails={shouldHideClientDetails}
                    role={currentUserRole}
                    onShootUpdate={refreshShoot}
                    weather={weather || null}
                    isEditMode={isEditMode}
                    onSave={handleSaveChanges}
                    onCancel={handleCancelEdit}
                    onRegisterEditActions={(actions) => setEditActions(actions)}
                  />
                </TabsContent>

                <TabsContent value="notes" className="mt-0">
                  <ShootDetailsNotesTab
                    shoot={shoot}
                    isAdmin={isAdmin}
                    isPhotographer={isPhotographer}
                    isEditor={isEditor}
                    role={currentUserRole}
                    onShootUpdate={refreshShoot}
                  />
                </TabsContent>

                <TabsContent value="issues" className="mt-0">
                  <ShootDetailsIssuesTab
                    shoot={shoot}
                    isAdmin={isAdmin}
                    isPhotographer={isPhotographer}
                    isEditor={isEditor}
                    isClient={isClient}
                    role={currentUserRole}
                    onShootUpdate={refreshShoot}
                  />
                </TabsContent>

                {(isAdmin || isClient) && (
                  <TabsContent value="tours" className="mt-0">
                    <ShootDetailsTourTab
                      shoot={shoot}
                      isAdmin={isAdmin}
                      isClient={isClient}
                      onShootUpdate={refreshShoot}
                    />
                  </TabsContent>
                )}
                {isAdmin && (
                  <TabsContent value="settings" className="mt-0">
                    <ShootDetailsSettingsTab
                      shoot={shoot}
                      isAdmin={isAdmin}
                      onShootUpdate={refreshShoot}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </div>

            {/* Buttons Section at Bottom */}
            <div className="px-2 sm:px-4 py-1.5 sm:py-2 border-t bg-background flex-shrink-0 space-y-2">
              {/* Publish to Bright MLS moved to top right header */}
              <ShootDetailsQuickActions
                shoot={shoot}
                isAdmin={isAdmin}
                isPhotographer={isPhotographer}
                isEditor={isEditor}
                isClient={isClient}
                role={currentUserRole}
                onShootUpdate={refreshShoot}
                onProcessPayment={handleProcessPayment}
                onViewInvoice={handleShowInvoice}
                onDownloadAll={isEditor ? handleEditorDownloadRaw : () => setIsDownloadDialogOpen(true)}
              />
              {/* Payment Buttons - Mark as Paid and Process Payment (50/50 split) */}
              {(isAdmin || isClient || isRep) && (
                <div className="hidden sm:flex gap-2 w-full">
                  {(currentUserRole === 'superadmin' || currentUserRole === 'admin') && !((shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0)) && (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 h-8 text-xs px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                          const outstandingAmount = (shoot.payment?.totalQuote ?? 0) - (shoot.payment?.totalPaid ?? 0);
                          const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-paid`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json',
                              'Accept': 'application/json',
                            },
                            body: JSON.stringify({
                              payment_type: 'manual',
                              amount: outstandingAmount > 0 ? outstandingAmount : shoot.payment?.totalQuote ?? 0,
                            }),
                          });
                          if (!res.ok) {
                            const errorData = await res.json().catch(() => ({ message: 'Failed to mark as paid' }));
                            throw new Error(errorData.message || errorData.error || 'Failed to mark as paid');
                          }
                          refreshShoot();
                          toast({
                            title: 'Success',
                            description: 'Shoot marked as paid successfully.',
                          });
                        } catch (error: any) {
                          console.error('Mark as paid error:', error);
                          toast({
                            title: 'Error',
                            description: error?.message || 'Failed to mark as paid',
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      <DollarSignIcon className="h-3.5 w-3.5 mr-1.5" />
                      <span>Mark as Paid</span>
                    </Button>
                  )}
                  {isAdmin && isPaid && (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full h-8 text-xs px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
                      onClick={handleShowInvoice}
                      disabled={isLoadingInvoice}
                    >
                      {isLoadingInvoice ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      <span>{isLoadingInvoice ? 'Loading...' : 'Show Invoice'}</span>
                    </Button>
                  )}
                  {(isAdmin || isRep) && !isPaid && (
                    <Button
                      variant="default"
                      size="sm"
                      className={`${currentUserRole === 'superadmin' && !((shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0)) ? 'flex-1' : 'w-full'} h-8 text-xs px-3 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-300 dark:border-orange-800`}
                      onClick={handleProcessPayment}
                    >
                      <DollarSignIcon className="h-3.5 w-3.5 mr-1.5" />
                      <span>Process payment</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Pane - Full width on mobile, 62.5% on desktop - Media Tab Always Visible, Expandable */}
          <div className={`w-full sm:w-[62.5%] flex flex-col ${isMediaExpanded ? 'fixed inset-x-0 bottom-0 top-[7.5rem] sm:relative sm:inset-auto sm:top-auto sm:bottom-auto flex-1' : 'h-auto max-h-[12vh] overflow-hidden'} sm:min-h-0 sm:flex-1 sm:max-h-none transition-all duration-300 flex-1 sm:flex-none bg-background border-t sm:border-t-0 z-40 sm:z-auto shadow-lg sm:shadow-none`}>
            <div className={`flex-1 min-h-0 flex flex-col ${!isMediaExpanded ? 'overflow-hidden' : 'overflow-y-auto'} sm:overflow-y-auto px-2 sm:px-3`}>
              <ShootDetailsMediaTab
                shoot={shoot}
                isAdmin={isAdmin}
                isPhotographer={isPhotographer}
                isEditor={isEditor}
                isClient={isClient}
                role={currentUserRole}
                onShootUpdate={refreshShoot}
                onSelectionChange={setSelectedFileIds}
                isExpanded={isMediaExpanded}
                onToggleExpand={() => setIsMediaExpanded(!isMediaExpanded)}
              />
            </div>
          </div>
        </div>
        
        {/* Bottom Overlay Buttons - Mobile only */}
        {(isAdmin || isClient || isRep) && (
          <div className="fixed sm:hidden bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 px-3 py-2 space-y-2">
            {/* Admin-only actions */}
            {canFinalise && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-8 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                  onClick={handleFinalise}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  <span>Finalise</span>
                </Button>
              </div>
            )}

            {/* Payment Buttons - Mark as Paid and Process Payment (50/50 split) */}
            <div className="flex gap-2 w-full">
              {(currentUserRole === 'superadmin' || currentUserRole === 'admin') && !((shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0)) && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-9 text-xs px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                      const outstandingAmount = (shoot.payment?.totalQuote ?? 0) - (shoot.payment?.totalPaid ?? 0);
                      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-paid`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json',
                          'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                          payment_type: 'manual',
                          amount: outstandingAmount > 0 ? outstandingAmount : shoot.payment?.totalQuote ?? 0,
                        }),
                      });
                      if (!res.ok) {
                        const errorData = await res.json().catch(() => ({ message: 'Failed to mark as paid' }));
                        throw new Error(errorData.message || errorData.error || 'Failed to mark as paid');
                      }
                      refreshShoot();
                      toast({
                        title: 'Success',
                        description: 'Shoot marked as paid successfully.',
                      });
                    } catch (error: any) {
                      console.error('Mark as paid error:', error);
                      toast({
                        title: 'Error',
                        description: error?.message || 'Failed to mark as paid',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <DollarSignIcon className="h-3.5 w-3.5 mr-1.5" />
                  <span>Mark as Paid</span>
                </Button>
              )}
              {isAdmin && isPaid && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full h-9 text-xs px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
                  onClick={handleShowInvoice}
                  disabled={isLoadingInvoice}
                >
                  {isLoadingInvoice ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  <span>{isLoadingInvoice ? 'Loading...' : 'Show Invoice'}</span>
                </Button>
              )}
              {(isAdmin || isRep) && !isPaid && (
                <Button
                  variant="default"
                  size="sm"
                  className={`${currentUserRole === 'superadmin' && !((shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0)) ? 'flex-1' : 'w-full'} h-9 text-xs px-3 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-300 dark:border-orange-800`}
                  onClick={handleProcessPayment}
                >
                  <DollarSignIcon className="h-3.5 w-3.5 mr-1.5" />
                  <span>Process payment</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {shoot && (
        <SquarePaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => setIsPaymentDialogOpen(false)}
          amount={amountDue || 100}
          shootId={shoot.id}
          shootAddress={shoot.location?.fullAddress || shoot.location?.address}
          shootServices={Array.isArray(shoot.services) ? shoot.services.map((s: any) => typeof s === 'string' ? s : s?.name || s?.label || String(s)).filter(Boolean) : []}
          shootDate={shoot.scheduledDate}
          shootTime={shoot.time ? formatTime(shoot.time) : undefined}
          clientName={shouldHideClientDetails ? undefined : shoot.client?.name}
          clientEmail={shouldHideClientDetails ? undefined : shoot.client?.email}
          totalQuote={shoot.payment?.totalQuote}
          totalPaid={shoot.payment?.totalPaid}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {/* Cancellation Fee Dialog */}
      <Dialog open={isCancellationFeeDialogOpen} onOpenChange={setIsCancellationFeeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cancellation Fee Notice</DialogTitle>
            <DialogDescription>
              This shoot is scheduled within 3-4 hours. A cancellation fee of $60 may apply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Notice:</strong> This shoot is scheduled within 3-4 hours. According to our policy, a cancellation fee of $60 may be charged.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addCancellationFee">Add cancellation fee to invoice?</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="addCancellationFee"
                  checked={shouldAddCancellationFee}
                  onChange={(e) => setShouldAddCancellationFee(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <Label htmlFor="addCancellationFee" className="text-sm font-normal cursor-pointer">
                  Yes, add $60 cancellation fee to the invoice
                </Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCancellationFeeDialogOpen(false);
                setShouldAddCancellationFee(false);
                setPendingAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCancellationFeeConfirm}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark as On Hold Dialog */}
      <Dialog open={isOnHoldDialogOpen} onOpenChange={setIsOnHoldDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Mark Shoot as On Hold</DialogTitle>
            <DialogDescription>
              Please provide a reason for putting this shoot on hold. This will help track why the shoot was paused.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="onHoldReason">Reason <span className="text-destructive">*</span></Label>
              <Textarea
                id="onHoldReason"
                placeholder="Enter the reason for putting this shoot on hold..."
                value={onHoldReason}
                onChange={(e) => setOnHoldReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsOnHoldDialogOpen(false);
                setOnHoldReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkOnHold}
              disabled={!onHoldReason.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <PauseCircle className="h-4 w-4 mr-2" />
              Mark as On Hold
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Shoot Dialog - Admin only */}
      <Dialog open={isCancelShootDialogOpen} onOpenChange={setIsCancelShootDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cancel Shoot</DialogTitle>
            <DialogDescription>
              This will permanently cancel the shoot. The client will be notified of the cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Warning:</strong> This action cannot be undone. The shoot will be marked as cancelled and the client will be notified.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancelShootReason">Reason (optional)</Label>
              <Textarea
                id="cancelShootReason"
                placeholder="Enter the reason for cancelling this shoot..."
                value={cancelShootReason}
                onChange={(e) => setCancelShootReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            {isWithinCancellationFeeWindow && (
              <div className="space-y-2">
                <Label htmlFor="addCancellationFeeCancelDialog">Add cancellation fee to invoice?</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="addCancellationFeeCancelDialog"
                    checked={shouldAddCancellationFee}
                    onChange={(e) => setShouldAddCancellationFee(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <Label htmlFor="addCancellationFeeCancelDialog" className="text-sm font-normal cursor-pointer">
                    Yes, add $60 cancellation fee to the invoice
                  </Label>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCancelShootDialogOpen(false);
                setCancelShootReason('');
                setShouldAddCancellationFee(false);
              }}
              disabled={isCancellingShoot}
            >
              Keep Shoot
            </Button>
            <Button
              onClick={handleCancelShoot}
              disabled={isCancellingShoot}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCancellingShoot ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Shoot
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Download Media Size Selection Dialog - Client only */}
      {isClient && (
        <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Download Media</DialogTitle>
              <DialogDescription>
                Select the image size you want to download
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => handleDownloadMedia('original')}
                disabled={isDownloading}
              >
                <div className="flex flex-col items-start">
                  <div className="font-medium">Original Size</div>
                  <div className="text-xs text-muted-foreground">Full resolution, highest quality</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => handleDownloadMedia('large')}
                disabled={isDownloading}
              >
                <div className="flex flex-col items-start">
                  <div className="font-medium">Large Size</div>
                  <div className="text-xs text-muted-foreground">High quality, optimized for printing</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => handleDownloadMedia('medium')}
                disabled={isDownloading}
              >
                <div className="flex flex-col items-start">
                  <div className="font-medium">Medium Size</div>
                  <div className="text-xs text-muted-foreground">Web optimized, good for sharing</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => handleDownloadMedia('small')}
                disabled={isDownloading}
              >
                <div className="flex flex-col items-start">
                  <div className="font-medium">Small Size</div>
                  <div className="text-xs text-muted-foreground">1800x1200px, optimized for web</div>
                </div>
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDownloadDialogOpen(false)} disabled={isDownloading}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Approval Modal for requested shoots */}
      {isApprovalModalOpen && shoot && (
        <ShootApprovalModal
          isOpen={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          shootId={shoot.id}
          shootAddress={(shoot as any).addressLine || shoot.location?.address || ''}
          currentScheduledAt={shoot.scheduledDate}
          onApproved={() => {
            setIsApprovalModalOpen(false);
            onShootUpdate?.();
            onClose();
          }}
          photographers={photographers}
        />
      )}

      {/* Decline Modal for requested shoots */}
      {isDeclineModalOpen && shoot && (
        <ShootDeclineModal
          isOpen={isDeclineModalOpen}
          onClose={() => setIsDeclineModalOpen(false)}
          shootId={shoot.id}
          shootAddress={(shoot as any).addressLine || shoot.location?.address || ''}
          onDeclined={() => {
            setIsDeclineModalOpen(false);
            onShootUpdate?.();
            onClose();
          }}
        />
      )}
      
      {selectedInvoice && (
        <InvoiceViewDialog
          isOpen={isInvoiceDialogOpen}
          onClose={() => {
            setIsInvoiceDialogOpen(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
        />
      )}
    </Dialog>
  );
}

