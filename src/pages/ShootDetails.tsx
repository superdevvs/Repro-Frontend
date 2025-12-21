import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '@/services/api';
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
import { useAuth } from '@/components/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { ShootData } from '@/types/shoots';
import { getStateFullName } from '@/utils/stateUtils';
import { format } from 'date-fns';
import { API_BASE_URL } from '@/config/env';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

// Import tab components
import { ShootDetailsMediaTab } from '@/components/shoots/tabs/ShootDetailsMediaTab';
import { ShootDetailsNotesTab } from '@/components/shoots/tabs/ShootDetailsNotesTab';
import { ShootDetailsSettingsTab } from '@/components/shoots/tabs/ShootDetailsSettingsTab';
import { ShootDetailsQuickActions } from '@/components/shoots/tabs/ShootDetailsQuickActions';
import { ShootDetailsTourTab } from '@/components/shoots/tabs/ShootDetailsTourTab';
import { ShootDetailsSlideshowTab } from '@/components/shoots/tabs/ShootDetailsSlideshowTab';
import { ShootDetailsActivityLogTab } from '@/components/shoots/tabs/ShootDetailsActivityLogTab';
import { ShootDetailsSidebar } from '@/components/shoots/tabs/ShootDetailsSidebar';
import { AddServiceDialog } from '@/components/shoots/AddServiceDialog';
import { SquarePaymentDialog } from '@/components/payments/SquarePaymentDialog';

const statusBadgeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  booked: { label: 'Scheduled', variant: 'secondary' },
  scheduled: { label: 'Scheduled', variant: 'default' },
  raw_upload_pending: { label: 'Awaiting RAW', variant: 'outline' },
  raw_uploaded: { label: 'RAW Uploaded', variant: 'default' },
  raw_issue: { label: 'RAW Issue', variant: 'destructive' },
  editing: { label: 'Editing', variant: 'secondary' },
  editing_uploaded: { label: 'Editing Uploaded', variant: 'default' },
  editing_issue: { label: 'Editing Issue', variant: 'destructive' },
  ready_for_client: { label: 'Ready for Client', variant: 'default' },
  completed: { label: 'Completed', variant: 'default' },
  on_hold: { label: 'On Hold', variant: 'destructive' },
};

const paymentBadgeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  paid: { label: 'Paid', variant: 'default' },
  unpaid: { label: 'Unpaid', variant: 'destructive' },
  partial: { label: 'Partial', variant: 'secondary' },
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
  const { user } = useAuth();
  const { formatTemperature, formatTime, formatDate } = useUserPreferences();
  const role = user?.role || 'client';
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin' || isSuperAdmin;
  const isAdminOrSuperAdmin = isAdmin; // Both admin and superadmin can access payments
  const isRep = role === 'salesRep';
  const isAdminOrRep = isAdmin || isRep;
  const isEditor = role === 'editor';
  const isPhotographer = role === 'photographer';
  const isClient = role === 'client';
  
  const [shoot, setShoot] = useState<ShootData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('media');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isOnHoldDialogOpen, setIsOnHoldDialogOpen] = useState(false);
  const [onHoldReason, setOnHoldReason] = useState('');

  const loadShoot = async () => {
    if (!id) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      
      if (!res.ok) throw new Error('Failed to fetch shoot');
      
      const json = await res.json();
      let shootData = json.data || json;
      
      // Normalize the data structure
      if (shootData) {
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
      }
      
      setShoot(shootData);
    } catch (error: any) {
      console.error('Error fetching shoot details:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to fetch shoot details';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      setShoot(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShoot();
  }, [id]);

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
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/send-to-editing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
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

  const handleMarkComplete = async () => {
    if (!shoot) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ status: 'completed', workflowStatus: 'completed' }),
      });
      
      if (!res.ok) throw new Error('Failed to mark complete');
      
      toast({
        title: 'Success',
        description: 'Shoot marked as complete',
      });
      loadShoot();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark complete',
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

  // Check if user can put shoot on hold
  const canUserPutOnHold = (isAdminOrRep || (isPhotographer && shoot?.photographer?.id === user?.id)) && canPutOnHold;

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
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/put-on-hold`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ reason: onHoldReason.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to put shoot on hold');
      }

      toast({
        title: 'Shoot put on hold',
        description: 'The shoot has been successfully marked as on hold.',
      });

      setIsOnHoldDialogOpen(false);
      setOnHoldReason('');
      loadShoot(); // Reload shoot data
    } catch (error) {
      console.error('Error putting shoot on hold:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to put shoot on hold. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const amountDue = shoot ? (shoot.payment?.totalQuote || 0) - (shoot.payment?.totalPaid || 0) : 0;

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

  const workflowBadge = statusBadgeMap[shoot?.workflowStatus || shoot?.status || ''];
  
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
    <DashboardLayout>
      <PageTransition>
        <div className="flex flex-col min-h-screen bg-background">
          {/* Tiered Header - Multi-layer hierarchy */}
          <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
            {/* Top Bar - Breadcrumb & Navigation */}
            <div className="px-3 sm:px-6 py-2 border-b bg-muted/30">
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
            <div className="px-3 sm:px-6 py-3 sm:py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 w-full sm:w-auto">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate flex-1">
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
                  {canUserPutOnHold && (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto"
                      onClick={() => setIsOnHoldDialogOpen(true)}
                    >
                      <PauseCircle className="h-3 w-3 mr-1.5" />
                      <span className="hidden sm:inline">Mark as On Hold</span>
                      <span className="sm:hidden">On Hold</span>
                    </Button>
                  )}
                  {isAdmin && (
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
                        onClick={handleMarkComplete}
                      >
                        <CheckCircle className="h-3 w-3 mr-1.5" />
                        <span className="hidden sm:inline">Mark Complete</span>
                        <span className="sm:hidden">Complete</span>
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
                </div>
              </div>
            </div>

            {/* Meta Bar - Status Badges */}
            <div className="px-3 sm:px-6 py-2 sm:py-3 border-t bg-muted/20">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {workflowBadge && (
                  <Badge variant={workflowBadge.variant} className="text-xs px-2.5 py-1">
                    {workflowBadge.label}
                  </Badge>
                )}
                {isAdminOrSuperAdmin && paymentBadge && (
                  <Badge variant={paymentBadge.variant} className="text-xs px-2.5 py-1">
                    {paymentBadge.label}
                  </Badge>
                )}
                {shoot.photographer?.name && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Camera className="h-3.5 w-3.5" />
                    <span className="font-medium truncate">{shoot.photographer.name}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-xs hidden sm:inline">Online</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Premium Summary Card */}
          <div className="px-3 sm:px-6 py-4 sm:py-6">
            <Card className="border-2 shadow-lg bg-gradient-to-br from-background via-background to-muted/20 hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 flex-1 w-full sm:w-auto">
                    {/* Service Card */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">Service</p>
                        <p className="font-semibold text-sm sm:text-base truncate">
                          {shoot.services?.join(', ') || 'No services'}
                        </p>
                      </div>
                    </div>

                    <Separator orientation="vertical" className="hidden sm:block h-12" />
                    <Separator orientation="horizontal" className="sm:hidden w-full" />

                    {/* Client Card */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-muted flex items-center justify-center border-2 border-background flex-shrink-0">
                        {shoot.client?.name ? (
                          <span className="text-xs sm:text-sm font-semibold">
                            {shoot.client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        ) : (
                          <User className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">Client</p>
                        <p className="font-semibold text-sm sm:text-base truncate">{shoot.client?.name || 'Unknown'}</p>
                        {shoot.client?.company && (
                          <p className="text-xs text-muted-foreground truncate">{shoot.client.company}</p>
                        )}
                      </div>
                    </div>

                    {shoot.photographer?.name && (
                      <>
                        <Separator orientation="vertical" className="hidden sm:block h-12" />
                        <Separator orientation="horizontal" className="sm:hidden w-full" />
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-muted flex items-center justify-center border-2 border-background flex-shrink-0">
                            <Camera className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground mb-1">Photographer</p>
                            <p className="font-semibold text-sm sm:text-base truncate">{shoot.photographer.name}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Quick Actions - Stack on mobile */}
                  {isAdmin && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      <AddServiceDialog shoot={shoot} onShootUpdate={loadShoot} />
                      <Button variant="outline" size="sm" className="text-xs w-full sm:w-auto">
                        Assign Photographer
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs w-full sm:w-auto">
                        Reschedule
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area with Tabs and Sidebar */}
          <div className="flex-1 flex min-h-0">
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Enhanced Tab Bar - Raised Surface with Shadow */}
              <div className="sticky top-[140px] sm:top-[200px] z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b shadow-sm">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full justify-start h-12 sm:h-14 px-3 sm:px-6 bg-transparent gap-1 overflow-x-auto">
                    <TabsTrigger 
                      value="media" 
                      className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    >
                      Media
                    </TabsTrigger>
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
                    <TabsTrigger 
                      value="quick-actions" 
                      className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    >
                      <span className="hidden sm:inline">Quick Actions</span>
                      <span className="sm:hidden">Actions</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="activity" 
                      className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    >
                      <span className="hidden sm:inline">Activity Log</span>
                      <span className="sm:hidden">Activity</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="notes" 
                      className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    >
                      Notes
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsContent value="media" className="mt-0">
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

                  <TabsContent value="tour" className="mt-0">
                    <ShootDetailsTourTab
                      shoot={shoot}
                      isAdmin={isAdmin}
                      onShootUpdate={loadShoot}
                    />
                  </TabsContent>

                  <TabsContent value="slideshow" className="mt-0">
                    <ShootDetailsSlideshowTab
                      shoot={shoot}
                      isAdmin={isAdmin}
                      onShootUpdate={loadShoot}
                    />
                  </TabsContent>

                  <TabsContent value="settings" className="mt-0">
                    <ShootDetailsSettingsTab
                      shoot={shoot}
                      isAdmin={isAdmin}
                      onShootUpdate={loadShoot}
                    />
                  </TabsContent>

                  <TabsContent value="quick-actions" className="mt-0">
                    <ShootDetailsQuickActions
                      shoot={shoot}
                      isAdmin={isAdmin}
                      isPhotographer={isPhotographer}
                      isEditor={isEditor}
                      isClient={isClient}
                      role={role}
                      onShootUpdate={loadShoot}
                    />
                  </TabsContent>

                  <TabsContent value="activity" className="mt-0">
                    <ShootDetailsActivityLogTab
                      shoot={shoot}
                      isAdmin={isAdmin}
                      onShootUpdate={loadShoot}
                    />
                  </TabsContent>

                  <TabsContent value="notes" className="mt-0">
                    <ShootDetailsNotesTab
                      shoot={shoot}
                      isAdmin={isAdmin}
                      isPhotographer={isPhotographer}
                      isEditor={isEditor}
                      role={role}
                      onShootUpdate={loadShoot}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Right Sidebar - Shoot Insights Panel */}
            <div className="hidden lg:block flex-shrink-0">
              <ShootDetailsSidebar
                shoot={shoot}
                isSuperAdmin={isSuperAdmin}
                isAdmin={isAdmin}
                onProcessPayment={handleProcessPayment}
                onMarkPaid={() => {
                  toast({ title: 'Marked as Paid', description: 'Payment status updated' });
                  loadShoot();
                }}
              />
            </div>
          </div>
        </div>
      </PageTransition>

      {shoot && (
        <>
          <SquarePaymentDialog
            isOpen={isPaymentDialogOpen}
            onClose={() => setIsPaymentDialogOpen(false)}
            amount={amountDue}
            shootId={shoot.id}
            shootAddress={shoot.location?.fullAddress || shoot.location?.address}
            onPaymentSuccess={handlePaymentSuccess}
          />

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
        </>
      )}
    </DashboardLayout>
  );
};

export default ShootDetails;
