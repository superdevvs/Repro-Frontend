import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Loader2, MapPin, User, Camera, Clock, DollarSign, FileText, Layers, X } from 'lucide-react';
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
import { ServiceDatePicker, ServiceTimePicker } from '@/components/shoots/ServiceSchedulePicker';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import {
  buildWallClockIso,
  formatDateForWallClockInput,
  formatTimeForWallClockInput,
} from '@/utils/wallClockDateTime';

interface Photographer {
  id: string | number;
  name: string;
  avatar?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  distance?: number;
  distanceFrom?: 'home' | 'previous_shoot';
  previousShootId?: number;
  travel_range?: number | null;
  travel_range_unit?: string;
  availabilitySlots?: AvailabilitySlot[];
  netAvailableSlots?: AvailabilitySlot[];
  unavailableSlots?: AvailabilitySlot[];
  bookedSlots?: Array<AvailabilitySlot & { status?: string; shoot_id?: number }>;
  shootsCountToday?: number;
}

type AvailabilitySlot = {
  start_time: string;
  end_time: string;
};

type PhotographerAvailabilityMap = Record<string, AvailabilitySlot[]>;

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

const normalizeSlotTime = (value?: string) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '00:00';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const timeToMinutes = (value: string) => {
  const [hours, minutes] = normalizeSlotTime(value).split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const availabilityScaleStartMinutes = 8 * 60;
const availabilityScaleTotalMinutes = 12 * 60;
const availabilityScaleTickCount = 9;

const mapPhotographerOption = (photographer: any): Photographer => ({
  id: photographer.id?.toString() || '',
  name: photographer.name || 'Unknown',
  avatar: photographer.avatar || photographer.profile_image || photographer.profile_photo_url,
  email: photographer.email || '',
  address: photographer.address || photographer.metadata?.address || photographer.metadata?.homeAddress,
  city: photographer.city || photographer.metadata?.city,
  state: photographer.state || photographer.metadata?.state,
  zip: photographer.zip || photographer.zipcode || photographer.metadata?.zip || photographer.metadata?.zipcode,
  travel_range: photographer.travel_range ?? photographer.metadata?.travel_range ?? null,
  travel_range_unit: photographer.travel_range_unit ?? photographer.metadata?.travel_range_unit ?? 'miles',
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
  const [sortBy, setSortBy] = useState<'distance' | 'availability'>('distance');
  const [showAllPhotographers, setShowAllPhotographers] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [serviceSchedules, setServiceSchedules] = useState<ServiceScheduleMap>({});
  const [photographerAvailability, setPhotographerAvailability] = useState<PhotographerAvailabilityMap>({});
  const [isLoadingPhotographerAvailability, setIsLoadingPhotographerAvailability] = useState(false);
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
    return formatDateForWallClockInput(raw);
  };

  const formatTimeForInputValue = (raw?: unknown): string => {
    return formatTimeForWallClockInput(raw);
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
    return buildWallClockIso(dateValue, normalizeTimeValue(timeValue || scheduledTime) || '10:00');
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
      for (let h = 8; h <= 19; h++) {
        for (let minuteValue = 0; minuteValue < 60; minuteValue += 5) {
          if (h === 19 && minuteValue !== 0) continue;
          const m = minuteValue.toString().padStart(2, '0');
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
    const query = photographerSearchQuery.trim().toLowerCase();
    const searched = query
      ? photographerOptions.filter((photographer) =>
          photographer.name.toLowerCase().includes(query) ||
          String(photographer.email || '').toLowerCase().includes(query) ||
          String(photographer.city || '').toLowerCase().includes(query) ||
          String(photographer.state || '').toLowerCase().includes(query),
        )
      : photographerOptions;

    const filtered = showAllPhotographers
      ? searched
      : searched.filter((photographer) => (photographerAvailability[String(photographer.id)] || []).length > 0);

    return [...filtered].sort((first, second) => {
      if (sortBy === 'availability') {
        return (photographerAvailability[String(second.id)] || []).length - (photographerAvailability[String(first.id)] || []).length;
      }
      const firstDistance = typeof first.distance === 'number' ? first.distance : Number.POSITIVE_INFINITY;
      const secondDistance = typeof second.distance === 'number' ? second.distance : Number.POSITIVE_INFINITY;
      return firstDistance - secondDistance;
    });
  }, [photographerOptions, photographerSearchQuery, photographerAvailability, showAllPhotographers, sortBy]);

  const formatPhotographerLocationLabel = (photographer?: Photographer | null) =>
    [photographer?.address, photographer?.city, photographer?.state, photographer?.zip].filter(Boolean).join(', ');

  useEffect(() => {
    const availabilityDateValue = scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : '';

    if (!isOpen || photographerOptions.length === 0 || !availabilityDateValue) {
      setPhotographerAvailability({});
      return;
    }

    const abortController = new AbortController();
    const fetchAvailability = async () => {
      setIsLoadingPhotographerAvailability(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const requestAddress = shootDetails?.address || shootDetails?.location?.address || shootAddress || '';
        const requestCity = shootDetails?.city || shootDetails?.location?.city || '';
        const requestState = shootDetails?.state || shootDetails?.location?.state || '';
        const requestZip = shootDetails?.zip || shootDetails?.location?.zip || '';

        const response = await fetch(API_ROUTES.photographerAvailability.forBooking, {
          method: 'POST',
          headers,
          signal: abortController.signal,
          body: JSON.stringify({
            date: availabilityDateValue,
            time: scheduledTime || undefined,
            shoot_address: requestAddress,
            shoot_city: requestCity,
            shoot_state: requestState,
            shoot_zip: requestZip || '',
            photographer_ids: photographerOptions.map((photographer) => Number(photographer.id)).filter(Number.isFinite),
          }),
        });

        if (!response.ok) throw new Error('Failed to fetch photographer availability');

        const json = await response.json();
        const enrichedPhotographers: any[] = Array.isArray(json?.data) ? json.data : [];
        const nextAvailability: PhotographerAvailabilityMap = {};
        const enrichedById = new Map(enrichedPhotographers.map((item) => [String(item.id), item]));

        setPhotographerOptions((current) => current.map((photographer) => {
          const enriched = enrichedById.get(String(photographer.id));
          if (!enriched) return photographer;
          const parsedDistance = typeof enriched.distance === 'number'
            ? enriched.distance
            : enriched.distance
              ? Number.parseFloat(String(enriched.distance))
              : undefined;
          const netAvailableSlots = enriched.net_available_slots || enriched.availability_slots || [];
          nextAvailability[String(photographer.id)] = netAvailableSlots.map((slot: any) => ({
            start_time: slot.start_time,
            end_time: slot.end_time,
          }));
          return {
            ...photographer,
            distance: Number.isFinite(parsedDistance as number) ? parsedDistance : undefined,
            distanceFrom: enriched.distance_from,
            previousShootId: enriched.previous_shoot_id,
            availabilitySlots: enriched.availability_slots || [],
            unavailableSlots: enriched.unavailable_slots || [],
            bookedSlots: enriched.booked_slots || [],
            netAvailableSlots,
            shootsCountToday: enriched.shoots_count_today,
          };
        }));

        setPhotographerAvailability(nextAvailability);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('[ShootApprovalModal] Failed to load photographer availability:', error);
        setPhotographerAvailability({});
      } finally {
        setIsLoadingPhotographerAvailability(false);
      }
    };

    fetchAvailability();

    return () => abortController.abort();
  }, [isOpen, photographerOptions.length, scheduledDate, scheduledTime, shootDetails, shootAddress]);

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
  const serviceScheduleRows = useMemo(() => {
    const rows = Array.isArray(services)
      ? services.filter((service: any) => service && typeof service === 'object' && getServiceIdentifier(service))
      : [];

    return [...rows].sort((first: any, second: any) => {
      const firstServiceId = getServiceIdentifier(first);
      const secondServiceId = getServiceIdentifier(second);
      const firstSchedule = serviceSchedules[firstServiceId] || {};
      const secondSchedule = serviceSchedules[secondServiceId] || {};
      const firstDateTime = buildScheduledAtIso(firstSchedule.date || scheduledDateInputValue, firstSchedule.time || scheduledTime);
      const secondDateTime = buildScheduledAtIso(secondSchedule.date || scheduledDateInputValue, secondSchedule.time || scheduledTime);
      const firstTime = firstDateTime ? new Date(firstDateTime).getTime() : 0;
      const secondTime = secondDateTime ? new Date(secondDateTime).getTime() : 0;

      if (firstTime !== secondTime) return firstTime - secondTime;
      return getServiceName(first).localeCompare(getServiceName(second));
    });
  }, [services, serviceSchedules, scheduledDateInputValue, scheduledTime]);
  const updateServiceSchedule = (serviceId: string, field: 'date' | 'time', value: string) => {
    setServiceSchedules((current) => ({
      ...current,
      [serviceId]: {
        ...current[serviceId],
        [field]: value,
      },
    }));
  };

  const renderPhotographerAssignments = () => (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Photographers</p>
      </div>

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
  );

  const renderApprovalNotes = () => (
    <div className="space-y-2 rounded-xl border border-border p-4">
      <Label className="text-xs">Approval Notes (optional)</Label>
      <Textarea
        placeholder="Add internal notes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        className="resize-none"
      />
      <p className="text-[11px] text-muted-foreground">
        Visible to the internal team in the shoot notes and history views after approval.
      </p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0 sm:max-w-[900px] md:max-w-[1150px] xl:max-w-[1320px]">
        <DialogHeader className="shrink-0 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
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

            {/* Middle Column - Scheduling */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold text-sm">Schedule & Assign</p>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date *</Label>
                    <ServiceDatePicker
                      value={scheduledDateInputValue}
                      minDate={minSelectableDate}
                      onChange={(value) => {
                        const nextDate = new Date(`${value}T12:00:00`);
                        setScheduledDate(Number.isNaN(nextDate.getTime()) ? undefined : nextDate);
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Time</Label>
                    <ServiceTimePicker
                      value={scheduledTime}
                      options={timeOptions}
                      onChange={setScheduledTime}
                    />
                  </div>
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
                              <ServiceDatePicker
                                value={serviceDate}
                                minDate={minSelectableDate}
                                onChange={(value) => updateServiceSchedule(serviceId, 'date', value)}
                                triggerClassName="h-8 rounded-lg px-2"
                              />
                              <ServiceTimePicker
                                value={serviceTime}
                                options={timeOptions}
                                onChange={(value) => updateServiceSchedule(serviceId, 'time', value)}
                                triggerClassName="h-8 rounded-lg px-2"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {renderPhotographerAssignments()}
              {renderApprovalNotes()}
            </div>
          </div>
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-4 py-4 sm:px-6">
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

        <Drawer shouldScaleBackground={false} open={photographerPickerOpen} onOpenChange={(open) => {
          if (!open) {
            closePhotographerPicker();
          }
        }}>
          <DrawerContent className="z-[190] flex max-h-[88dvh] flex-col overflow-hidden rounded-t-3xl border-slate-800/80 bg-background">
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-2.5 pb-0 sm:px-6">
                <DrawerHeader className="relative items-start space-y-1 px-0 pb-1 pt-3 text-left">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-2 h-8 w-8 rounded-full"
                    onClick={closePhotographerPicker}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <DrawerTitle className="pr-10 text-lg text-slate-900 dark:text-slate-100 sm:text-xl">
                    {photographerPickerContext?.categoryName
                      ? `Select Photographer for ${photographerPickerContext.categoryName}`
                      : 'Select Photographer'}
                  </DrawerTitle>
                  <DrawerDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                    Curated network - {filteredPhotographers.length} available
                  </DrawerDescription>
                </DrawerHeader>

                <div className="space-y-3">
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or area..."
                        value={photographerSearchQuery}
                        onChange={(e) => setPhotographerSearchQuery(e.target.value)}
                        className="h-10 rounded-full bg-slate-50 pl-9 sm:h-9 dark:bg-slate-900/50"
                      />
                    </div>
                    <div className="-mx-0.5 flex min-w-0 items-center gap-1.5 overflow-x-auto px-0.5 pb-1 sm:mx-0 sm:gap-2 sm:pb-0 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <Button type="button" size="sm" variant={sortBy === 'distance' ? 'default' : 'secondary'} className="h-8 shrink-0 rounded-full px-2.5 text-xs font-semibold sm:h-9 sm:px-3" onClick={() => setSortBy('distance')}>
                        Distance
                      </Button>
                      <Button type="button" size="sm" variant={sortBy === 'availability' ? 'default' : 'secondary'} className="h-8 shrink-0 rounded-full px-2.5 text-xs font-semibold sm:h-9 sm:px-3" onClick={() => setSortBy('availability')}>
                        Availability
                      </Button>
                      <Button type="button" size="sm" variant={showAllPhotographers ? 'default' : 'secondary'} className="h-8 shrink-0 rounded-full px-2.5 text-xs font-semibold sm:h-9 sm:px-3" onClick={() => setShowAllPhotographers((current) => !current)}>
                        Show All
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden sm:pr-2">
                  {filteredPhotographers.length > 0 ? (
                    <div className="grid gap-2.5 sm:gap-3">
                      {filteredPhotographers.map((photographer) => {
                        const isSelected = pickerPhotographerId === String(photographer.id);
                        const locationLabel = formatPhotographerLocationLabel(photographer);
                        const availabilitySlots = photographerAvailability[String(photographer.id)] || [];
                        const bookedSlots = photographer.bookedSlots || [];
                        const unavailableSlots = photographer.unavailableSlots || [];
                        const distanceLabel = typeof photographer.distance === 'number' && Number.isFinite(photographer.distance)
                          ? `${photographer.distance.toFixed(1)} mi`
                          : null;
                        const bookedCount = bookedSlots.length;
                        const unavailableCount = unavailableSlots.length;
                        const travelRange = photographer.travel_range;
                        const travelUnit = photographer.travel_range_unit || 'miles';
                        const rangeInMiles = travelUnit === 'km' && travelRange != null ? travelRange * 0.621371 : travelRange;
                        const isOutOfRange = typeof photographer.distance === 'number' && rangeInMiles != null && photographer.distance > rangeInMiles;
                        const renderTimelineSlot = (slot: AvailabilitySlot, key: string, className: string) => {
                          const startMinutes = timeToMinutes(slot.start_time);
                          const endMinutes = timeToMinutes(slot.end_time);
                          const leftPercent = ((startMinutes - availabilityScaleStartMinutes) / availabilityScaleTotalMinutes) * 100;
                          const widthPercent = ((endMinutes - startMinutes) / availabilityScaleTotalMinutes) * 100;
                          const clampedLeft = Math.max(0, Math.min(100, leftPercent));
                          const clampedWidth = Math.max(2, Math.min(100 - clampedLeft, widthPercent));
                          if (clampedWidth <= 0) return null;
                          return (
                            <span
                              key={key}
                              className={className}
                              style={{ left: `${clampedLeft}%`, width: `${clampedWidth}%` }}
                            />
                          );
                        };

                        return (
                          <button
                            type="button"
                            key={photographer.id}
                            onClick={() => setPickerPhotographerId(String(photographer.id))}
                            className={cn(
                              'w-full min-w-0 rounded-2xl border px-2.5 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:px-4',
                              isSelected
                                ? 'border-blue-500/70 bg-blue-50/60 dark:border-blue-500/50 dark:bg-blue-950/30'
                                : 'border-slate-200/70 bg-white/70 hover:border-blue-400/50 dark:border-slate-800/70 dark:bg-slate-900/40',
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
                              <Avatar
                                className={cn(
                                  'h-9 w-9 shrink-0 sm:h-11 sm:w-11',
                                  isSelected && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950',
                                )}
                              >
                                <AvatarImage
                                  src={getAvatarUrl(photographer.avatar, 'photographer', undefined, photographer.id)}
                                  alt={photographer.name}
                                />
                                <AvatarFallback>{photographer.name?.charAt(0)}</AvatarFallback>
                              </Avatar>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="min-w-0 max-w-full truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {photographer.name}
                                  </p>
                                  {distanceLabel ? (
                                    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                                      {distanceLabel}
                                    </span>
                                  ) : null}
                                  {photographer.distanceFrom === 'previous_shoot' ? (
                                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                                      from last shoot
                                    </span>
                                  ) : null}
                                  {isOutOfRange ? (
                                    <span className="shrink-0 rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-400">
                                      Out of range
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-0.5 min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
                                  {locationLabel || photographer.email || 'Location unavailable'}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                  {photographer.shootsCountToday ? <span>{photographer.shootsCountToday} shoot{photographer.shootsCountToday === 1 ? '' : 's'} today</span> : null}
                                  {bookedCount > 0 ? <span className="text-blue-700 dark:text-blue-300">{bookedCount} booked</span> : null}
                                  {unavailableCount > 0 ? <span className="text-red-600 dark:text-red-400">{unavailableCount} unavailable</span> : null}
                                </div>

                                <div className="mt-2 space-y-1">
                                  <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                    {availabilitySlots.map((slot, index) => renderTimelineSlot(slot, `${photographer.id}-slot-${index}`, 'absolute bottom-0 top-0 rounded-full bg-blue-500 dark:bg-blue-400'))}
                                    {bookedSlots.map((slot, index) => renderTimelineSlot(slot, `${photographer.id}-booked-${index}`, 'absolute bottom-0 top-0 rounded-full bg-blue-900 dark:bg-blue-700'))}
                                    {unavailableSlots.map((slot, index) => renderTimelineSlot(slot, `${photographer.id}-unavailable-${index}`, 'absolute bottom-0 top-0 rounded-full bg-red-500 dark:bg-red-500'))}
                                  </div>
                                  {availabilitySlots.length > 0 ? (
                                    <div className="mt-1 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                      <span className="shrink-0">8 AM</span>
                                      <div className="flex flex-1 items-center justify-between px-1">
                                        {Array.from({ length: availabilityScaleTickCount }).map((_, index) => (
                                          <span key={`${photographer.id}-scale-${index}`} className="h-1.5 w-px bg-slate-300/80 dark:bg-slate-600/80" />
                                        ))}
                                      </div>
                                      <span className="shrink-0">8 PM</span>
                                    </div>
                                  ) : null}
                                  {isLoadingPhotographerAvailability ? (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Loading availability...</p>
                                  ) : null}
                                </div>
                              </div>

                              <span
                                className={cn(
                                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors sm:h-8 sm:w-8',
                                  isSelected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-300/80 dark:border-slate-700/80',
                                )}
                                aria-hidden="true"
                              >
                                {isSelected ? <Check className="h-4 w-4" /> : null}
                              </span>
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

                <div className="shrink-0 border-t border-slate-200/70 bg-white/80 pt-2.5 backdrop-blur [padding-bottom:calc(0.25rem+env(safe-area-inset-bottom))] sm:pt-4 sm:pb-0 dark:border-slate-800/70 dark:bg-slate-950/50">
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
                              src={getAvatarUrl(resolvePhotographerDetails(pickerPhotographerId)?.avatar, 'photographer', undefined, pickerPhotographerId)}
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
                        <p className="text-[10px] uppercase tracking-[0.18em] text-blue-500/80 sm:tracking-[0.28em]">
                          {photographerPickerContext?.categoryName
                            ? `Photographer for ${photographerPickerContext.categoryName}`
                            : 'Selected specialist'}
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {resolvePhotographerDetails(pickerPhotographerId)?.name || 'None selected'}
                        </p>
                      </div>
                    </div>

                    <div className="grid min-w-0 grid-cols-2 gap-2 self-stretch sm:flex sm:self-auto">
                      <Button variant="outline" onClick={handleClearPhotographerPicker} className="col-span-2 h-10 min-w-0 px-2 text-xs sm:col-span-1 sm:h-9 sm:px-3 sm:text-sm">
                        Leave unassigned
                      </Button>
                      <Button variant="ghost" onClick={closePhotographerPicker} className="h-10 min-w-0 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
                        Discard
                      </Button>
                      <Button onClick={handleConfirmPhotographerPicker} disabled={!pickerPhotographerId} className="h-10 min-w-0 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
                        <span className="truncate">Use selection</span>
                      </Button>
                    </div>
                  </div>
                </div>
            </div>
          </DrawerContent>
        </Drawer>
      </DialogContent>
    </Dialog>
  );
}
