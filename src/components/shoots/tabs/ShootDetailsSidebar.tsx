import { usePermission } from '@/hooks/usePermission';
import { loadShootAssignees, assigneesForRole } from '@/services/shootAssignees';
import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Phone, Camera, Check, CheckCircle, ChevronDown, FileText, Search, ArrowUpDown, MapPin, Send, CalendarClock } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import type { InvoiceData } from '@/types/invoice';
import { API_BASE_URL } from '@/config/env';
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { getStateFullName } from '@/utils/stateUtils';
import { cn } from '@/lib/utils';
import { getShootPhotographerAssignmentGroups } from '@/utils/shootPhotographerAssignments';
import { serviceAllowsPhotographerAssignment } from '@/utils/photographerAssignment';
import { getVisibleClientContact } from '@/utils/clientContactVisibility';
import { OverviewServiceProgressSection } from './overview/OverviewServiceProgressSection';
import { ManualNotificationDialog } from '@/components/messaging/ManualNotificationDialog';
import { getShootServiceItems, isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';
import { getAdoptedShootSchedule } from '@/utils/shootSchedule';

const LazyInvoiceViewDialog = lazy(() =>
  import('@/components/invoices/InvoiceViewDialog').then((module) => ({
    default: module.InvoiceViewDialog,
  })),
);

interface ShootDetailsSidebarProps {
  shoot: ShootData;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isPhotographer?: boolean;
  isEditor?: boolean;
  isEditingManager?: boolean;
  onMarkPaid: () => void;
  onShootUpdate?: () => void;
  onReschedule?: () => void;
  serviceActions?: React.ReactNode;
}

export function ShootDetailsSidebar({
  shoot,
  isSuperAdmin,
  isAdmin,
  isPhotographer = false,
  isEditor = false,
  isEditingManager = false,
  onMarkPaid,
  onShootUpdate,
  onReschedule,
  serviceActions,
}: ShootDetailsSidebarProps) {
  const { can } = usePermission();
  const canMarkPaid = can('payments', 'mark-paid');
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const visibleClient = getVisibleClientContact({
    client: shoot.client,
    role: isPhotographer
      ? 'photographer'
      : isEditor
        ? 'editor'
        : isAdmin || isSuperAdmin || isEditingManager
          ? 'admin'
          : '',
    shoot,
    shouldHideClientDetails: isEditor,
  });
  
  // Photographer selection state
  const [assignPhotographerOpen, setAssignPhotographerOpen] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string>('');
  const [photographers, setPhotographers] = useState<Array<{ 
    id: string; 
    name: string; 
    email: string;
    avatar?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    distance?: number;
  }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  
  // Manual notification dialog state (Req 12.5-12.8)
  const [isManualNotificationOpen, setIsManualNotificationOpen] = useState(false);

  const client = shoot.client;
  const photographer = shoot.photographer;
  const payment = shoot.payment || {
    baseQuote: 0,
    taxAmount: 0,
    totalQuote: 0,
    totalPaid: 0,
  };
  const photographerAssignments = useMemo(
    () => {
      // Normalized unit bookings retain their canonical rows in serviceItems;
      // serviceObjects can be empty or omit the per-line unit identity.
      const canonicalSource = shoot.serviceItems?.length
        ? shoot.serviceItems
        : shoot.service_items?.length
          ? shoot.service_items
          : shoot.service_lines;
      const serviceObjects = getShootServiceItems({ ...shoot, serviceItems: canonicalSource })
        .filter((item) => !item.isInvoiceAdjustment)
        .map((item) => item.source);
      return getShootPhotographerAssignmentGroups({ ...shoot, serviceObjects });
    },
    [shoot],
  );

  const remainingBalance = Math.max((payment.totalQuote || 0) - (payment.totalPaid || 0), 0);
  const isPaid = remainingBalance <= 0.01;
  const canShowBilling = (isAdmin || isSuperAdmin) && !isEditor && !isEditingManager;
  const canNotify = ((isAdmin || isSuperAdmin) && !isEditor) || isEditingManager;
  const serviceAssignments = photographerAssignments.assignments.filter(
    (assignment) => !isInvoiceAdjustmentServiceItem(assignment.raw),
  );
  const schedule = getAdoptedShootSchedule(shoot);
  const scheduleDate = schedule.date ? new Date(`${schedule.date}T12:00:00`) : null;
  const scheduleTime = schedule.time ? new Date(`2000-01-01T${schedule.time}:00`) : null;
  const scheduleLabel = [
    scheduleDate && !Number.isNaN(scheduleDate.getTime())
      ? scheduleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '',
    scheduleTime && !Number.isNaN(scheduleTime.getTime())
      ? scheduleTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '',
  ].filter(Boolean).join(' · ');

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  // Get shoot location for distance calculation
  const getShootLocation = () => {
    const address = shoot.location?.address || (shoot as any).address || '';
    const city = shoot.location?.city || (shoot as any).city || '';
    const state = shoot.location?.state || (shoot as any).state || '';
    const zip = shoot.location?.zip || (shoot as any).zip || '';
    return { address, city, state, zip };
  };

  // Fetch photographers for assignment
  useEffect(() => {
    if (!assignPhotographerOpen || !isAdmin) return;
    
    const fetchPhotographers = async () => {
      try {
        const choices = assigneesForRole(await loadShootAssignees(), 'photographer');
        const photographersList = choices.map((p) => ({
            id: String(p.id),
            name: p.name,
            email: p.email,
            avatar: p.avatar,
            address: p.address || p.metadata?.address || p.metadata?.homeAddress,
            city: p.city || p.metadata?.city,
            state: p.state || p.metadata?.state,
            zip: p.zip || p.zipcode || p.metadata?.zip || p.metadata?.zipcode,
          }));
        setPhotographers(photographersList);
      } catch (error) {
        console.error('Error fetching photographers:', error);
      }
    };
    
    fetchPhotographers();
  }, [assignPhotographerOpen, isAdmin]);

  // Calculate distances when dialog opens and shoot location/photographers are available
  useEffect(() => {
    const calculateDistances = async () => {
      if (!assignPhotographerOpen || photographers.length === 0) return;
      
      const shootLocation = getShootLocation();
      if (!shootLocation.address || !shootLocation.city || !shootLocation.state) {
        return; // Can't calculate without location
      }

      setIsCalculatingDistances(true);
      try {
        // Get coordinates for shoot location
        const shootCoords = await getCoordinatesFromAddress(
          shootLocation.address,
          shootLocation.city,
          shootLocation.state,
          shootLocation.zip
        );
        
        if (!shootCoords) {
          setIsCalculatingDistances(false);
          return;
        }

        // Calculate distance for each photographer
        const photographersWithDist = await Promise.all(
          photographers.map(async (photographer) => {
            if (!photographer.address || !photographer.city || !photographer.state) {
              return { ...photographer, distance: undefined };
            }

            const photographerCoords = await getCoordinatesFromAddress(
              photographer.address,
              photographer.city,
              photographer.state,
              photographer.zip
            );

            if (!photographerCoords) {
              return { ...photographer, distance: undefined };
            }

            const dist = calculateDistance(
              shootCoords.lat,
              shootCoords.lon,
              photographerCoords.lat,
              photographerCoords.lon
            );

            return {
              ...photographer,
              distance: Math.round(dist * 10) / 10, // Round to 1 decimal
            };
          })
        );

        setPhotographers(photographersWithDist);
      } catch (error) {
        console.error('Error calculating distances:', error);
      } finally {
        setIsCalculatingDistances(false);
      }
    };

    calculateDistances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignPhotographerOpen, photographers.length]);

  // Filter and sort photographers
  const filteredAndSortedPhotographers = useMemo(() => {
    let filtered = photographers;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.city?.toLowerCase().includes(query) ||
        p.state?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'distance') {
        // Sort by distance (undefined distances go to end)
        if (a.distance === undefined && b.distance === undefined) return 0;
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      } else {
        // Sort by name
        return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [photographers, searchQuery, sortBy]);

  // Assign photographer
  const handleAssignPhotographer = async () => {
    if (!selectedPhotographerId) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ photographer_id: selectedPhotographerId }),
      });
      
      if (!res.ok) throw new Error('Failed to assign photographer');
      
      toast({
        title: 'Success',
        description: 'Photographer assigned successfully',
      });
      
      setAssignPhotographerOpen(false);
      setSearchQuery('');
      setSelectedPhotographerId('');
      
      if (onShootUpdate) {
        onShootUpdate();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign photographer',
        variant: 'destructive',
      });
    }
  };

  const handleShowInvoice = async () => {
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
      const dueDate = invoiceData.due_date || invoiceData.dueDate || new Date().toISOString();
      const firstAttachedShootClient = Array.isArray(invoiceData.shoots)
        ? invoiceData.shoots.find((entry: any) => entry?.client)?.client ?? null
        : null;
      // Central rule: only treat an invoice as unpaid/overdue when it has an outstanding balance > 0.
      // A $0.00 invoice (or zero remaining balance) is always settled.
      const invoiceTotal = Number(invoiceData.total ?? invoiceData.total_amount ?? invoiceData.amount ?? 0) || 0;
      const invoicePaid = Number(invoiceData.amount_paid ?? invoiceData.paid_amount ?? 0) || 0;
      const invoiceBalance = Number(
        invoiceData.balance_due ?? invoiceData.balanceDue ?? (invoiceTotal - invoicePaid),
      );
      const hasOutstandingBalance = invoiceTotal > 0.01 && invoiceBalance > 0.01;
      const isPaid = !hasOutstandingBalance || Boolean(invoiceData.is_paid) || String(invoiceData.status || '').toLowerCase() === 'paid';
      const isOverdue = hasOutstandingBalance && !isPaid && Boolean(dueDate) && new Date(dueDate) < new Date();

      // Convert API response to InvoiceData format
      const invoice: InvoiceData = {
        id: invoiceData.id?.toString() || '',
        number: invoiceData.invoice_number || invoiceData.number || `Invoice ${invoiceData.id}`,
        client: typeof invoiceData.client === 'string' 
          ? invoiceData.client 
          : invoiceData.client?.name || invoiceData.shoot?.client?.name || 'Unknown Client',
        clientProfile: invoiceData.clientProfile
          || invoiceData.client_profile
          || (typeof invoiceData.client === 'object' ? invoiceData.client : null)
          || invoiceData.shoot?.client
          || firstAttachedShootClient
          || null,
        property: invoiceData.shoot?.location?.fullAddress 
          || invoiceData.shoot?.address 
          || invoiceData.property 
          || 'N/A',
        date: invoiceData.issue_date || invoiceData.date || new Date().toISOString(),
        dueDate,
        amount: invoiceData.total ?? invoiceData.amount ?? 0,
        status: isPaid ? 'paid' : (isOverdue ? 'overdue' : 'pending'),
        services: invoiceData.items?.map((item: any) => item.description) || invoiceData.services || [],
        items: invoiceData.items || [],
        subtotal: invoiceData.subtotal ?? invoiceData.total ?? invoiceData.amount ?? 0,
        pricingBreakdown: invoiceData.pricing_breakdown ?? invoiceData.pricingBreakdown ?? null,
        tax: invoiceData.tax || 0,
        total: invoiceData.total ?? invoiceData.amount ?? 0,
        shoot: invoiceData.shoot,
        shoots: invoiceData.shoots,
        paymentMethod: invoiceData.payment_method || invoiceData.paymentMethod || 'N/A',
        paymentDetails: invoiceData.payment_details || invoiceData.paymentDetails || undefined,
        paidAt: invoiceData.paid_at || invoiceData.paidAt || undefined,
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

  return (
    <aside
      aria-label="Shoot record"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5">
        <h2 className="text-sm font-semibold tracking-tight">Shoot record</h2>
        <span className="text-xs text-muted-foreground">#{shoot.id}</span>
      </div>

      {visibleClient.canShowName && (
        <section aria-label="Client" className="space-y-3 px-5 py-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Client
          </h3>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {visibleClient.name ? (
                <span className="text-xs font-semibold">
                  {visibleClient.name.split(' ').map((name) => name[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              ) : (
                <User className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{visibleClient.name || 'Unknown'}</p>
              {visibleClient.canShowEmail && client?.company && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{client.company}</p>
              )}
            </div>
          </div>
          {(visibleClient.email || visibleClient.phone) && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Contact details
                <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-1 pt-2">
                {visibleClient.email && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto min-h-8 w-full justify-start gap-2 px-0 text-xs"
                    onClick={() => handleEmail(visibleClient.email!)}
                  >
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="break-all text-left">{visibleClient.email}</span>
                  </Button>
                )}
                {visibleClient.phone && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto min-h-8 w-full justify-start gap-2 px-0 text-xs"
                    onClick={() => handleCall(visibleClient.phone!)}
                  >
                    <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                    <span>{visibleClient.phone}</span>
                  </Button>
                )}
              </div>
            </details>
          )}
        </section>
      )}

      <section aria-label="Services and team" className="space-y-3 border-t border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Services &amp; team
          </h3>
          {isAdmin && (serviceAssignments.length
            ? serviceAssignments.some(assignment => {
              const raw = assignment.raw as Record<string, unknown>;
              return serviceAllowsPhotographerAssignment({ name: assignment.serviceName, category: raw.category,
                photographer_required: raw.photographer_required !== false });
            }) : photographer?.id) && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Change Photographer"
              title="Change Photographer"
              className="h-auto shrink-0 px-0 py-1 text-xs text-primary hover:bg-transparent"
              onClick={() => setAssignPhotographerOpen(true)}
            >
              Manage
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {serviceAssignments.length > 0 ? serviceAssignments.map((assignment, index) => {
            const raw = assignment.raw as Record<string, unknown>;
            const workflowStatus = String(raw.workflow_status ?? raw.workflowStatus ?? '').toLowerCase();
            const deliveryStatus = String(raw.delivery_status ?? raw.deliveryStatus ?? '').toLowerCase();
            const isDelivered = deliveryStatus
              ? deliveryStatus === 'delivered'
              : workflowStatus === 'delivered';
            const embeddedUnit = raw.unit && typeof raw.unit === 'object'
              ? raw.unit as Record<string, unknown>
              : undefined;
            const unitId = raw.shoot_unit_id ?? raw.shootUnitId ?? embeddedUnit?.id;
            const unitKey = raw.unit_client_key ?? embeddedUnit?.client_key;
            const shootUnit = shoot.units?.find((unit) => (
              unitId != null && String(unit.id) === String(unitId)
            ) || (unitKey != null && unit.client_key === String(unitKey)));
            const unitLabel = [raw.unit_label, embeddedUnit?.label, shootUnit?.label]
              .find((label): label is string => typeof label === 'string' && Boolean(label.trim()));
            return (
              <div key={`${assignment.serviceId ?? assignment.serviceName}-${index}`} className="flex items-start gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Camera aria-hidden="true" className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-5">{assignment.serviceName}</p>
                  {unitLabel && <p className="text-[11px] leading-4 text-muted-foreground">{unitLabel}</p>}
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    {assignment.photographer?.name || (!serviceAllowsPhotographerAssignment({ name: assignment.serviceName,
                      category: raw.category, photographer_required: raw.photographer_required !== false })
                      ? (typeof raw.editor === 'object' && raw.editor && 'name' in raw.editor ? `Editor: ${String(raw.editor.name)}` : 'No photographer required')
                      : 'Not assigned')}
                  </p>
                </div>
                {isDelivered && (
                  <span className="mt-2 shrink-0 text-emerald-600 dark:text-emerald-400" title="Delivered">
                    <Check aria-label="Delivered" className="size-3.5" />
                  </span>
                )}
              </div>
            );
          }) : (
            <>
              {(shoot.services || []).map((service, index) => (
                <p key={`${service}-${index}`} className="text-xs font-medium leading-5">{service}</p>
              ))}
              {photographer && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Camera aria-hidden="true" className="size-3.5 shrink-0" />
                  <span>{photographer.name}</span>
                </div>
              )}
              {!shoot.services?.length && !photographer && (
                <p className="text-xs text-muted-foreground">No services assigned</p>
              )}
            </>
          )}
        </div>
        {serviceActions && <div className="flex flex-wrap items-center gap-2 pt-1">{serviceActions}</div>}
        {canShowBilling && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Service progress
              <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="pt-2">
              <OverviewServiceProgressSection shoot={shoot} compact />
            </div>
          </details>
        )}
      </section>

      {canShowBilling && (
        <section aria-label="Billing" className="space-y-3 border-t border-border px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Billing</h3>
            <span className={cn(
              'rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              isPaid
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
            )}>
              {isPaid ? 'Paid' : 'Outstanding'}
            </span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              ${payment.totalQuote?.toFixed(2) || '0.00'}
            </p>
            <p className="pb-1 text-[11px] text-muted-foreground">
              {isPaid ? 'Paid in full' : `$${remainingBalance.toFixed(2)} due`}
            </p>
          </div>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Billing details
              <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 pt-3">
              <dl className="space-y-2 text-xs tabular-nums">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Base</dt><dd>${payment.baseQuote?.toFixed(2) || '0.00'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Tax</dt><dd>${payment.taxAmount?.toFixed(2) || '0.00'}</dd></div>
                <Separator />
                <div className="flex justify-between gap-3 font-semibold"><dt>Total</dt><dd>${payment.totalQuote?.toFixed(2) || '0.00'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Paid</dt><dd className="text-emerald-700 dark:text-emerald-400">${payment.totalPaid?.toFixed(2) || '0.00'}</dd></div>
                <div className="flex justify-between gap-3 font-semibold"><dt>Outstanding</dt><dd className={isPaid ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>${remainingBalance.toFixed(2)}</dd></div>
              </dl>
              {canMarkPaid && !isPaid && (
                <Button variant="default" size="sm" className="h-8 w-full gap-1.5 text-xs" onClick={onMarkPaid}>
                  <CheckCircle className="size-3.5" />
                  Mark as Paid
                </Button>
              )}
              {isPaid && (
                <Button variant="outline" size="sm" className="h-8 w-full gap-1.5 text-xs" onClick={handleShowInvoice} disabled={isLoadingInvoice}>
                  {isLoadingInvoice ? <Loader2 aria-hidden="true" className="size-3.5" /> : <FileText className="size-3.5" />}
                  {isLoadingInvoice ? 'Loading...' : 'Show Invoice'}
                </Button>
              )}
            </div>
          </details>
        </section>
      )}

      {(scheduleLabel || onReschedule) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-5 py-3">
          {scheduleLabel && (
            <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <CalendarClock aria-hidden="true" className="size-3.5 shrink-0" />
              <span>{scheduleLabel}</span>
            </div>
          )}
          {onReschedule && (
            <Button variant="ghost" size="sm" className="h-auto px-0 py-1 text-xs text-primary hover:bg-transparent" onClick={onReschedule}>
              Reschedule
            </Button>
          )}
        </div>
      )}

      {canNotify && (
        <details className="group border-t border-border px-5 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            Additional actions
            <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 pt-3">
            <p className="text-xs leading-5 text-muted-foreground">Send a manual email or SMS for this shoot.</p>
            <Button type="button" variant="outline" size="sm" className="h-8 w-full gap-1.5 text-xs" onClick={() => setIsManualNotificationOpen(true)}>
              <Send className="size-3.5" />
              Notify
            </Button>
          </div>
        </details>
      )}

      {canNotify && (
        <ManualNotificationDialog
          shootId={Number(shoot.id)}
          shootLabel={shoot.location?.fullAddress || shoot.location?.address || `#${shoot.id}`}
          open={isManualNotificationOpen}
          onClose={() => setIsManualNotificationOpen(false)}
        />
      )}

      {isInvoiceDialogOpen && selectedInvoice && (
        <Suspense fallback={null}>
          <LazyInvoiceViewDialog
            isOpen={isInvoiceDialogOpen}
            onClose={() => {
              setIsInvoiceDialogOpen(false);
              setSelectedInvoice(null);
            }}
            invoice={selectedInvoice}
          />
        </Suspense>
      )}

      {/* Assign Photographer Dialog - Matching Book Shoot selector */}
      <Dialog open={assignPhotographerOpen} onOpenChange={(open) => {
        setAssignPhotographerOpen(open);
        if (!open) {
          setSearchQuery('');
          setSelectedPhotographerId('');
        }
      }}>
        <DialogContent className="sm:max-w-md w-full">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <DialogHeader>
                  <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">Select Photographer</DialogTitle>
                  <DialogDescription>
                    Choose a photographer to assign to this shoot
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>

            {/* Search and Sort Controls */}
            <div className="space-y-3 mb-4">
              {/* Search Field */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search photographers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(value: 'distance' | 'name') => setSortBy(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">Sort by Distance</SelectItem>
                    <SelectItem value="name">Sort by Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {/* Scrollable content area */}
              <div className="pt-3 max-h-[48vh] overflow-y-auto pr-2">
                {isCalculatingDistances ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Calculating distances...</span>
                  </div>
                ) : filteredAndSortedPhotographers.length > 0 ? (
                  <div className="grid gap-3">
                    {filteredAndSortedPhotographers.map((photographerItem) => (
                      <div
                        key={photographerItem.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={photographerItem.avatar} alt={photographerItem.name} />
                            <AvatarFallback>{photographerItem.name?.charAt(0)}</AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {photographerItem.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              {photographerItem.distance !== undefined ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {photographerItem.distance} mi away
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Distance unavailable</span>
                              )}
                              {photographerItem.city && photographerItem.state && (
                                <span className="text-muted-foreground">
                                  • {photographerItem.city}, {getStateFullName(photographerItem.state)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotographerId(photographerItem.id);
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors",
                              selectedPhotographerId === photographerItem.id
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600"
                            )}
                          >
                            {selectedPhotographerId === photographerItem.id ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                    {searchQuery ? 'No photographers found matching your search.' : 'No photographers available.'}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={() => {
                    setAssignPhotographerOpen(false);
                    setSearchQuery('');
                    setSelectedPhotographerId('');
                  }} className="w-full">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedPhotographerId) {
                        toast({
                          title: "No photographer selected",
                          description: "Please select a photographer before continuing.",
                          variant: "destructive",
                        });
                        return;
                      }
                      handleAssignPhotographer();
                    }}
                    className="w-full"
                    disabled={!selectedPhotographerId}
                  >
                    Assign
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
