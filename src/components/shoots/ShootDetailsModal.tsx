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
import { X, ExternalLink, CalendarIcon, MapPinIcon, ClockIcon, Send, CheckCircle, DollarSign as DollarSignIcon, ChevronUp, ChevronDown, Edit, Save, XCircle, PauseCircle, PlayCircle, Upload, Download } from "lucide-react";
import { format } from 'date-fns';
import { ShootData } from '@/types/shoots';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';
import { useShoots } from '@/context/ShootsContext';
import { getWeatherForLocation, WeatherInfo } from '@/services/weatherService';
import { subscribeToWeatherProvider } from '@/state/weatherProviderStore';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

// Import tab components
import { ShootDetailsOverviewTab } from './tabs/ShootDetailsOverviewTab';
import { ShootDetailsMediaTab } from './tabs/ShootDetailsMediaTab';
import { ShootDetailsNotesTab } from './tabs/ShootDetailsNotesTab';
import { ShootDetailsIssuesTab } from './tabs/ShootDetailsIssuesTab';
import { ShootDetailsSettingsTab } from './tabs/ShootDetailsSettingsTab';
import { ShootDetailsTourTab } from './tabs/ShootDetailsTourTab';
import { ShootDetailsQuickActions } from './tabs/ShootDetailsQuickActions';
import { SquarePaymentDialog } from '@/components/payments/SquarePaymentDialog';

interface ShootDetailsModalProps {
  shootId: string | number;
  isOpen: boolean;
  onClose: () => void;
  currentRole?: string; // Optional override, defaults to auth role
  onShootUpdate?: () => void; // Callback to refresh shoot list when shoot is updated
  initialWeather?: WeatherInfo | null; // Pre-fetched weather from dashboard to avoid re-fetching
}

export function ShootDetailsModal({ 
  shootId, 
  isOpen, 
  onClose,
  currentRole,
  onShootUpdate,
  initialWeather
}: ShootDetailsModalProps) {
  const navigate = useNavigate();
  const { role: authRole, user } = useAuth();
  const { toast } = useToast();
  const { updateShoot } = useShoots();
  const { formatTemperature, formatTime } = useUserPreferences();
  
  const [shoot, setShoot] = useState<ShootData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
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
  const [isPublishingToBrightMls, setIsPublishingToBrightMls] = useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [editActions, setEditActions] = useState<{ save: () => void; cancel: () => void } | null>(null);
  
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

  // Subscribe to weather provider updates
  useEffect(() => {
    const unsubscribe = subscribeToWeatherProvider(() => {
      setProviderVersion((version) => version + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch shoot data
  useEffect(() => {
    if (!isOpen || !shootId) return;
    
    const fetchShoot = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        if (!res.ok) throw new Error('Failed to fetch shoot');
        
        const json = await res.json();
        // Handle different API response structures
        let shootData = json.data || json;
        
        // If the response has nested structure, try to extract
        if (json.success && json.data) {
          shootData = json.data;
        }
        
        // Normalize the data structure
        if (shootData) {
          // Ensure location object exists
          if (!shootData.location && (shootData.address || shootData.city)) {
            shootData.location = {
              address: shootData.address || '',
              city: shootData.city || '',
              state: shootData.state || '',
              zip: shootData.zip || '',
              fullAddress: shootData.fullAddress || shootData.address || '',
            };
          }
          
          // Ensure services is an array - try multiple sources
          if (!Array.isArray(shootData.services)) {
            // Try services_list first (explicitly added by backend)
            if (shootData.services_list && Array.isArray(shootData.services_list)) {
              shootData.services = shootData.services_list;
            }
            // Try services as object with data property
            else if (shootData.services && typeof shootData.services === 'object' && shootData.services.data) {
              shootData.services = Array.isArray(shootData.services.data) ? shootData.services.data : [];
            }
            // Try package.servicesIncluded
            else if (shootData.package?.servicesIncluded && Array.isArray(shootData.package.servicesIncluded)) {
              shootData.services = shootData.package.servicesIncluded;
            }
            // Try service (singular)
            else if (shootData.service) {
              shootData.services = [shootData.service.name || shootData.service];
            }
            // Try string
            else if (typeof shootData.services === 'string') {
              shootData.services = [shootData.services];
            }
            // Default to empty array
            else {
              shootData.services = [];
            }
          }
          
          // Normalize service names to strings
          if (Array.isArray(shootData.services)) {
            shootData.services = shootData.services.map((service: any) => {
              if (typeof service === 'string') return service;
              if (service && typeof service === 'object') {
                return service.name || service.label || service.service_name || String(service);
              }
              return String(service);
            }).filter(Boolean);
          }
          
          // Also ensure services_list exists
          if (!shootData.services_list && Array.isArray(shootData.services)) {
            shootData.services_list = shootData.services;
          }
          
          // Ensure scheduledDate exists
          if (!shootData.scheduledDate && shootData.scheduled_date) {
            shootData.scheduledDate = shootData.scheduled_date;
          }
          
          // Normalize property_details to propertyDetails
          if (!shootData.propertyDetails && (shootData as any).property_details) {
            shootData.propertyDetails = (shootData as any).property_details;
          }
          
          // Ensure status and workflowStatus are properly set
          if (!shootData.status && shootData.workflow_status) {
            // If status is missing but workflow_status exists, use it as fallback
            shootData.status = shootData.workflow_status;
          }
          if (!shootData.workflowStatus && shootData.workflow_status) {
            shootData.workflowStatus = shootData.workflow_status;
          }
          // Normalize hold_on to on_hold for consistency
          if (shootData.status === 'hold_on') {
            shootData.status = 'on_hold';
          }
          if (shootData.workflowStatus === 'hold_on') {
            shootData.workflowStatus = 'on_hold';
          }
          
          // Ensure payment object exists with proper structure and convert to numbers
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
            // Also ensure all values are numbers
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
            shootData.payment.taxRate = toNumber(shootData.payment.taxRate);
            shootData.payment.taxAmount = toNumber(shootData.payment.taxAmount);
            shootData.payment.totalQuote = toNumber(shootData.payment.totalQuote);
            shootData.payment.totalPaid = toNumber(shootData.payment.totalPaid);
          }
        }
        
        // Debug: Log status for troubleshooting
        if (shootData.status || shootData.workflowStatus) {
          console.log('Shoot status:', {
            status: shootData.status,
            workflowStatus: shootData.workflowStatus,
            isOnHold: shootData.status === 'on_hold' || shootData.status === 'hold_on' || shootData.workflowStatus === 'on_hold'
          });
        }
        
        setShoot(shootData);
      } catch (error) {
        console.error('Error fetching shoot:', error);
        toast({
          title: 'Error',
          description: 'Failed to load shoot details',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchShoot();
  }, [isOpen, shootId, toast]);

  // Use initialWeather from dashboard if provided, otherwise fetch
  useEffect(() => {
    if (!isOpen) {
      setWeather(null);
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
  }, [shoot?.id, shoot?.location?.city, shoot?.location?.state, shoot?.scheduledDate, shoot?.time, isOpen, providerVersion, initialWeather]);

  // Refresh shoot data
  const refreshShoot = async () => {
    if (!shootId) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      
      if (res.ok) {
        const json = await res.json();
        let shootData = json.data || json;
        
        // Normalize status - ensure hold_on is converted to scheduled/booked
        if (shootData.status === 'hold_on' || shootData.status === 'on_hold') {
          shootData.status = 'scheduled';
        }
        if (shootData.workflowStatus === 'hold_on' || shootData.workflowStatus === 'on_hold') {
          shootData.workflowStatus = 'booked';
        }
        
        // Normalize scheduledDate to camelCase for UI
        if (!shootData.scheduledDate && shootData.scheduled_date) {
          shootData.scheduledDate = shootData.scheduled_date;
        }
        
        setShoot(shootData);
      }
    } catch (error) {
      console.error('Error refreshing shoot:', error);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'booked': { label: 'Scheduled', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      'raw_uploaded': { label: 'Raw uploaded', className: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
      'editing': { label: 'Editing', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      'in_review': { label: 'In review', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
      'ready': { label: 'Ready', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      'delivered': { label: 'Delivered', className: 'bg-green-600/10 text-green-600 border-green-600/20' },
      'scheduled': { label: 'Scheduled', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      'completed': { label: 'Completed', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
    };
    
    const statusInfo = statusMap[status.toLowerCase()] || { label: status, className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' };
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

  const amountDue = shoot ? (shoot.payment?.totalQuote || 0) - (shoot.payment?.totalPaid || 0) : 0;

  // Check if shoot is completed
  const isCompleted = shoot && (
    shoot.status === 'completed' || 
    shoot.status === 'delivered' ||
    shoot.workflowStatus === 'completed' ||
    shoot.workflowStatus === 'delivered'
  );

  // Check if shoot is scheduled or on hold - make it more lenient
  const isScheduledOrOnHold = shoot && (
    shoot.status === 'scheduled' || 
    shoot.status === 'booked' ||
    shoot.status === 'on_hold' || 
    shoot.workflowStatus === 'on_hold' ||
    shoot.workflowStatus === 'booked' ||
    !shoot.photographer?.id // Hold-on shoots (no photographer assigned)
  );

  // Check if shoot is on hold (defined first as it's used in canPutOnHold)
  const isOnHold = shoot && (
    shoot.status === 'on_hold' || 
    shoot.status === 'hold_on' ||
    shoot.workflowStatus === 'on_hold'
  );

  // Check if shoot can be put on hold (scheduled or booked, not already on hold)
  const canPutOnHold = shoot && !isOnHold && (
    shoot.status === 'scheduled' || 
    shoot.status === 'booked' || 
    shoot.workflowStatus === 'booked'
  );

  // Check if user can put shoot on hold
  const canUserPutOnHold = (isAdminOrRep || (isPhotographer && shoot?.photographer?.id === user?.id)) && canPutOnHold;

  // Check if user can resume from hold (admin, rep, or assigned photographer)
  const canResumeFromHold = isOnHold && (isAdminOrRep || (isPhotographer && shoot?.photographer?.id === user?.id));

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
    if (!shoot) return;
    
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
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
      
      // Client and photographer
      if (updates.client?.id) payload.client_id = updates.client.id;
      if (updates.photographer?.id) payload.photographer_id = updates.photographer.id;
      
      // Payment fields
      if (updates.payment?.baseQuote !== undefined) payload.base_quote = updates.payment.baseQuote;
      if (updates.payment?.taxAmount !== undefined) payload.tax_amount = updates.payment.taxAmount;
      if (updates.payment?.totalQuote !== undefined) payload.total_quote = updates.payment.totalQuote;
      
      // Services - convert to API format
      if (updates.services && Array.isArray(updates.services)) {
        payload.services = updates.services.map((service: any) => {
          if (typeof service === 'string') {
            // If it's just a string (service name), we can't update it without ID
            // Return null to skip
            return null;
          }
          if (service.id) {
            return {
              id: parseInt(service.id),
              quantity: service.quantity || 1,
              price: service.price || undefined,
              photographer_pay: service.photographer_pay !== undefined ? service.photographer_pay : undefined,
            };
          }
          return null;
        }).filter(Boolean);
      }
      
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) throw new Error('Failed to update shoot');
      
      toast({
        title: 'Success',
        description: 'Shoot updated successfully',
      });
      
      setIsEditMode(false);
      refreshShoot();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update shoot',
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

  // Determine visible tabs based on role (excluding media which is always in right pane)
  const visibleTabs = useMemo(() => {
    const tabs = [];
    tabs.push({ id: 'overview', label: 'Overview' });
    tabs.push({ id: 'notes', label: 'Notes' });
    
    // Requests tab - visible to all but with different permissions
    tabs.push({ id: 'issues', label: 'Requests' });
    
    // Tours tab - admin only
    if (isAdmin) {
      tabs.push({ id: 'tours', label: 'Tours' });
      tabs.push({ id: 'settings', label: 'Settings' });
    }
    
    return tabs;
  }, [isAdmin]);

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Shoot Details</DialogTitle>
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
          <DialogTitle>{shoot.location?.address || shoot.location?.fullAddress || 'Shoot Details'}</DialogTitle>
          <DialogDescription>
            View and manage shoot details including media, notes, issues, and settings
          </DialogDescription>
        </DialogHeader>
        
        {/* Action buttons - Top right: Edit, Send to editing, Finalise, View full page (before close) - Desktop only */}
        <div className="hidden sm:flex absolute top-4 z-[80] flex-col items-end right-14">
          <div className="flex items-center gap-1.5">
            {isAdminOrRep && isScheduledOrOnHold && !isEditMode && (
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
            {canUserPutOnHold && !isEditMode && (
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
            {canResumeFromHold && !isEditMode && (
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
            {isAdmin && !isEditMode && (
              <>
                {/* Send to editing - only show when shoot is booked/scheduled/in_progress */}
                {(shoot?.status === 'uploaded' || shoot?.workflowStatus === 'uploaded' ||
                  shoot?.status === 'booked' || shoot?.status === 'scheduled' || shoot?.status === 'in_progress' || 
                  shoot?.workflowStatus === 'booked' || shoot?.workflowStatus === 'SCHEDULED' || shoot?.workflowStatus === 'IN_PROGRESS') && (
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
                {/* Finalise - show when shoot is ready for admin review/finalization */}
                {(shoot?.workflowStatus === 'editing_uploaded' || shoot?.workflowStatus === 'EDITING_UPLOADED' ||
                  shoot?.workflowStatus === 'review' || shoot?.workflowStatus === 'in_review' ||
                  shoot?.status === 'ready_for_review' || shoot?.status === 'review' || shoot?.status === 'in_review') && (
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
            {(isAdmin || isClient) && isCompleted && !isEditMode && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-800"
                onClick={handleSendToBrightMls}
                disabled={isPublishingToBrightMls}
              >
                <Upload className="h-3 w-3 mr-1" />
                <span>{isPublishingToBrightMls ? 'Sending...' : 'Send images to Bright MLS'}</span>
              </Button>
            )}
            {fullPagePath && !isEditMode && (
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
          </div>
          {createdByLabel && (
            <div className="w-full mt-1 text-xs text-muted-foreground text-right whitespace-nowrap">
              Created by: {createdByLabel}
            </div>
          )}
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
          {isAdmin && !isEditMode && (shoot?.status === 'uploaded' || shoot?.workflowStatus === 'uploaded') && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
              onClick={handleSendToEditing}
            >
              <Send className="h-3 w-3" />
            </Button>
          )}
          {isAdminOrRep && isScheduledOrOnHold && !isEditMode && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              onClick={() => setIsEditMode(true)}
            >
              <Edit className="h-3 w-3" />
            </Button>
          )}
          {(isAdmin || isClient) && isCompleted && !isEditMode && (
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
                  {shoot.location?.address || shoot.location?.fullAddress || 'Shoot Details'}
                </h2>
                <div className="flex-shrink-0">
                  {getStatusBadge(shoot.status || shoot.workflowStatus || 'booked')}
                </div>
              </div>
              
              {/* Schedule Info - Date & Time */}
              <div className="text-xs sm:text-sm text-muted-foreground text-left flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>
                  {shoot.scheduledDate ? format(new Date(shoot.scheduledDate), 'MMM d, yyyy') : 'Not scheduled'}
                  {shoot.time && ` • ${formatTime(shoot.time)}`}
                </span>
              </div>
            </div>
            {(isEditMode || createdByLabel) && (
              <div className="w-full sm:hidden flex flex-col items-end gap-1">
                {isEditMode && (
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
                )}
                {createdByLabel && (
                  <div className="text-xs text-muted-foreground text-right">
                    Created by: {createdByLabel}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Split Pane Layout - Stack on mobile, expandable media */}
        <div className={`flex flex-col sm:flex-row overflow-hidden pb-20 sm:pb-0 ${isMediaExpanded ? 'min-h-[70vh]' : 'min-h-[50vh]'} sm:flex-1 sm:min-h-0`}>
          {/* Left Pane - Full width on mobile, 40% on desktop */}
          <div className={`relative w-full sm:w-[40%] border-r sm:border-r border-b sm:border-b-0 flex flex-col ${isMediaExpanded ? 'min-h-[35vh]' : 'flex-1'} sm:min-h-0 overflow-hidden bg-muted/30 flex-1 sm:flex-none`}>
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

                {isAdmin && (
                  <>
                    <TabsContent value="tours" className="mt-0">
                      <ShootDetailsTourTab
                        shoot={shoot}
                        isAdmin={isAdmin}
                        onShootUpdate={refreshShoot}
                      />
                    </TabsContent>
                    <TabsContent value="settings" className="mt-0">
                      <ShootDetailsSettingsTab
                        shoot={shoot}
                        isAdmin={isAdmin}
                        onShootUpdate={refreshShoot}
                      />
                    </TabsContent>
                  </>
                )}
              </Tabs>
            </div>

            {/* Buttons Section at Bottom */}
            <div className="px-2 sm:px-4 py-1.5 sm:py-2 border-t bg-background flex-shrink-0 space-y-2">
              {/* Client-specific buttons for completed shoots */}
              {isClient && isCompleted && !isEditMode && (
                <div className="flex gap-2 w-full">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-8 text-xs px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
                    onClick={() => setIsDownloadDialogOpen(true)}
                    disabled={isDownloading}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    <span>{isDownloading ? 'Downloading...' : 'Download media'}</span>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-8 text-xs px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-800"
                    onClick={handleSendToBrightMls}
                    disabled={isPublishingToBrightMls}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    <span>{isPublishingToBrightMls ? 'Sending...' : 'Publish to Bright MLS'}</span>
                  </Button>
                </div>
              )}
              <ShootDetailsQuickActions
                shoot={shoot}
                isAdmin={isAdmin}
                isPhotographer={isPhotographer}
                isEditor={isEditor}
                isClient={isClient}
                role={currentUserRole}
                onShootUpdate={refreshShoot}
              />
              {/* Payment Buttons - Mark as Paid and Process Payment (50/50 split) */}
              {(isAdmin || currentUserRole === 'superadmin') && (
                <div className="hidden sm:flex gap-2 w-full">
                  {currentUserRole === 'superadmin' && !((shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0)) && (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 h-8 text-xs px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                          const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-paid`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json',
                              'Accept': 'application/json',
                            },
                          });
                          if (!res.ok) {
                            const errorData = await res.json().catch(() => ({ message: 'Failed to mark as paid' }));
                            throw new Error(errorData.message || 'Failed to mark as paid');
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
                  {isAdmin && (
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

          {/* Right Pane - Full width on mobile, 60% on desktop - Media Tab Always Visible, Expandable */}
          <div className={`w-full sm:w-[60%] flex flex-col ${isMediaExpanded ? 'fixed inset-x-0 bottom-0 top-[7.5rem] sm:relative sm:inset-auto sm:top-auto sm:bottom-auto flex-1' : 'h-auto max-h-[12vh] overflow-hidden'} sm:min-h-0 sm:flex-1 sm:max-h-none transition-all duration-300 flex-1 sm:flex-none bg-background border-t sm:border-t-0 z-40 sm:z-auto shadow-lg sm:shadow-none`}>
            <div className={`flex-1 min-h-0 flex flex-col overflow-hidden px-2 sm:px-3 py-1.5 sm:py-2 ${!isMediaExpanded ? 'overflow-hidden' : ''}`}>
              <ShootDetailsMediaTab
                shoot={shoot}
                isAdmin={isAdmin}
                isPhotographer={isPhotographer}
                isEditor={isEditor}
                isClient={isClient}
                role={currentUserRole}
                onShootUpdate={refreshShoot}
                isExpanded={isMediaExpanded}
                onToggleExpand={() => setIsMediaExpanded(!isMediaExpanded)}
              />
            </div>
          </div>
        </div>
        
        {/* Bottom Overlay Buttons - Mobile only */}
        {isAdmin && (
          <div className="fixed sm:hidden bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 px-3 py-2 space-y-2">
            {/* Admin-only actions */}
            {(shoot?.workflowStatus === 'editing_uploaded' || shoot?.workflowStatus === 'EDITING_UPLOADED' ||
              shoot?.workflowStatus === 'review' || shoot?.workflowStatus === 'in_review' ||
              shoot?.status === 'ready_for_review' || shoot?.status === 'review' || shoot?.status === 'in_review') && (
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
              {currentUserRole === 'superadmin' && !((shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0)) && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-9 text-xs px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-paid`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json',
                          'Accept': 'application/json',
                        },
                      });
                      if (!res.ok) {
                        const errorData = await res.json().catch(() => ({ message: 'Failed to mark as paid' }));
                        throw new Error(errorData.message || 'Failed to mark as paid');
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
              {isAdmin && (
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
          amount={amountDue || 100} // Default to $100 if amountDue is 0
          shootId={shoot.id}
          shootAddress={shoot.location?.fullAddress || shoot.location?.address}
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
    </Dialog>
  );
}

