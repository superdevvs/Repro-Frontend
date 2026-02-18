import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { SquarePaymentDialog } from '@/components/payments/SquarePaymentDialog';
import { MarkAsPaidDialog, MarkAsPaidPayload } from '@/components/payments/MarkAsPaidDialog';
import { RescheduleDialog } from '@/components/dashboard/RescheduleDialog';

const statusBadgeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  requested: { label: 'Requested', variant: 'secondary' },
  booked: { label: 'Scheduled', variant: 'secondary' },
  scheduled: { label: 'Scheduled', variant: 'default' },
  raw_upload_pending: { label: 'Awaiting RAW', variant: 'outline' },
  uploaded: { label: 'Uploaded', variant: 'default' },
  raw_uploaded: { label: 'Uploaded', variant: 'default' },
  photos_uploaded: { label: 'Uploaded', variant: 'default' },
  in_progress: { label: 'Uploaded', variant: 'default' },
  raw_issue: { label: 'RAW Issue', variant: 'destructive' },
  editing: { label: 'Editing', variant: 'secondary' },
  editing_uploaded: { label: 'In Review', variant: 'default' },
  ready_for_review: { label: 'In Review', variant: 'default' },
  pending_review: { label: 'In Review', variant: 'default' },
  review: { label: 'In Review', variant: 'default' },
  editing_issue: { label: 'Editing Issue', variant: 'destructive' },
  delivered: { label: 'Delivered', variant: 'default' },
  ready_for_client: { label: 'Delivered', variant: 'default' },
  admin_verified: { label: 'Delivered', variant: 'default' },
  ready: { label: 'Delivered', variant: 'default' },
  on_hold: { label: 'On Hold', variant: 'destructive' },
  hold_on: { label: 'On Hold', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  canceled: { label: 'Cancelled', variant: 'destructive' },
  declined: { label: 'Declined', variant: 'destructive' },
};

const paymentBadgeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  paid: { label: 'Paid', variant: 'default' },
  unpaid: { label: 'Unpaid', variant: 'destructive' },
  partial: { label: 'Partial', variant: 'secondary' },
};

const normalizeStatusKey = (value?: string | null) => {
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

const extractServiceNames = (input: any): string[] => {
  if (!input) return [];

  const toName = (value: any) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return (
        value.name ??
        value.label ??
        value.service_name ??
        value.serviceName ??
        value.title ??
        null
      );
    }
    return String(value);
  };

  const normalizeArray = (value: any): any[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    if (value && typeof value === 'object') {
      if (Array.isArray(value.data)) return value.data;
      return Object.values(value);
    }
    return [];
  };

  return normalizeArray(input)
    .map(toName)
    .filter((name): name is string => Boolean(name && typeof name === 'string'));
};

const normalizeShootServices = (shootData: any): string[] => {
  if (!shootData) return [];

  const sources: any[] = [
    shootData.services,
    shootData.services_list,
    shootData.servicesList,
    shootData.package?.servicesIncluded,
    shootData.package_details?.servicesIncluded,
    shootData.service ? [shootData.service] : null,
    shootData.service_name,
  ];

  for (const source of sources) {
    const names = extractServiceNames(source);
    if (names.length) {
      return names;
    }
  }

  return [];
};

const ShootDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { formatTemperature, formatTime, formatDate } = useUserPreferences();
  const role = user?.role || 'client';
  const normalizedRole = role.toLowerCase();
  const isSuperAdmin = normalizedRole === 'superadmin';
  const isEditingManager = normalizedRole === 'editing_manager';
  const isAdmin = normalizedRole === 'admin' || isSuperAdmin || isEditingManager;
  const isAdminOrSuperAdmin = isAdmin; // Admin, superadmin, and editing_manager can access most features
  const isRep = ['salesrep', 'sales_rep', 'rep', 'representative'].includes(normalizedRole);
  const isAdminOrRep = isAdmin || isRep;
  const isEditor = normalizedRole === 'editor';
  const isPhotographer = normalizedRole === 'photographer';
  const isClient = normalizedRole === 'client';
  
  const [shoot, setShoot] = useState<ShootData | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [rawFileCount, setRawFileCount] = useState(0);

  const rawMediaCount = Number(
    shoot?.rawPhotoCount ??
      (shoot as any)?.raw_photo_count ??
      shoot?.mediaSummary?.rawUploaded ??
      0
  );
  const editedMediaCount = Number(
    shoot?.editedPhotoCount ??
      (shoot as any)?.edited_photo_count ??
      shoot?.mediaSummary?.editedUploaded ??
      0
  );
  const hasEditedWithoutRaw = editedMediaCount > 0 && rawMediaCount === 0;

  const loadShoot = useCallback(async (): Promise<ShootData | null> => {
    if (!id) return null;
    try {
      const headers = getApiHeaders();
      const res = await fetch(`${API_BASE_URL}/api/shoots/${id}`, {
        headers,
      });
      
      if (!res.ok) throw new Error('Failed to fetch shoot');
      
      const json = await res.json();
      let shootData = json.data || json;
      
      // Normalize the data structure
      if (shootData) {
        if (shootData.isPrivateListing === undefined && shootData.is_private_listing !== undefined) {
          shootData.isPrivateListing = Boolean(shootData.is_private_listing);
        }
        if (!shootData.location && (shootData.address || shootData.city)) {
          shootData.location = {
            address: shootData.address || '',
            city: shootData.city || '',
            state: shootData.state || '',
            zip: shootData.zip || '',
            fullAddress: shootData.fullAddress || shootData.address || '',
          };
        }
        
        const normalizedServices = normalizeShootServices(shootData);
        if (normalizedServices.length) {
          shootData.services = normalizedServices;
          shootData.services_list = normalizedServices;
        } else if (!Array.isArray(shootData.services)) {
          shootData.services = [];
        }
        
        if (!shootData.scheduledDate && shootData.scheduled_date) {
          shootData.scheduledDate = shootData.scheduled_date;
        }
        
        // Normalize payment data
        const toNumber = (value: any): number => {
          if (value === null || value === undefined) return 0;
          const num = typeof value === 'string' ? parseFloat(value) : Number(value);
          return isNaN(num) ? 0 : num;
        };
        
        if (!shootData.payment) {
          shootData.payment = {
            baseQuote: toNumber(shootData.base_quote),
            taxRate: toNumber(shootData.tax_rate),
            taxAmount: toNumber(shootData.tax_amount),
            totalQuote: toNumber(shootData.total_quote),
            totalPaid: toNumber(shootData.total_paid),
            lastPaymentDate: shootData.last_payment_date || undefined,
            lastPaymentType: shootData.last_payment_type || undefined,
          };
        } else {
          // Normalize payment fields if payment object exists but has wrong field names
          if (shootData.payment.base_quote !== undefined && shootData.payment.baseQuote === undefined) {
            shootData.payment.baseQuote = toNumber(shootData.payment.base_quote);
          } else if (shootData.payment.baseQuote !== undefined) {
            shootData.payment.baseQuote = toNumber(shootData.payment.baseQuote);
          }
          
          if (shootData.payment.tax_amount !== undefined && shootData.payment.taxAmount === undefined) {
            shootData.payment.taxAmount = toNumber(shootData.payment.tax_amount);
          } else if (shootData.payment.taxAmount !== undefined) {
            shootData.payment.taxAmount = toNumber(shootData.payment.taxAmount);
          }
          
          if (shootData.payment.total_quote !== undefined && shootData.payment.totalQuote === undefined) {
            shootData.payment.totalQuote = toNumber(shootData.payment.total_quote);
          } else if (shootData.payment.totalQuote !== undefined) {
            shootData.payment.totalQuote = toNumber(shootData.payment.totalQuote);
          }
          
          if (shootData.payment.total_paid !== undefined && shootData.payment.totalPaid === undefined) {
            shootData.payment.totalPaid = toNumber(shootData.payment.total_paid);
          } else if (shootData.payment.totalPaid !== undefined) {
            shootData.payment.totalPaid = toNumber(shootData.payment.totalPaid);
          }
          
          // Ensure all payment fields are numbers
          shootData.payment.baseQuote = toNumber(shootData.payment.baseQuote);
          shootData.payment.taxAmount = toNumber(shootData.payment.taxAmount);
          shootData.payment.totalQuote = toNumber(shootData.payment.totalQuote);
          shootData.payment.totalPaid = toNumber(shootData.payment.totalPaid);
        }
      }
      
      setShoot(shootData);
      return shootData;
    } catch (error: any) {
      console.error('Error fetching shoot details:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to fetch shoot details';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      setShoot(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadShoot();
  }, [loadShoot]);

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
    const validTabs = new Set([
      'media',
      'tour',
      'slideshow',
      'settings',
      'activity',
      'notes',
      'issues',
    ]);

    if (validTabs.has(mappedTab)) {
      setActiveTab(mappedTab);
    }
  }, [location.hash]);

  // Fetch raw file count for editor
  useEffect(() => {
    const fetchRawFileCount = async () => {
      if (!id || !isEditor) return;
      try {
        const headers = getApiHeaders();
        const res = await fetch(`${API_BASE_URL}/api/shoots/${id}/files?type=raw`, {
          headers,
        });
        if (res.ok) {
          const data = await res.json();
          const files = data.data || data.files || data || [];
          setRawFileCount(Array.isArray(files) ? files.length : 0);
        }
      } catch (error) {
        console.error('Failed to fetch raw file count:', error);
      }
    };
    fetchRawFileCount();
  }, [id, isEditor]);

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
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to download raw files.', variant: 'destructive' });
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
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to generate share link.', variant: 'destructive' });
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
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to create payment link';
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

        const workflowLogs = (latestShoot as any)?.workflowLogs || (latestShoot as any)?.workflow_logs || [];
        const hasFinalizeFailure = Array.isArray(workflowLogs)
          && workflowLogs.some((log: any) => String(log?.action || '').toLowerCase() === 'finalize_failed');

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
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to finalize shoot',
        variant: 'destructive',
      });
    }
  };

  const handleProcessPayment = () => {
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = (payment: any) => {
    toast({
      title: 'Payment Successful',
      description: 'Payment has been processed successfully.',
    });
    loadShoot(); // Reload shoot data to update payment status
  };

  // Check if shoot can be put on hold
  const canPutOnHold = shoot && (
    (shoot.status === 'scheduled' || shoot.status === 'booked' || shoot.workflowStatus === 'booked') &&
    shoot.status !== 'on_hold' &&
    shoot.workflowStatus !== 'on_hold'
  );

  const isHoldRequested = Boolean(shoot?.holdRequestedAt);
  // Check if user can put shoot on hold
  const canDirectHold = isAdminOrRep && canPutOnHold && !isHoldRequested;
  const canRequestHold = isClient && canPutOnHold && !isHoldRequested;
  const canReviewHoldRequest = isAdminOrRep && isHoldRequested;

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

  const amountDue = shoot ? (shoot.payment?.totalQuote || 0) - (shoot.payment?.totalPaid || 0) : 0;

  const handleMarkPaidConfirm = async (payload: MarkAsPaidPayload) => {
    if (!shoot) return;
    const outstandingAmount = (shoot.payment?.totalQuote ?? 0) - (shoot.payment?.totalPaid ?? 0);
    const amount = outstandingAmount > 0 ? outstandingAmount : (shoot.payment?.totalQuote ?? 0);

    const body: Record<string, any> = {
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

  const workflowStatusKey = normalizeStatusKey(shoot?.workflowStatus || shoot?.status || '');
  const workflowBadge = statusBadgeMap[workflowStatusKey];
  
  // Calculate payment status from totalQuote and totalPaid (payment_status doesn't exist in type)
  const calculatePaymentStatus = (payment: any) => {
    if (!payment) return 'unpaid';
    const totalQuote = payment.totalQuote || 0;
    const totalPaid = payment.totalPaid || 0;
    if (totalPaid >= totalQuote) return 'paid';
    if (totalPaid > 0) return 'partial';
    return 'unpaid';
  };
  
  const paymentBadge = paymentBadgeMap[calculatePaymentStatus(shoot?.payment)];

  const fullAddress = shoot?.location?.fullAddress || 
    (shoot?.location ? `${shoot.location.address}, ${shoot.location.city}, ${getStateFullName(shoot.location.state)} ${shoot.location.zip}`.trim() : '');

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
        {/* Tiered Header - Multi-layer hierarchy */}
        <div className="sticky top-0 z-50 bg-background border-b">
            {/* Top Bar - Breadcrumb & Navigation */}
            <div className="px-3 sm:px-6 py-1.5 border-b bg-muted/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => navigate('/shoot-history')}
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Shoots</span>
                  </Button>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">Shoot #{shoot.id}</span>
                  {/* Status badge and photographer info */}
                  {workflowBadge && (
                    <Badge variant={workflowBadge.variant} className="text-xs px-2 py-0.5 ml-2">
                      {workflowBadge.label}
                    </Badge>
                  )}
                  {/* Photographer info in breadcrumb - hidden for editor/photographer (shown in services section instead) */}
                  {!isEditor && !isPhotographer && shoot.photographer?.name && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                      <Camera className="h-3 w-3" />
                      <span className="font-medium">{shoot.photographer.name}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      <span className="hidden sm:inline">Online</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="whitespace-nowrap">{formattedDate}</span>
                  {formattedTime && <span className="hidden sm:inline">•</span>}
                  {formattedTime && <span className="whitespace-nowrap">{formattedTime}</span>}
                  {shoot.weather?.temperature && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Cloud className="h-3 w-3" />
                        <span className="hidden sm:inline">{formatTemperature(typeof shoot.weather.temperature === 'number' ? shoot.weather.temperature : parseInt(String(shoot.weather.temperature), 10))} {shoot.weather.summary}</span>
                        <span className="sm:hidden">{formatTemperature(typeof shoot.weather.temperature === 'number' ? shoot.weather.temperature : parseInt(String(shoot.weather.temperature), 10))}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Main Header - Property Address */}
            <div className="px-3 sm:px-6 py-2 sm:py-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 w-full sm:w-auto">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate flex-1">
                      {shoot.id ? `#${shoot.id} · ` : ''}
                      {shoot.location?.address || 'Shoot Details'}
                    </h1>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-muted"
                        onClick={copyAddress}
                        title="Copy address"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-muted"
                        onClick={openInMaps}
                        title="Open in Maps"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {addressParts.length > 1 && (
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {addressParts.slice(1).join(',').trim()}
                    </p>
                  )}
                </div>

                {/* Action Bar - Stack on mobile */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  {canDirectHold && (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto"
                      onClick={() => setIsOnHoldDialogOpen(true)}
                    >
                      <PauseCircle className="h-3 w-3 mr-1.5" />
                      <span className="hidden sm:inline">Mark on hold</span>
                      <span className="sm:hidden">Hold</span>
                    </Button>
                  )}
                  {canRequestHold && (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto"
                      onClick={() => setIsOnHoldDialogOpen(true)}
                    >
                      <PauseCircle className="h-3 w-3 mr-1.5" />
                      <span className="hidden sm:inline">Request hold</span>
                      <span className="sm:hidden">Hold</span>
                    </Button>
                  )}
                  {isClient && isHoldRequested && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled
                    >
                      <PauseCircle className="h-3 w-3 mr-1.5" />
                      <span className="hidden sm:inline">Hold requested</span>
                      <span className="sm:hidden">Requested</span>
                    </Button>
                  )}
                  {canReviewHoldRequest && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-200 text-amber-700 hover:bg-amber-50 w-full sm:w-auto"
                      onClick={() => setIsHoldApprovalDialogOpen(true)}
                    >
                      <PauseCircle className="h-3 w-3 mr-1.5" />
                      <span className="hidden sm:inline">Review hold request</span>
                      <span className="sm:hidden">Review hold</span>
                    </Button>
                  )}
                  {isAdmin && !hasEditedWithoutRaw && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                        onClick={handleSendToEditing}
                      >
                        <Send className="h-3 w-3 mr-1.5" />
                        <span className="hidden sm:inline">Send to Editing</span>
                        <span className="sm:hidden">Send to Editing</span>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                        onClick={handleFinalise}
                      >
                        <CheckCircle className="h-3 w-3 mr-1.5" />
                        <span className="hidden sm:inline">Finalize & Deliver</span>
                        <span className="sm:hidden">Finalize</span>
                      </Button>
                    </>
                  )}
                  {isAdminOrSuperAdmin && (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
                      onClick={handleProcessPayment}
                    >
                      <DollarSign className="h-3 w-3 mr-1.5" />
                      <span className="hidden sm:inline">Process Payment</span>
                      <span className="sm:hidden">Payment</span>
                    </Button>
                  )}
                  {/* Editor-specific: Download Raw and Share Link buttons */}
                  {isEditor && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                        onClick={handleEditorDownloadRaw}
                        disabled={isEditorDownloading || rawFileCount === 0}
                      >
                        {isEditorDownloading ? (
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3 mr-1.5" />
                        )}
                        <span className="hidden sm:inline">
                          {isEditorDownloading ? 'Downloading...' : `Download RAW (${rawFileCount})`}
                        </span>
                        <span className="sm:hidden">
                          {isEditorDownloading ? '...' : `RAW (${rawFileCount})`}
                        </span>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                        onClick={handleGenerateShareLink}
                        disabled={isGeneratingShareLink || rawFileCount === 0}
                      >
                        {isGeneratingShareLink ? (
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        ) : (
                          <Share2 className="h-3 w-3 mr-1.5" />
                        )}
                        <span className="hidden sm:inline">
                          {isGeneratingShareLink ? 'Generating...' : 'Share Link'}
                        </span>
                        <span className="sm:hidden">
                          {isGeneratingShareLink ? '...' : 'Share'}
                        </span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Meta Bar - Payment Badge only for admins */}
            {isAdminOrSuperAdmin && paymentBadge && (
              <div className="px-3 sm:px-6 py-1 border-t bg-muted/20">
                <div className="flex items-center gap-2">
                  <Badge variant={paymentBadge.variant} className="text-xs px-2.5 py-1">
                    {paymentBadge.label}
                  </Badge>
                </div>
              </div>
            )}

            {/* Enhanced Tab Bar - Sticks with header */}
            <div className="border-t bg-background shadow-sm flex-shrink-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start h-12 sm:h-14 px-3 sm:px-6 bg-transparent gap-1 overflow-x-auto">
                  <TabsTrigger 
                    value="media" 
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                  >
                    Media
                  </TabsTrigger>
                  <TabsTrigger 
                    value="issues" 
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                  >
                    Requests
                  </TabsTrigger>
                  {/* Tour, Slideshow, Settings tabs hidden for photographers and editors */}
                  {!isPhotographer && !isEditor && (
                    <>
                      <TabsTrigger 
                        value="tour" 
                        className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                      >
                        Tour
                      </TabsTrigger>
                      <TabsTrigger 
                        value="slideshow" 
                        className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                      >
                        Slideshow
                      </TabsTrigger>
                      <TabsTrigger 
                        value="settings" 
                        className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                      >
                        Settings
                      </TabsTrigger>
                    </>
                  )}
                  {!isPhotographer && (
                    <TabsTrigger 
                      value="activity" 
                      className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    >
                      <span className="hidden sm:inline">Activity Log</span>
                      <span className="sm:hidden">Activity</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger 
                    value="notes" 
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                  >
                    Notes
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

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
                        {shoot.services && shoot.services.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {shoot.services.map((service, index) => {
                              const serviceName = typeof service === 'string' ? service : (service as any).name || (service as any).label || String(service);
                              return (
                                <Badge key={index} variant="outline" className="text-xs px-2 py-0.5">
                                  {serviceName}
                                </Badge>
                              );
                            })}
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
                  {(isEditor || isPhotographer) && shoot.photographer?.name && (
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
                        onShootUpdate={loadShoot}
                      />
                    </div>
                  </TabsContent>

                  {!isPhotographer && (
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
                onShootUpdate={loadShoot}
                onMarkPaid={() => setIsMarkPaidDialogOpen(true)}
              />
            </div>
            )}
          </div>
        </div>

      {shoot && (
        <>
          <SquarePaymentDialog
            isOpen={isPaymentDialogOpen}
            onClose={() => setIsPaymentDialogOpen(false)}
            amount={amountDue}
            shootId={shoot.id}
            shootAddress={shoot.location?.fullAddress || shoot.location?.address}
            shootServices={normalizeShootServices(shoot)}
            shootDate={shoot.scheduledDate ? formatDate(shoot.scheduledDate) : undefined}
            shootTime={(shoot as any)?.scheduled_at ? formatTime((shoot as any).scheduled_at) : ((shoot as any)?.time ? formatTime((shoot as any).time) : undefined)}
            clientName={shoot.client?.name}
            clientEmail={shoot.client?.email}
            totalQuote={shoot.payment?.totalQuote}
            totalPaid={shoot.payment?.totalPaid}
            onPaymentSuccess={handlePaymentSuccess}
          />

          <MarkAsPaidDialog
            isOpen={isMarkPaidDialogOpen}
            onClose={() => setIsMarkPaidDialogOpen(false)}
            onConfirm={handleMarkPaidConfirm}
            title="Mark Shoot as Paid"
            description="Select the payment method and provide any required details."
            confirmLabel="Mark as Paid"
          />

          {/* Reschedule Dialog */}
          {shoot && (
            <RescheduleDialog
              shoot={shoot}
              isOpen={isRescheduleDialogOpen}
              onClose={() => {
                setIsRescheduleDialogOpen(false);
                loadShoot();
              }}
            />
          )}

          {/* Mark on hold / Request hold Dialog */}
          <Dialog open={isOnHoldDialogOpen} onOpenChange={setIsOnHoldDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{isClient ? 'Request hold' : 'Mark on hold'}</DialogTitle>
                <DialogDescription>
                  {isClient
                    ? 'Tell us why you need to put this shoot on hold. Your request will be reviewed by an admin.'
                    : 'Please provide a reason for putting this shoot on hold. This will help track why the shoot was paused.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="onHoldReason">Reason <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="onHoldReason"
                    placeholder={isClient
                      ? 'Enter the reason for requesting a hold...'
                      : 'Enter the reason for putting this shoot on hold...'}
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
                  {isClient ? 'Submit request' : 'Mark on hold'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Hold Approval Dialog */}
          <Dialog open={isHoldApprovalDialogOpen} onOpenChange={setIsHoldApprovalDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Hold request</DialogTitle>
                <DialogDescription>
                  {shoot?.holdReason
                    ? `Reason: ${shoot.holdReason}`
                    : 'No reason was provided for this hold request.'}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsHoldApprovalDialogOpen(false)}
                  disabled={holdProcessing}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRejectHold}
                  disabled={holdProcessing}
                >
                  {holdProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Reject
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={handleApproveHold}
                  disabled={holdProcessing}
                >
                  {holdProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Approve hold
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </DashboardLayout>
  );
};

const ShootDetailsWithBoundary = withErrorBoundary(ShootDetails);

export default React.memo(ShootDetailsWithBoundary);
