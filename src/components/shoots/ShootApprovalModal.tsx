import React, { useState, useEffect, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Check, Loader2, MapPin, User, Camera, Clock, DollarSign, FileText, Layers } from 'lucide-react';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import API_ROUTES from '@/lib/api';
import axios from 'axios';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { getShootPhotographerAssignmentGroups } from '@/utils/shootPhotographerAssignments';

interface Photographer {
  id: string | number;
  name: string;
  avatar?: string;
  email?: string;
  city?: string;
  state?: string;
}

interface ShootDetails {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  client?: { id: number; name: string; email?: string };
  services?: Array<{
    id: number;
    service_id?: number;
    name?: string;
    label?: string;
    price?: number;
    category?: { id?: string | number; name?: string } | string | null;
    photographer_id?: string | number | null;
    resolved_photographer_id?: string | number | null;
    scheduled_at?: string | null;
    scheduledAt?: string | null;
  } | string>;
  serviceItems?: Array<Record<string, unknown>>;
  service_items?: Array<Record<string, unknown>>;
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
    approval?: string;
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

type PhotographerPickerContext = {
  categoryKey?: string;
  categoryName?: string;
} | null;

type ServiceScheduleMap = Record<string, { date?: string; time?: string }>;

const normalizeCategoryKey = (value?: string) =>
  (value || 'other').trim().toLowerCase().replace(/s$/, '') || 'other';

const mapPhotographerOption = (photographer: any): Photographer => ({
  id: photographer.id?.toString() || '',
  name: photographer.name || 'Unknown',
  avatar: photographer.avatar || photographer.profile_image || photographer.profile_photo_url,
  email: photographer.email || '',
  city: photographer.city || photographer.metadata?.city,
  state: photographer.state || photographer.metadata?.state,
});

const loadPhotographerOptions = async (initialPhotographers: Photographer[] = []): Promise<Photographer[]> => {
  if (initialPhotographers.length > 0) {
    return initialPhotographers.map(mapPhotographerOption);
  }

  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await axios.get(API_ROUTES.people.adminPhotographers, { headers });
    const data = response.data?.data || response.data || [];
    const formatted = Array.isArray(data) ? data.map(mapPhotographerOption) : [];
    if (formatted.length > 0) {
      return formatted;
    }
  } catch (error) {
    console.warn('[ShootApprovalModal] Admin photographers endpoint failed, falling back to public list:', error);
  }

  try {
    const response = await axios.get(API_ROUTES.people.photographers);
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(mapPhotographerOption) : [];
  } catch (error) {
    console.error('[ShootApprovalModal] Public photographers endpoint failed:', error);
    return [];
  }
};

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
  const [photographerOptions, setPhotographerOptions] = useState<Photographer[]>([]);
  const [photographerId, setPhotographerId] = useState<string>('');
  const [perCategoryPhotographers, setPerCategoryPhotographers] = useState<Record<string, string>>({});
  const [photographerPickerOpen, setPhotographerPickerOpen] = useState(false);
  const [photographerPickerContext, setPhotographerPickerContext] = useState<PhotographerPickerContext>(null);
  const [pickerPhotographerId, setPickerPhotographerId] = useState('');
  const [photographerSearchQuery, setPhotographerSearchQuery] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [serviceSchedules, setServiceSchedules] = useState<ServiceScheduleMap>({});
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

  const formatDateForInputValue = (raw?: unknown): string => {
    if (!raw) return '';
    const value = String(raw);
    const dateOnlyMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnlyMatch) return dateOnlyMatch[1];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : format(date, 'yyyy-MM-dd');
  };

  const formatTimeForInputValue = (raw?: unknown): string => {
    if (!raw) return '';
    if (typeof raw === 'string') {
      const timeMatch = raw.match(/(\d{1,2}:\d{2})(?::\d{2})?/);
      if (timeMatch) {
        return normalizeTimeValue(timeMatch[1]) || '';
      }
    }
    const date = new Date(String(raw));
    return Number.isNaN(date.getTime()) ? '' : format(date, 'HH:mm');
  };

  const getServiceIdentifier = (service: any): string => {
    if (!service || typeof service === 'string') return '';
    const id = service.service_id ?? service.serviceId ?? service.id;
    return id === null || id === undefined ? '' : String(id);
  };

  const getServiceName = (service: any): string => {
    if (typeof service === 'string') return service;
    return service?.name || service?.label || service?.service_name || 'Service';
  };

  const getServiceCategoryKey = (service: any): string => {
    const categoryName =
      typeof service?.category === 'string'
        ? service.category
        : service?.category?.name || 'Other';
    return normalizeCategoryKey(categoryName);
  };

  const buildScheduledAtIso = (dateValue?: string, timeValue?: string): string | null => {
    if (!dateValue) return null;
    const normalizedTime = normalizeTimeValue(timeValue || scheduledTime) || '10:00';
    const [hours, minutes] = normalizedTime.split(':').map(Number);
    const date = new Date(`${dateValue}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
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
    setServiceSchedules({});
    setPhotographerId('');
    setPerCategoryPhotographers({});
    setPhotographerSearchQuery('');
    setPickerPhotographerId('');
    setPhotographerPickerContext(null);
    setPhotographerPickerOpen(false);
    setNotes('');
    setShootDetails(null);
    setIsLoading(true);
    
    const fetchShootDetails = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        // Add cache-busting to ensure fresh data
        const [response, loadedPhotographers] = await Promise.all([
          fetch(`${API_BASE_URL}/api/shoots/${shootId}?_t=${Date.now()}`, {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Cache-Control': 'no-cache',
            }
          }),
          loadPhotographerOptions(photographers),
        ]);

        setPhotographerOptions(loadedPhotographers);
        
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

          const assignmentGroups = getShootPhotographerAssignmentGroups({
            serviceObjects: Array.isArray(shoot.serviceObjects) ? shoot.serviceObjects : undefined,
            services: Array.isArray(shoot.services) ? shoot.services : [],
            photographer: shoot.photographer
              ? {
                  id: shoot.photographer.id,
                  name: shoot.photographer.name,
                  email: shoot.photographer.email,
                }
              : undefined,
          });
          const categoryAssignments: Record<string, string> = {};
          assignmentGroups.groups.forEach((group) => {
            if (group.photographer?.id != null && !categoryAssignments[group.key]) {
              categoryAssignments[group.key] = String(group.photographer.id);
            }
          });
          setPerCategoryPhotographers(categoryAssignments);
          
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

          const serviceItemSchedules = new Map<string, Record<string, unknown>>();
          const rawServiceItems = Array.isArray(shoot.serviceItems)
            ? shoot.serviceItems
            : Array.isArray(shoot.service_items)
              ? shoot.service_items
              : [];
          rawServiceItems.forEach((item: Record<string, unknown>) => {
            const serviceId = item.service_id ?? item.serviceId;
            if (serviceId !== null && serviceId !== undefined) {
              serviceItemSchedules.set(String(serviceId), item);
            }
          });
          const nextServiceSchedules: ServiceScheduleMap = {};
          (Array.isArray(shoot.services) ? shoot.services : []).forEach((service: any) => {
            if (!service || typeof service === 'string') return;
            const serviceId = getServiceIdentifier(service);
            if (!serviceId) return;
            const itemSchedule = serviceItemSchedules.get(serviceId);
            const rawScheduledAt =
              service.scheduled_at ??
              service.scheduledAt ??
              itemSchedule?.scheduled_at ??
              itemSchedule?.scheduledAt;
            const date = formatDateForInputValue(rawScheduledAt);
            const time = formatTimeForInputValue(rawScheduledAt);
            if (date || time) {
              nextServiceSchedules[serviceId] = { date, time };
            }
          });
          setServiceSchedules(nextServiceSchedules);

          // Preselect photographer if provided by the request
          const resolvedPhotographerId =
            shoot.photographer?.id || shoot.photographer_id || shoot.photographerId;
          if (resolvedPhotographerId) {
            setPhotographerId(String(resolvedPhotographerId));
          } else {
            const firstAssignedPhotographerId = Object.values(categoryAssignments)[0];
            if (firstAssignedPhotographerId) {
              setPhotographerId(String(firstAssignedPhotographerId));
            }
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

      if (Array.isArray(shootDetails?.services) && Object.keys(perCategoryPhotographers).length > 0) {
        const serviceAssignments = shootDetails.services.reduce((assignments: Array<{ service_id: number; photographer_id: number }>, service: any) => {
          if (!service || typeof service === 'string') return assignments;
          const serviceId = Number(service.id || service.service_id);
          if (!serviceId) return assignments;
          const categoryName =
            typeof service.category === 'string'
              ? service.category
              : service.category?.name || 'Other';
          const categoryKey = normalizeCategoryKey(categoryName);
          const selectedCategoryPhotographerId = perCategoryPhotographers[categoryKey];
          if (selectedCategoryPhotographerId) {
            assignments.push({
              service_id: serviceId,
              photographer_id: Number(selectedCategoryPhotographerId),
            });
          }
          return assignments;
        }, []);

        if (serviceAssignments.length > 0) {
          payload.service_photographers = serviceAssignments;
        }
      }

      if (Array.isArray(shootDetails?.services)) {
        const defaultDate = format(scheduledAt, 'yyyy-MM-dd');
        const serviceItemsPayload = shootDetails.services.reduce((items: Array<Record<string, unknown>>, service: any) => {
          if (!service || typeof service === 'string') return items;
          const serviceId = Number(getServiceIdentifier(service));
          if (!serviceId) return items;
          const categoryKey = getServiceCategoryKey(service);
          const selectedPhotographerId = perCategoryPhotographers[categoryKey] || photographerId || null;
          const schedule = serviceSchedules[String(serviceId)] || {};
          const serviceScheduledAt = buildScheduledAtIso(schedule.date || defaultDate, schedule.time || scheduledTime) || scheduledAt.toISOString();
          items.push({
            service_id: serviceId,
            scheduled_at: serviceScheduledAt,
            ...(selectedPhotographerId && selectedPhotographerId !== 'unassigned'
              ? { photographer_id: Number(selectedPhotographerId) }
              : {}),
          });
          return items;
        }, []);

        if (serviceItemsPayload.length > 0) {
          payload.service_items = serviceItemsPayload;
        }
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

  const serviceCategoryGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; serviceIds: string[] }>();
    const serviceList = Array.isArray(shootDetails?.services) ? shootDetails.services : [];

    serviceList.forEach((service: any) => {
      if (!service || typeof service === 'string') return;
      const serviceId = service.id || service.service_id;
      if (serviceId == null) return;
      const categoryName =
        typeof service.category === 'string'
          ? service.category
          : service.category?.name || 'Other';
      const key = normalizeCategoryKey(categoryName);
      const existing = groups.get(key);
      if (existing) {
        existing.serviceIds.push(String(serviceId));
      } else {
        groups.set(key, { key, name: categoryName, serviceIds: [String(serviceId)] });
      }
    });

    return Array.from(groups.values());
  }, [shootDetails?.services]);

  const hasMultiplePhotographerCategories = serviceCategoryGroups.length > 1;

  const resolvePhotographerDetails = (value?: string | number | null) => {
    if (value === null || value === undefined || value === '') return null;
    const normalizedId = String(value);
    return (
      photographerOptions.find((photographer) => String(photographer.id) === normalizedId) ||
      (shootDetails?.photographer && String(shootDetails.photographer.id) === normalizedId
        ? mapPhotographerOption(shootDetails.photographer)
        : null)
    );
  };

  const filteredPhotographers = useMemo(() => {
    if (!photographerSearchQuery.trim()) return photographerOptions;
    const query = photographerSearchQuery.trim().toLowerCase();
    return photographerOptions.filter((photographer) =>
      photographer.name.toLowerCase().includes(query) ||
      String(photographer.email || '').toLowerCase().includes(query) ||
      String(photographer.city || '').toLowerCase().includes(query) ||
      String(photographer.state || '').toLowerCase().includes(query),
    );
  }, [photographerOptions, photographerSearchQuery]);

  const openPhotographerPicker = (context: PhotographerPickerContext) => {
    const singleCategory = serviceCategoryGroups[0];
    const initialId = context?.categoryKey
      ? perCategoryPhotographers[context.categoryKey] || photographerId || ''
      : singleCategory
      ? perCategoryPhotographers[singleCategory.key] || photographerId || ''
      : photographerId || '';
    setPhotographerPickerContext(context);
    setPickerPhotographerId(initialId && initialId !== 'unassigned' ? initialId : '');
    setPhotographerSearchQuery('');
    setPhotographerPickerOpen(true);
  };

  const closePhotographerPicker = () => {
    setPhotographerPickerOpen(false);
    setPhotographerPickerContext(null);
    setPickerPhotographerId('');
    setPhotographerSearchQuery('');
  };

  const handleConfirmPhotographerPicker = () => {
    if (!pickerPhotographerId) return;

    if (photographerPickerContext?.categoryKey) {
      setPerCategoryPhotographers((prev) => ({
        ...prev,
        [photographerPickerContext.categoryKey as string]: pickerPhotographerId,
      }));
      if (!photographerId || photographerId === 'unassigned') {
        setPhotographerId(pickerPhotographerId);
      }
    } else {
      setPhotographerId(pickerPhotographerId);
      if (serviceCategoryGroups.length === 1) {
        setPerCategoryPhotographers((prev) => ({
          ...prev,
          [serviceCategoryGroups[0].key]: pickerPhotographerId,
        }));
      }
    }

    closePhotographerPicker();
  };

  const handleClearPhotographerPicker = () => {
    if (photographerPickerContext?.categoryKey) {
      const nextAssignments = { ...perCategoryPhotographers };
      delete nextAssignments[photographerPickerContext.categoryKey];
      setPerCategoryPhotographers(nextAssignments);
      if (serviceCategoryGroups.length <= 1) {
        setPhotographerId('');
      }
    } else {
      setPhotographerId('');
      if (serviceCategoryGroups.length === 1) {
        const nextAssignments = { ...perCategoryPhotographers };
        delete nextAssignments[serviceCategoryGroups[0].key];
        setPerCategoryPhotographers(nextAssignments);
      }
    }

    closePhotographerPicker();
  };

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
  const resolvedBaseQuote =
    (shootDetails as any)?.payment?.baseQuote ??
    (shootDetails?.financials as any)?.baseQuote ??
    (shootDetails as any)?.baseQuote ??
    (shootDetails as any)?.base_quote ??
    servicePriceTotal;
  const baseQuote = Number(resolvedBaseQuote ?? 0);

  // Get stored tax amount
  const storedTaxAmount = Number(
    (shootDetails as any)?.payment?.taxAmount ??
    (shootDetails?.financials as any)?.taxAmount ??
    (shootDetails as any)?.taxAmount ??
    (shootDetails as any)?.tax_amount ??
    0
  );

  // If stored tax is 0 but we have a base quote and tax_percent, recalculate
  const rawTaxPercent = Number(
    (shootDetails as any)?.tax_percent ??
    (shootDetails as any)?.taxPercent ??
    (shootDetails as any)?.payment?.taxRate ??
    0
  );
  const normalizedTaxRate = rawTaxPercent > 1 ? rawTaxPercent / 100 : rawTaxPercent;
  const taxAmount = storedTaxAmount > 0
    ? storedTaxAmount
    : Number((baseQuote * normalizedTaxRate).toFixed(2));

  const storedTotalQuote = Number(
    (shootDetails as any)?.payment?.totalQuote ??
    shootDetails?.financials?.totalQuote ??
    shootDetails?.totalQuote ??
    (shootDetails as any)?.total_quote ??
    0
  );
  const totalQuote = storedTotalQuote > 0 ? storedTotalQuote : baseQuote + taxAmount;
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
  const minSelectableDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const scheduledDateInputValue = useMemo(
    () => (scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : ''),
    [scheduledDate]
  );
  const serviceScheduleRows = Array.isArray(services)
    ? services.filter((service: any) => service && typeof service === 'object' && getServiceIdentifier(service))
    : [];
  const updateServiceSchedule = (serviceId: string, field: 'date' | 'time', value: string) => {
    setServiceSchedules((current) => ({
      ...current,
      [serviceId]: {
        ...current[serviceId],
        [field]: value,
      },
    }));
  };

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
                      <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                        <p>Base: ${baseQuote.toFixed(2)}</p>
                        <p>Tax: ${taxAmount.toFixed(2)}</p>
                      </div>
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
                    <div className="relative">
                      <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="date"
                        min={minSelectableDate}
                        value={scheduledDateInputValue}
                        onChange={(event) => {
                          const value = event.target.value;
                          setScheduledDate(value ? new Date(`${value}T12:00:00`) : undefined);
                        }}
                        className="h-9 pl-9"
                      />
                    </div>
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
                  {hasMultiplePhotographerCategories ? (
                    <div className="space-y-2">
                      {serviceCategoryGroups.map((group) => {
                        const selectedPhotographer = resolvePhotographerDetails(
                          perCategoryPhotographers[group.key] || photographerId,
                        );

                        return (
                          <div
                            key={group.key}
                            className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5"
                          >
                            <div className="min-w-0 space-y-1 text-xs">
                              <div className="text-[10px] font-medium uppercase text-muted-foreground">
                                {group.name}
                              </div>
                              <div className="font-medium">
                                {selectedPhotographer?.name || 'Unassigned'}
                              </div>
                              {selectedPhotographer?.email && (
                                <div className="truncate text-muted-foreground">
                                  {selectedPhotographer.email}
                                </div>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 shrink-0 text-xs"
                              onClick={() =>
                                openPhotographerPicker({
                                  categoryKey: group.key,
                                  categoryName: group.name,
                                })
                              }
                            >
                              {selectedPhotographer ? 'Edit photographer' : 'Select photographer'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5">
                      <div className="min-w-0 space-y-1 text-xs">
                        <div className="font-medium">
                          {resolvePhotographerDetails(photographerId)?.name || 'Unassigned'}
                        </div>
                        {resolvePhotographerDetails(photographerId)?.email && (
                          <div className="truncate text-muted-foreground">
                            {resolvePhotographerDetails(photographerId)?.email}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 text-xs"
                        onClick={() => openPhotographerPicker(null)}
                      >
                        {resolvePhotographerDetails(photographerId) ? 'Edit photographer' : 'Select photographer'}
                      </Button>
                    </div>
                  )}
                </div>

                {serviceScheduleRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs">Service Schedules</Label>
                      <span className="text-[11px] text-muted-foreground">Defaults to order schedule</span>
                    </div>
                    <div className="space-y-2">
                      {serviceScheduleRows.map((service: any) => {
                        const serviceId = getServiceIdentifier(service);
                        const schedule = serviceSchedules[serviceId] || {};
                        const serviceDate = schedule.date || scheduledDateInputValue;
                        const serviceTime = schedule.time || scheduledTime;

                        return (
                          <div key={serviceId} className="rounded-lg border bg-background/50 px-3 py-2.5">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium">{getServiceName(service)}</div>
                                <div className="text-[10px] uppercase text-muted-foreground">
                                  {typeof service.category === 'string'
                                    ? service.category
                                    : service.category?.name || 'Service'}
                                </div>
                              </div>
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                Customizable
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="date"
                                min={minSelectableDate}
                                value={serviceDate}
                                onChange={(event) => updateServiceSchedule(serviceId, 'date', event.target.value)}
                                className="h-8 text-xs"
                              />
                              <Select value={serviceTime} onValueChange={(value) => updateServiceSchedule(serviceId, 'time', value)}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Time" />
                                </SelectTrigger>
                                <SelectContent>
                                  {timeOptions.map((option) => (
                                    <SelectItem key={`${serviceId}-${option.value}`} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                <p className="text-[11px] text-muted-foreground">
                  Visible to the internal team in the shoot notes and history views after approval.
                </p>
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

        <Dialog open={photographerPickerOpen} onOpenChange={(open) => {
          if (!open) {
            closePhotographerPicker();
          }
        }}>
          <DialogContent className="w-[92vw] max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl">
            <div className="flex h-full flex-col sm:h-[70vh]">
              <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
                <DialogHeader className="items-start space-y-1 text-left">
                  <DialogTitle className="text-xl text-slate-900 dark:text-slate-100">
                    {photographerPickerContext?.categoryName
                      ? `Select Photographer for ${photographerPickerContext.categoryName}`
                      : 'Select Photographer'}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                    Curated network - {filteredPhotographers.length} available
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or area..."
                      value={photographerSearchQuery}
                      onChange={(e) => setPhotographerSearchQuery(e.target.value)}
                      className="h-11 rounded-full bg-slate-50 pl-9 dark:bg-slate-900/50"
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                  {filteredPhotographers.length > 0 ? (
                    <div className="grid gap-3">
                      {filteredPhotographers.map((photographer) => {
                        const isSelected = pickerPhotographerId === String(photographer.id);

                        return (
                          <button
                            type="button"
                            key={photographer.id}
                            onClick={() => setPickerPhotographerId(String(photographer.id))}
                            className={cn(
                              'w-full rounded-2xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
                              isSelected
                                ? 'border-blue-500/70 bg-blue-50/60 dark:border-blue-500/50 dark:bg-blue-950/30'
                                : 'border-slate-200/70 bg-white/70 hover:border-blue-400/50 dark:border-slate-800/70 dark:bg-slate-900/40',
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <Avatar className="h-12 w-12 shrink-0">
                                <AvatarImage src={photographer.avatar} alt={photographer.name} />
                                <AvatarFallback>{photographer.name?.charAt(0)}</AvatarFallback>
                              </Avatar>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {photographer.name}
                                    </div>
                                    {photographer.email && (
                                      <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                        {photographer.email}
                                      </div>
                                    )}
                                  </div>

                                  <span
                                    className={cn(
                                      'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                                      isSelected
                                        ? 'border-blue-600 bg-blue-600 text-white'
                                        : 'border-slate-300/80 dark:border-slate-700/80',
                                    )}
                                    aria-hidden="true"
                                  >
                                    {isSelected ? <Check className="h-4 w-4" /> : null}
                                  </span>
                                </div>

                                {(photographer.city || photographer.state) && (
                                  <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                                    {[photographer.city, photographer.state].filter(Boolean).join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {photographerSearchQuery ? 'No photographers found matching your search.' : 'No photographers available.'}
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 border-t border-slate-200/70 bg-white/80 pt-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/50">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        className={cn(
                          'h-10 w-10 shrink-0',
                          resolvePhotographerDetails(pickerPhotographerId)
                            ? 'ring-2 ring-blue-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
                            : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        {resolvePhotographerDetails(pickerPhotographerId) ? (
                          <>
                            <AvatarImage
                              src={resolvePhotographerDetails(pickerPhotographerId)?.avatar}
                              alt={resolvePhotographerDetails(pickerPhotographerId)?.name}
                            />
                            <AvatarFallback>{resolvePhotographerDetails(pickerPhotographerId)?.name?.charAt(0)}</AvatarFallback>
                          </>
                        ) : (
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        )}
                      </Avatar>

                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-blue-500/80">
                          {photographerPickerContext?.categoryName
                            ? `Photographer for ${photographerPickerContext.categoryName}`
                            : 'Selected specialist'}
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {resolvePhotographerDetails(pickerPhotographerId)?.name || 'None selected'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 self-stretch lg:self-auto">
                      <Button variant="outline" onClick={handleClearPhotographerPicker} className="flex-1 lg:flex-none">
                        Leave unassigned
                      </Button>
                      <Button variant="ghost" onClick={closePhotographerPicker} className="flex-1 lg:flex-none">
                        Discard
                      </Button>
                      <Button onClick={handleConfirmPhotographerPicker} disabled={!pickerPhotographerId} className="flex-1 lg:flex-none">
                        Use selection
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
