import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Check, Loader2, MapPin, User, Camera, Clock, DollarSign, FileText, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';

interface Photographer {
  id: string | number;
  name: string;
  avatar?: string;
}

interface ShootDetails {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  client?: { id: number; name: string; email?: string };
  services?: Array<{ id: number; name?: string; label?: string; price?: number } | string>;
  scheduledAt?: string;
  totalQuote?: number;
  shootNotes?: string;
  photographerNotes?: string;
  companyNotes?: string;
  location?: { address?: string; city?: string; state?: string; zip?: string };
  photographer?: { id?: string | number; name?: string };
  time?: string;
  financials?: { totalQuote?: number };
  notes?: {
    shoot?: string;
    photographer?: string;
    company?: string;
  };
}

interface ShootApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  shootId: string | number;
  shootAddress?: string;
  currentScheduledAt?: string | Date | null;
  onApproved?: () => void;
  photographers?: Photographer[];
}

export function ShootApprovalModal({
  isOpen,
  onClose,
  shootId,
  shootAddress,
  currentScheduledAt,
  onApproved,
  photographers = [],
}: ShootApprovalModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shootDetails, setShootDetails] = useState<ShootDetails | null>(null);
  const [photographerId, setPhotographerId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [notes, setNotes] = useState('');

  const normalizeTimeValue = (raw?: string | null): string | null => {
    if (!raw) return null;
    const value = raw.trim();
    if (!value) return null;

    const ampmMatch = value.match(/^(\d{1,2}):(\d{2})\s*([APap][Mm])$/);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = parseInt(ampmMatch[2], 10);
      const suffix = ampmMatch[3].toLowerCase();
      if (suffix === 'pm' && hours !== 12) hours += 12;
      if (suffix === 'am' && hours === 12) hours = 0;
      if (minutes >= 0 && minutes < 60 && hours >= 0 && hours < 24) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    const hhmmMatch = value.match(/^(\d{1,2}):(\d{2})(:\d{2})?$/);
    if (hhmmMatch) {
      const hours = parseInt(hhmmMatch[1], 10);
      const minutes = parseInt(hhmmMatch[2], 10);
      if (minutes >= 0 && minutes < 60 && hours >= 0 && hours < 24) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    return null;
  };

  const resolveScheduledDate = (shoot: any) => {
    const scheduledDate = shoot?.scheduled_date || shoot?.scheduledDate;
    if (scheduledDate) {
      // Handle ISO date format (e.g., "2026-01-25T00:00:00.000000Z")
      // Extract just the date part and create date at noon local time
      const dateOnly = typeof scheduledDate === 'string' 
        ? scheduledDate.split('T')[0] 
        : scheduledDate;
      const date = new Date(`${dateOnly}T12:00:00`);
      if (!isNaN(date.getTime())) return date;
    }

    // Fallback to scheduled_at only if scheduled_date is not available
    // NOTE: scheduled_at may be stale if only scheduled_date was updated
    const scheduledIso = shoot?.start_time || shoot?.scheduled_at || shoot?.scheduledAt;
    if (scheduledIso) {
      const date = new Date(scheduledIso);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  };

  const buildTimeOptions = React.useCallback(
    (ensure?: string | null) => {
      const options: { value: string; label: string }[] = [];
      for (let h = 5; h < 23; h++) {
        for (const m of ['00', '30']) {
          const hour = h.toString().padStart(2, '0');
          const period = h >= 12 ? 'PM' : 'AM';
          const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
          options.push({
            value: `${hour}:${m}`,
            label: `${displayHour}:${m} ${period}`,
          });
        }
      }
      if (ensure && !options.find((o) => o.value === ensure)) {
        const [h, m] = ensure.split(':').map((v) => parseInt(v, 10));
        if (!Number.isNaN(h) && !Number.isNaN(m)) {
          const period = h >= 12 ? 'PM' : 'AM';
          const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
          options.push({
            value: ensure,
            label: `${displayHour}:${m.toString().padStart(2, '0')} ${period}`,
          });
          options.sort((a, b) => a.value.localeCompare(b.value));
        }
      }
      return options;
    },
    [],
  );

  // Reset state and fetch fresh shoot details when modal opens
  useEffect(() => {
    if (!isOpen || !shootId) return;
    
    // Reset state FIRST to clear any stale data
    setScheduledDate(undefined);
    setScheduledTime('10:00');
    setPhotographerId('');
    setNotes('');
    setShootDetails(null);
    setIsLoading(true);
    
    const fetchShootDetails = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        // Add cache-busting to ensure fresh data
        const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}?_t=${Date.now()}`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const shoot = data.data || data;
          console.log('🔍 ShootApprovalModal - API Response:', {
            shootId,
            scheduled_date: shoot.scheduled_date,
            scheduledDate: shoot.scheduledDate,
            time: shoot.time,
            rawShoot: shoot,
          });
          setShootDetails(shoot);
          
          // Initialize date/time from fetched data
          const resolvedDate = resolveScheduledDate(shoot);
          console.log('🔍 ShootApprovalModal - Resolved date:', resolvedDate);
          if (resolvedDate) {
            setScheduledDate(resolvedDate);
          }

          const normalizedTime =
            normalizeTimeValue(
              shoot.time_label ||
                shoot.timeLabel ||
                shoot.time ||
                shoot.scheduled_time ||
                shoot.scheduledTime
            ) || null;

          if (normalizedTime) {
            setScheduledTime(normalizedTime);
            setTimeOptions(buildTimeOptions(normalizedTime));
          }

          // Preselect photographer if provided by the request
          const resolvedPhotographerId =
            shoot.photographer?.id || shoot.photographer_id || shoot.photographerId;
          if (resolvedPhotographerId) {
            setPhotographerId(String(resolvedPhotographerId));
          }
        }
      } catch (error) {
        console.error('Error fetching shoot details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchShootDetails();
  }, [isOpen, shootId]);

  const handleApprove = async () => {
    if (!scheduledDate) {
      toast({
        title: 'Date required',
        description: 'Please select a scheduled date for the shoot.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      // Combine date and time
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const scheduledAt = new Date(scheduledDate);
      scheduledAt.setHours(hours, minutes, 0, 0);

      const payload: Record<string, unknown> = {
        scheduled_at: scheduledAt.toISOString(),
      };

      if (photographerId && photographerId !== 'unassigned') {
        payload.photographer_id = photographerId;
      }

      if (notes.trim()) {
        payload.notes = notes.trim();
      }

      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/approve`, {
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
        throw new Error(error.message || 'Failed to approve shoot');
      }

      toast({
        title: 'Shoot approved',
        description: 'The shoot request has been approved and scheduled.',
      });

      onApproved?.();
      onClose();
    } catch (error) {
      console.error('Error approving shoot:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve shoot. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [timeOptions, setTimeOptions] = useState<{ value: string; label: string }[]>(buildTimeOptions(scheduledTime));

  // Get display values
  const displayAddress = shootDetails?.address || shootDetails?.location?.address || shootAddress || '';
  const displayCity = shootDetails?.city || shootDetails?.location?.city || '';
  const displayState = shootDetails?.state || shootDetails?.location?.state || '';
  const displayZip = shootDetails?.zip || shootDetails?.location?.zip || '';
  const fullLocation = [displayCity, displayState, displayZip].filter(Boolean).join(', ');
  const clientName = shootDetails?.client?.name || 'Unknown Client';
  const clientEmail = shootDetails?.client?.email || '';
  const services = shootDetails?.services || [];
  const servicePriceTotal =
    Array.isArray(services) && services.length
      ? services.reduce((sum, svc: any) => {
          const price = typeof svc === 'object' ? Number(svc.price ?? 0) : 0;
          return sum + (Number.isFinite(price) ? price : 0);
        }, 0)
      : 0;
  const totalQuote =
    shootDetails?.totalQuote ??
    (shootDetails as any)?.payment?.totalQuote ??
    shootDetails?.financials?.totalQuote ??
    servicePriceTotal;
  const shootNotes =
    shootDetails?.shootNotes ||
    (shootDetails as any)?.shoot_notes ||
    shootDetails?.notes?.shoot ||
    '';
  const photographerNotes =
    shootDetails?.photographerNotes ||
    (shootDetails as any)?.photographer_notes ||
    shootDetails?.notes?.photographer ||
    '';
  const companyNotes =
    shootDetails?.companyNotes ||
    (shootDetails as any)?.company_notes ||
    shootDetails?.notes?.company ||
    '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] md:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10">
              <Check className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <DialogTitle className="text-xl">Approve Shoot Request</DialogTitle>
              <DialogDescription className="mt-1">
                Review the details and schedule this shoot
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col md:flex-row gap-4 py-4">
            <Skeleton className="h-48 md:h-64 w-full md:w-1/2 rounded-xl" />
            <Skeleton className="h-48 md:h-64 w-full md:w-1/2 rounded-xl" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-5">
            {/* Left Column - Shoot Details */}
            <div className="flex-1 space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4 h-full">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-sm">Shoot Request Details</p>
                </div>

                <div className="space-y-4">
                  {/* Address */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Property</p>
                    <p className="font-semibold text-foreground mt-0.5">{displayAddress || 'No address'}</p>
                    {fullLocation && (
                      <p className="text-sm text-muted-foreground">{fullLocation}</p>
                    )}
                  </div>

                  <Separator />

                  {/* Client & Quote */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</p>
                      <p className="font-semibold text-foreground mt-0.5 truncate">{clientName}</p>
                      {clientEmail && (
                        <p className="text-xs text-muted-foreground truncate">{clientEmail}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quote</p>
                      <p className="font-semibold text-emerald-600 mt-0.5">
                        ${typeof totalQuote === 'number' ? totalQuote.toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>

                  {/* Services */}
                  {services.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Services</p>
                        <div className="flex flex-wrap gap-1.5">
                          {services.map((service: any, index: number) => (
                            <Badge 
                              key={(service && (service.id || service.name || service.label)) || index} 
                              variant="secondary" 
                              className="bg-primary/10 text-primary border-primary/20 text-xs"
                            >
                              {service?.name || service?.label || service || 'Service'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Client Notes */}
                  {shootNotes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Notes</p>
                        <p className="text-sm text-foreground mt-1 bg-amber-500/5 p-2 rounded-lg border border-amber-500/20">{shootNotes}</p>
                      </div>
                    </>
                  )}

                  {/* Additional Notes */}
                  {(photographerNotes || companyNotes) && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {photographerNotes && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Photographer Notes</p>
                            <p className="text-sm text-foreground mt-1 bg-blue-500/5 p-2 rounded-lg border border-blue-500/20">
                              {photographerNotes}
                            </p>
                          </div>
                        )}
                        {companyNotes && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company Notes</p>
                            <p className="text-sm text-foreground mt-1 bg-slate-500/5 p-2 rounded-lg border border-slate-500/20">
                              {companyNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Scheduling */}
            <div className="flex-1 space-y-4">
              <div className="rounded-xl border border-border p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold text-sm">Schedule & Assign</p>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal h-9',
                            !scheduledDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {scheduledDate ? format(scheduledDate, 'MMM d') : 'Select'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Time</Label>
                    <Select value={scheduledTime} onValueChange={setScheduledTime}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Photographer */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Photographer</Label>
                  <Select value={photographerId} onValueChange={setPhotographerId}>
                    <SelectTrigger className="h-9">
                      <div className="flex items-center gap-2">
                        <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Select (optional)" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Leave Unassigned</SelectItem>
                      {photographers.map((photographer) => (
                        <SelectItem key={photographer.id} value={String(photographer.id)}>
                          {photographer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Approval Notes */}
              <div className="rounded-xl border border-border p-4 space-y-2">
                <Label className="text-xs">Approval Notes (optional)</Label>
                <Textarea
                  placeholder="Add internal notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleApprove} 
            disabled={isSubmitting || isLoading} 
            className="bg-green-600 hover:bg-green-700 min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Approve Shoot
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
