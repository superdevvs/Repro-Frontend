// SchedulingForm.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { TimeSelect } from "@/components/ui/time-select";
import { format } from "date-fns";
import { AlertTriangle, MapPin, User, Package, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { to12Hour, to24Hour } from '@/utils/availabilityUtils';
import API_ROUTES from '@/lib/api';
import { CheckCircle2, Check, Clock } from "lucide-react";
import { getAvatarUrl } from '@/utils/defaultAvatars';
import { getCategorySpecialtyId, hasCategorySpecialty } from '@/utils/photographerSpecialties';
import { buildServiceTimeOptions, ServiceDatePicker, ServiceTimePicker } from '@/components/shoots/ServiceSchedulePicker';

interface SchedulingPhotographer {
  id: string;
  name: string;
  avatar?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  metadata?: {
    specialties?: Array<string | number>;
    travel_range?: number;
    travel_range_unit?: string;
  };
  specialties?: Array<string | number>;
  travel_range?: number;
  travel_range_unit?: string;
}

interface SchedulingFormProps {
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  time: string;
  setTime: React.Dispatch<React.SetStateAction<string>>;
  formErrors: Record<string, string>;
  setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSubmit: () => void;
  goBack: () => void;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  setAddress?: React.Dispatch<React.SetStateAction<string>>;
  setCity?: React.Dispatch<React.SetStateAction<string>>;
  setState?: React.Dispatch<React.SetStateAction<string>>;
  setZip?: React.Dispatch<React.SetStateAction<string>>;
  photographer?: string;
  photographers?: SchedulingPhotographer[];
  setPhotographer?: React.Dispatch<React.SetStateAction<string>>;
  servicePhotographers?: Record<string, string>;
  setServicePhotographers?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  serviceSchedules?: Record<string, { date?: string; time?: string }>;
  setServiceSchedules?: React.Dispatch<React.SetStateAction<Record<string, { date?: string; time?: string }>>>;
  selectedServices?: Array<{ id: string; name: string; description?: string; price: number; category?: { id: string; name: string } }>;
  sameDayAddressWarningMessage?: string;
}

export const SchedulingForm: React.FC<SchedulingFormProps> = ({
  date,
  setDate,
  time,
  setTime,
  formErrors,
  setFormErrors,
  handleSubmit,
  goBack,
  address = '',
  city = '',
  state = '',
  zip = '',
  bedrooms = '',
  bathrooms = '',
  sqft = '',
  setAddress,
  setCity,
  setState,
  setZip,
  photographer = '',
  photographers = [],
  setPhotographer,
  servicePhotographers = {},
  setServicePhotographers,
  serviceSchedules = {},
  setServiceSchedules,
  selectedServices = [],
  sameDayAddressWarningMessage = '',
}) => {
  const disabledDates = {
    before: new Date(),
  };
  const today = React.useMemo(() => new Date(), []);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [tempTime, setTempTime] = useState('');
  const [photographerDialogOpen, setPhotographerDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'availability'>('distance');
  const [showAllPhotographers, setShowAllPhotographers] = useState(false);
  const [photographersWithDistance, setPhotographersWithDistance] = useState<Array<{
    id: string;
    name: string;
    avatar?: string;
    distance?: number;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    distanceFrom?: 'home' | 'previous_shoot';
    previousShootId?: number;
    availabilitySlots?: Array<{ start_time: string; end_time: string; status?: string }>;
    unavailableSlots?: Array<{ start_time: string; end_time: string; status?: string }>;
    bookedSlots?: Array<{ start_time: string; end_time: string; status?: string; shoot_id?: number; address?: string; city?: string; state?: string; zip?: string }>;
    netAvailableSlots?: Array<{ start_time: string; end_time: string; status?: string }>;
    isAvailableAtTime?: boolean;
    hasAvailability?: boolean;
    shootsCountToday?: number;
  }>>([]);
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  const [photographerAvailability, setPhotographerAvailability] = useState<Map<string | number, {
    isAvailable: boolean;
    nextAvailableTimes: string[];
  }>>(new Map());
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const suggestedTimesRailRef = React.useRef<HTMLDivElement | null>(null);
  const [canScrollSuggestedTimesLeft, setCanScrollSuggestedTimesLeft] = useState(false);
  const [canScrollSuggestedTimesRight, setCanScrollSuggestedTimesRight] = useState(false);

  const formatLocationLabel = (location?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  }) => {
    if (!location) return '';
    const baseAddress = (location.address || '').trim();
    const normalizedAddress = baseAddress.toLowerCase();
    const parts: string[] = [];
    const seen = new Set<string>();

    const addPart = (value?: string, checkAddress = false) => {
      const trimmed = (value || '').trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;
      if (checkAddress && normalizedAddress) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(normalizedAddress)) {
          return;
        }
      }
      parts.push(trimmed);
      seen.add(key);
    };

    if (baseAddress) {
      parts.push(baseAddress);
      seen.add(baseAddress.toLowerCase());
    }

    addPart(location.city, true);
    addPart(location.state, true);
    addPart(location.zip, true);

    return parts.join(', ');
  };

  const normalizeSlotTime = (value?: string) => {
    if (!value) return '';
    const trimmed = value.trim();
    const converted = to24Hour(trimmed);
    const [hours, minutes] = converted.split(':');
    if (!hours || !minutes) return converted;
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };

  const defaultServiceDate = useMemo(() => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [date]);

  const defaultServiceTime = useMemo(() => normalizeSlotTime(time).slice(0, 5), [time]);

  const getServiceSchedule = (serviceId: string) => ({
    date: serviceSchedules[serviceId]?.date || defaultServiceDate,
    time: serviceSchedules[serviceId]?.time || defaultServiceTime,
  });

  const updateServiceSchedules = (
    serviceIds: string[],
    patch: Partial<{ date: string; time: string }>
  ) => {
    if (!setServiceSchedules) return;
    setServiceSchedules(prev => {
      const next = { ...prev };
      for (const serviceId of serviceIds) {
        next[serviceId] = {
          date: prev[serviceId]?.date || defaultServiceDate,
          time: prev[serviceId]?.time || defaultServiceTime,
          ...patch,
        };
      }
      return next;
    });
  };

  const formatScheduleLine = (serviceId: string) => {
    const schedule = getServiceSchedule(serviceId);
    const dateText = schedule.date || 'No date';
    const timeText = schedule.time ? to12Hour(schedule.time) : 'No time';
    return `${dateText} at ${timeText}`;
  };

  const normalizeDayOfWeek = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value).trim().toLowerCase();
    const map: Record<string, string> = {
      '0': 'sunday',
      '1': 'monday',
      '2': 'tuesday',
      '3': 'wednesday',
      '4': 'thursday',
      '5': 'friday',
      '6': 'saturday',
      sun: 'sunday',
      sunday: 'sunday',
      mon: 'monday',
      monday: 'monday',
      tue: 'tuesday',
      tues: 'tuesday',
      tuesday: 'tuesday',
      wed: 'wednesday',
      weds: 'wednesday',
      wednesday: 'wednesday',
      thu: 'thursday',
      thur: 'thursday',
      thurs: 'thursday',
      thursday: 'thursday',
      fri: 'friday',
      friday: 'friday',
      sat: 'saturday',
      saturday: 'saturday',
    };
    return map[str] ?? str;
  };

  const normalizeAddressKey = (value: { address?: string; city?: string; state?: string; zip?: string }) => {
    const joined = [value.address, value.city, value.state, value.zip]
      .filter(Boolean)
      .map((part) => String(part).trim().toLowerCase())
      .join(' ');
    return joined.replace(/[^a-z0-9]+/gi, '');
  };

  const timeToMinutes = (value: string) => {
    const normalized = normalizeSlotTime(value);
    const [hours, minutes] = normalized.split(':').map(Number);
    if (!Number.isFinite(hours)) return 0;
    return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
  };

  const minutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const buildAvailabilitySegments = (
    slots: Array<{ start_time: string; end_time: string }> = [],
  ) => {
    const startHour = 8;
    const endHour = 20;
    const segments: boolean[] = [];
    for (let hour = startHour; hour < endHour; hour += 1) {
      const segmentStart = hour * 60;
      const segmentEnd = (hour + 1) * 60;
      const hasSlot = slots.some((slot) => {
        const slotStart = timeToMinutes(slot.start_time);
        const slotEnd = timeToMinutes(slot.end_time);
        return slotStart < segmentEnd && slotEnd > segmentStart;
      });
      segments.push(hasSlot);
    }
    return segments;
  };

  const availabilityStats = useMemo(() => {
    const basePhotographers = photographersWithDistance.length > 0
      ? photographersWithDistance
      : photographers;
    const availableCount = basePhotographers.reduce((count, photographerItem) => {
      const availability = photographerAvailability.get(photographerItem.id)
        || photographerAvailability.get(String(photographerItem.id))
        || photographerAvailability.get(Number(photographerItem.id));
      if (availability) {
        return availability.isAvailable ? count + 1 : count;
      }
      const hasSlots = Array.isArray((photographerItem as any).netAvailableSlots)
        ? (photographerItem as any).netAvailableSlots.length > 0
        : false;
      return hasSlots ? count + 1 : count;
    }, 0);
    const hasAvailabilityData = photographerAvailability.size > 0
      || basePhotographers.some((photographerItem: any) => Array.isArray(photographerItem.netAvailableSlots));

    return {
      total: basePhotographers.length,
      available: availableCount,
      hasAvailabilityData,
    };
  }, [photographersWithDistance, photographers, photographerAvailability]);

  const onDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      const year = newDate.getFullYear();
      const month = newDate.getMonth();
      const day = newDate.getDate();
      const adjustedDate = new Date(year, month, day, 12, 0, 0); // Set to noon to avoid timezone issues
      setDate(adjustedDate);
    } else {
      setDate(undefined);
    }

    if (newDate && formErrors['date']) {
      const { date, ...rest } = formErrors;
      setFormErrors(rest);
    }
  };

  const onTimeChange = (newTime: string) => {
    // Store the time in temp state - will be saved when OK is clicked
    setTempTime(newTime);
  };

  const handleTimeDialogOpen = (open: boolean) => {
    // Prevent opening if date is not selected
    if (open && !date) {
      toast({
        title: "Select date first",
        description: "Please choose a date before selecting time.",
        variant: "destructive",
      });
      return;
    }
    if (open) {
      // Initialize temp time with current time when opening
      setTempTime(time || '');
    }
    setTimeDialogOpen(open);
  };

  const handleTimeConfirm = () => {
    if (tempTime) {
      if (isPhotographerTimeDisabled(photographer, tempTime)) {
        toast({
          title: "Time unavailable",
          description: "The selected photographer is booked or unavailable at that time.",
          variant: "destructive",
        });
        return;
      }
      setTime(tempTime);
      if (formErrors['time']) {
        const { time: _, ...rest } = formErrors;
        setFormErrors(rest);
      }
    }
    setTimeDialogOpen(false);
  };

  const handleQuickTimeSelect = (selectedTime: string) => {
    if (!date) {
      toast({
        title: "Select date first",
        description: "Please choose a date before selecting time.",
        variant: "destructive",
      });
      return;
    }

    if (isPhotographerTimeDisabled(photographer, selectedTime)) {
      toast({
        title: "Time unavailable",
        description: "The selected photographer is booked or unavailable at that time.",
        variant: "destructive",
      });
      return;
    }
    setTime(selectedTime);
    setTempTime(selectedTime);

    if (formErrors['time']) {
      const { time: _, ...rest } = formErrors;
      setFormErrors(rest);
    }
  };

  const handlePhotographerDialogOpen = (open: boolean) => {
    // Prevent opening if time is not selected
    if (open && !time) {
      toast({
        title: "Select time first",
        description: "Please choose a time before selecting a photographer.",
        variant: "destructive",
      });
      return;
    }
    setPhotographerDialogOpen(open);
  };

  const handleConfirmPhotographer = () => {
    if (!photographer) {
      toast({
        title: "No photographer selected",
        description: "Please select a photographer before continuing.",
        variant: "destructive",
      });
      return;
    }

    setPhotographerDialogOpen(false);
  };

  const handleGetCurrentLocation = () => {
    if (!setAddress || !setCity || !setState || !setZip) {
      toast({
        title: "Cannot update location",
        description: "The location update functionality is not available.",
        variant: "destructive",
      });
      return;
    }

    setIsLocationLoading(true);

    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive",
      });
      setIsLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );

          if (!response.ok) {
            throw new Error('Failed to fetch address');
          }

          const data = await response.json();

          setAddress(data.principalSubdivision ? `${data.street || ''} ${data.housenumber || ''}`.trim() : 'Address not found');
          setCity(data.city || data.locality || '');
          setState(data.principalSubdivision || '');
          setZip(data.postcode || '');

          toast({
            title: "Location detected",
            description: "Your current location has been filled in the form.",
            variant: "default",
          });
        } catch (error) {
          console.error('Error fetching location data:', error);
          toast({
            title: "Location detection failed",
            description: "Could not retrieve your current location details.",
            variant: "destructive",
          });
        } finally {
          setIsLocationLoading(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = "Could not detect your location.";

        if (error.code === 1) {
          errorMessage = "Location permission denied. Please enable location access.";
        } else if (error.code === 2) {
          errorMessage = "Location unavailable. Please try again later.";
        } else if (error.code === 3) {
          errorMessage = "Location request timed out. Please try again.";
        }

        toast({
          title: "Location error",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const selectedPhotographer = photographers.find(p => p.id === photographer);
  const selectedPhotographerDetails = photographersWithDistance.find(
    (photographerItem) => String(photographerItem.id) === String(photographer)
  ) || selectedPhotographer;
  const fullAddress = address && city && state ? `${address}, ${city}, ${state}${zip ? ' ' + zip : ''}` : '';

  // Multi-photographer: group selected services by normalized category name
  // Normalizes similar names like "Photo"/"Photos" into a single group
  const serviceCategories = useMemo(() => {
    if (!selectedServices.length) return [];
    // Normalize category name: lowercase, strip trailing 's', trim
    const normalizeCatName = (name: string) => name.trim().toLowerCase().replace(/s$/, '');
    const groups: Record<string, { displayName: string; services: typeof selectedServices }> = {};
    for (const s of selectedServices) {
      const rawName = s.category?.name || 'Other';
      const key = normalizeCatName(rawName);
      if (!groups[key]) groups[key] = { displayName: rawName, services: [] };
      groups[key].services.push(s);
    }
    // Return as [categoryName, services[]] sorted alphabetically, "Other" last
    return Object.values(groups)
      .map(g => [g.displayName, g.services] as [string, typeof selectedServices])
      .sort(([a], [b]) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      });
  }, [selectedServices]);

  const isMultiCategory = serviceCategories.length > 1;

  // Which category is currently being assigned in the picker (null = default/single mode)
  const [activeCategoryForPicker, setActiveCategoryForPicker] = useState<string | null>(null);

  // Get category capability and legacy service IDs for the active category.
  const activeCategoryCapabilityForPicker = useMemo(() => {
    const empty = {
      categorySpecialtyId: '',
      categoryNameSpecialtyId: '',
      serviceIds: new Set<string>(),
    };
    if (!activeCategoryForPicker) return empty;
    const services = serviceCategories.find(([cat]) => cat === activeCategoryForPicker)?.[1] || [];
    if (!services.length) return empty;

    const firstService = services[0];
    const category = firstService.category || { name: activeCategoryForPicker };

    return {
      categorySpecialtyId: getCategorySpecialtyId(category),
      categoryNameSpecialtyId: getCategorySpecialtyId({ name: activeCategoryForPicker }),
      serviceIds: new Set(services.map(s => s.id)),
    };
  }, [activeCategoryForPicker, serviceCategories]);

  const photographerOptions = useMemo(() => {
    const byId = new Map<string, SchedulingPhotographer & Record<string, any>>();

    for (const photographerItem of photographersWithDistance) {
      byId.set(String(photographerItem.id), {
        ...photographerItem,
        id: String(photographerItem.id),
      });
    }

    for (const photographerItem of photographers) {
      const id = String(photographerItem.id);
      const enriched = byId.get(id);
      byId.set(id, {
        ...photographerItem,
        ...enriched,
        id,
      });
    }

    return Array.from(byId.values());
  }, [photographers, photographersWithDistance]);

  const buildTimeOptionsForRange = (intervalMinutes = 5, startHour = 8, endHour = 20) => {
    const options: string[] = [];
    for (let minutes = startHour * 60; minutes <= endHour * 60; minutes += intervalMinutes) {
      options.push(to12Hour(minutesToTime(minutes)));
    }
    return options;
  };

  const isTimeWithinSlots = (value: string, slots: Array<{ start_time?: string; end_time?: string }> = []) => {
    const minutes = timeToMinutes(value);
    return slots.some((slot) => {
      if (!slot.start_time || !slot.end_time) return false;
      const start = timeToMinutes(slot.start_time);
      const end = timeToMinutes(slot.end_time);
      return minutes >= start && minutes < end;
    });
  };

  const isTimeWithinBlockedSlots = (
    value: string,
    slots: Array<{ start_time?: string; end_time?: string }> = [],
    endBufferMinutes = 0,
  ) => {
    const minutes = timeToMinutes(value);
    return slots.some((slot) => {
      if (!slot.start_time || !slot.end_time) return false;
      const start = timeToMinutes(slot.start_time);
      const end = timeToMinutes(slot.end_time) + endBufferMinutes;
      return minutes >= start && minutes < end;
    });
  };

  const getPhotographerScheduleData = (photographerId?: string | number) => {
    if (!photographerId) return null;
    return photographerOptions.find((item) => String(item.id) === String(photographerId)) as any;
  };

  const isPhotographerTimeDisabled = (photographerId: string | number | undefined, value: string) => {
    const minutes = timeToMinutes(value);
    if (minutes < 8 * 60 || minutes > 20 * 60) return true;

    const photographerItem = getPhotographerScheduleData(photographerId);
    if (!photographerItem) return false;

    const bookedSlots = Array.isArray(photographerItem.bookedSlots) ? photographerItem.bookedSlots : [];
    const unavailableSlots = Array.isArray(photographerItem.unavailableSlots) ? photographerItem.unavailableSlots : [];
    if (isTimeWithinBlockedSlots(value, bookedSlots, 30) || isTimeWithinBlockedSlots(value, unavailableSlots)) return true;

    const netSlots = Array.isArray(photographerItem.netAvailableSlots) ? photographerItem.netAvailableSlots : [];
    if (netSlots.length > 0) return !isTimeWithinSlots(value, netSlots);

    return false;
  };

  const availableTimesForSelectedPhotographer = useMemo(
    () => buildTimeOptionsForRange(5).filter((option) => !isPhotographerTimeDisabled(photographer, option)),
    [photographer, photographerOptions]
  );

  const suggestedTimes = useMemo(() => {
    if (!date) return [];
    return buildTimeOptionsForRange(15).filter((option) => {
      const minutes = timeToMinutes(option);
      return minutes >= 8 * 60 && minutes <= 20 * 60 && !isPhotographerTimeDisabled(photographer, option);
    });
  }, [date, photographer, photographerOptions]);

  const updateSuggestedTimesScrollState = React.useCallback(() => {
    const element = suggestedTimesRailRef.current;
    if (!element) {
      setCanScrollSuggestedTimesLeft(false);
      setCanScrollSuggestedTimesRight(false);
      return;
    }
    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    setCanScrollSuggestedTimesLeft(element.scrollLeft > 2);
    setCanScrollSuggestedTimesRight(element.scrollLeft < maxScrollLeft - 2);
  }, []);

  const handleSuggestedTimesWheel = React.useCallback((event: WheelEvent) => {
    const element = suggestedTimesRailRef.current;
    if (!element) return;
    if (element.scrollWidth <= element.clientWidth) return;
    event.preventDefault();
    event.stopPropagation();
    const scrollDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    element.scrollLeft += scrollDelta;
    window.requestAnimationFrame(updateSuggestedTimesScrollState);
  }, [updateSuggestedTimesScrollState]);

  const scrollSuggestedTimesBy = React.useCallback((direction: 'left' | 'right') => {
    const element = suggestedTimesRailRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction === 'left' ? -Math.max(240, element.clientWidth * 0.8) : Math.max(240, element.clientWidth * 0.8),
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    if (!date || suggestedTimes.length === 0) return;
    if (time && !isPhotographerTimeDisabled(photographer, time)) return;

    const firstAvailableTime = suggestedTimes[0];
    setTime(firstAvailableTime);
    setTempTime(firstAvailableTime);
    setFormErrors((previousErrors) => {
      if (!previousErrors.time) return previousErrors;
      const { time: _, ...rest } = previousErrors;
      return rest;
    });
  }, [date, photographer, setFormErrors, setTime, suggestedTimes, time]);

  useEffect(() => {
    updateSuggestedTimesScrollState();
  }, [suggestedTimes, updateSuggestedTimesScrollState]);

  useEffect(() => {
    const element = suggestedTimesRailRef.current;
    if (!element) return;
    element.addEventListener('wheel', handleSuggestedTimesWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleSuggestedTimesWheel);
    };
  }, [handleSuggestedTimesWheel, suggestedTimes]);

  useEffect(() => {
    const element = suggestedTimesRailRef.current;
    if (!element) return;
    const selectedButton = element.querySelector<HTMLButtonElement>(`[data-suggested-time="${time}"]`);
    selectedButton?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    window.requestAnimationFrame(updateSuggestedTimesScrollState);
  }, [suggestedTimes, time, updateSuggestedTimesScrollState]);

  const buildConflictAwareServiceTimeOptions = (photographerId: string | number | undefined, ensure?: string | null) =>
    buildServiceTimeOptions(ensure).map((option) => ({
      ...option,
      disabled: isPhotographerTimeDisabled(photographerId, option.value),
    }));

  // Filter photographers to only those whose specialties match the active category's services
  const filteredPhotographersForCategory = useMemo(() => {
    if (!isMultiCategory || activeCategoryCapabilityForPicker.serviceIds.size === 0) return null; // null = no filtering
    return photographerOptions.filter(p => {
      const specialties: string[] = (p as any).metadata?.specialties
        || (p as any).specialties
        || [];
      if (!specialties.length) return true; // No specialties defined = show (can do anything)
      return hasCategorySpecialty(
        specialties,
        activeCategoryCapabilityForPicker.categorySpecialtyId,
        activeCategoryCapabilityForPicker.categoryNameSpecialtyId,
        activeCategoryCapabilityForPicker.serviceIds,
      );
    });
  }, [isMultiCategory, activeCategoryCapabilityForPicker, photographerOptions]);

  // Helper: get photographer ID for a category (from servicePhotographers map)
  const getPhotographerForCategory = (categoryName: string): string => {
    const servicesInCategory = serviceCategories.find(([cat]) => cat === categoryName)?.[1] || [];
    // Return the photographer assigned to the first service in this category
    for (const s of servicesInCategory) {
      if (servicePhotographers[s.id]) return servicePhotographers[s.id];
    }
    return '';
  };

  // Helper: get photographer details for a category
  const getPhotographerDetailsForCategory = (categoryName: string) => {
    const photographerId = getPhotographerForCategory(categoryName);
    if (!photographerId) return null;
    return photographersWithDistance.find(p => String(p.id) === String(photographerId))
      || photographers.find(p => String(p.id) === String(photographerId))
      || null;
  };

  // Modified confirm handler for multi-category mode
  const handleConfirmCategoryPhotographer = () => {
    if (!photographer || !activeCategoryForPicker || !setServicePhotographers) {
      setPhotographerDialogOpen(false);
      return;
    }
    // Assign this photographer to all services in the active category
    const servicesInCategory = serviceCategories.find(([cat]) => cat === activeCategoryForPicker)?.[1] || [];
    setServicePhotographers(prev => {
      const next = { ...prev };
      for (const s of servicesInCategory) {
        next[s.id] = photographer;
      }
      return next;
    });
    setPhotographerDialogOpen(false);
    setActiveCategoryForPicker(null);
    // Also set the first category's photographer as the default/fallback photographer
    if (!selectedPhotographer) {
      setPhotographer?.(photographer);
    }
  };

  // Fetch comprehensive photographer data when booking location, photographers, date, or time change
  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();

    const computeDistancesFromProfiles = async () => {
      const hasBookingAddress = [address, city, state, zip].some(value => Boolean(value && String(value).trim()));
      if (!hasBookingAddress || photographers.length === 0) return;

      setIsCalculatingDistances(true);

      const bookingKey = normalizeAddressKey({ address, city, state, zip });
      let bookingCoords: { lat: number; lon: number } | null = null;
      try {
        bookingCoords = await getCoordinatesFromAddress(address, city, state, zip || '');
      } catch {
        bookingCoords = null;
      }
      if (isCancelled) return;

      // Seed list with known 0-mile matches by normalized address
      setPhotographersWithDistance(
        photographers.map((p: any) => {
          const pKey = normalizeAddressKey({ address: p.address, city: p.city, state: p.state, zip: p.zip });
          const directMatch = Boolean(bookingKey && pKey && bookingKey === pKey);
          return {
            ...p,
            distance: directMatch ? 0 : undefined,
          };
        })
      );

      if (!bookingCoords) {
        setIsCalculatingDistances(false);
        return;
      }

      for (const p of photographers as any[]) {
        if (isCancelled) return;
        const hasOriginAddress = [p.address, p.city, p.state, p.zip].some(value => Boolean(value && String(value).trim()));
        if (!hasOriginAddress) continue;

        const pKey = normalizeAddressKey({ address: p.address, city: p.city, state: p.state, zip: p.zip });
        if (bookingKey && pKey && bookingKey === pKey) {
          setPhotographersWithDistance((prev) => prev.map((ph: any) => (String(ph.id) === String(p.id) ? { ...ph, distance: 0 } : ph)));
          continue;
        }

        try {
          const originCoords = await getCoordinatesFromAddress(p.address, p.city, p.state, p.zip || '');
          if (!originCoords || isCancelled) continue;
          const distance = calculateDistance(
            bookingCoords.lat,
            bookingCoords.lon,
            originCoords.lat,
            originCoords.lon
          );
          if (!isCancelled && Number.isFinite(distance)) {
            setPhotographersWithDistance((prev) =>
              prev.map((ph: any) => (String(ph.id) === String(p.id) ? { ...ph, distance } : ph))
            );
          }
        } catch {
          // ignore individual geocode failures
        }
      }

      if (!isCancelled) setIsCalculatingDistances(false);
    };
    
    const fetchPhotographerData = async () => {
      const hasBookingAddress = [address, city, state, zip].some(value => Boolean(value && String(value).trim()));
      console.log('[SchedulingForm] fetchPhotographerData called:', {
        hasBookingAddress,
        address,
        city,
        state,
        zip,
        photographersCount: photographers.length,
        date: date ? format(date, 'yyyy-MM-dd') : null,
        time,
      });
      if (photographers.length === 0 || !date) {
        setPhotographersWithDistance(photographers.map(p => ({ ...p })));
        setPhotographerAvailability(new Map());
        setIsCalculatingDistances(false);
        setIsLoadingAvailability(false);
        return;
      }

      setIsLoadingAvailability(true);

      if (!hasBookingAddress) {
        setIsCalculatingDistances(false);
        setPhotographerAvailability(new Map());
        setPhotographersWithDistance(photographers.map(p => ({ ...p })));
        try {
          const token = localStorage.getItem('authToken');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          // Fetch raw availability from bulkIndex (same as Availability page)
          const bulkResponse = await fetch(API_ROUTES.photographerAvailability.bulkIndex, {
            method: 'POST',
            headers,
            signal: abortController.signal,
            body: JSON.stringify({
              photographer_ids: photographers.map(p => Number(p.id)),
              from_date: format(date, 'yyyy-MM-dd'),
              to_date: format(date, 'yyyy-MM-dd'),
            }),
          });

          if (!bulkResponse.ok) {
            throw new Error('Failed to fetch availability');
          }

          const bulkJson = await bulkResponse.json();
          const rawAvailabilityByPhotographer: Record<string, any[]> = bulkJson?.data || {};

          console.log('[SchedulingForm] No-address bulkIndex response:', {
            rawData: rawAvailabilityByPhotographer,
            photographerIds: photographers.map(p => p.id),
            date: format(date, 'yyyy-MM-dd'),
          });

          // Process raw availability to get slots for the selected date
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

          const availabilityMap = new Map<string | number, { isAvailable: boolean; nextAvailableTimes: string[] }>();
          const updatedPhotographers = photographers.map((p) => {
            const rawSlots = rawAvailabilityByPhotographer[p.id] || rawAvailabilityByPhotographer[String(p.id)] || [];
            
            console.log('[SchedulingForm] No-address processing:', {
              photographerId: p.id,
              rawSlotsCount: rawSlots.length,
              dayOfWeek,
              dateStr,
            });
            
            // Filter slots: specific date slots OR recurring weekly slots for this day
            const specificDateSlots = rawSlots.filter((s: any) => s.date === dateStr);
            const weeklySlots = rawSlots.filter((s: any) => 
              !s.date && s.day_of_week?.toLowerCase() === dayOfWeek
            );
            
            // Use specific date slots if available, otherwise fall back to weekly recurring
            const relevantSlots = specificDateSlots.length > 0 ? specificDateSlots : weeklySlots;
            
            // Filter to available slots only (not unavailable)
            const availableSlots = relevantSlots
              .filter((s: any) => !s.status || s.status === 'available')
              .map((s: any) => ({
                start_time: s.start_time,
                end_time: s.end_time,
              }));

            const nextTimes = availableSlots.slice(0, 3).map((slot: any) => to12Hour(slot.start_time));
            const isAvailable = availableSlots.length > 0;

            availabilityMap.set(p.id, { isAvailable, nextAvailableTimes: nextTimes });
            availabilityMap.set(String(p.id), { isAvailable, nextAvailableTimes: nextTimes });
            availabilityMap.set(Number(p.id), { isAvailable, nextAvailableTimes: nextTimes });

            return {
              ...p,
              availabilitySlots: availableSlots,
              netAvailableSlots: availableSlots,
              hasAvailability: isAvailable,
            };
          });

          setPhotographersWithDistance(updatedPhotographers);
          setPhotographerAvailability(availabilityMap);
        } catch (error: any) {
          if (error.name === 'AbortError' || isCancelled) return;
          console.error('Error fetching fallback availability:', error);
          setPhotographersWithDistance(photographers.map(p => ({ ...p })));
        } finally {
          setIsLoadingAvailability(false);
        }
        return;
      }

      // Create a unique key for this request to detect stale data
      const requestKey = `${format(date, 'yyyy-MM-dd')}-${time}-${address}`;
      
      setIsCalculatingDistances(true);
      // Clear old data when date/time changes
      setPhotographersWithDistance([]);
      setPhotographerAvailability(new Map());
      
      try {
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Use the new comprehensive endpoint
        const response = await fetch(API_ROUTES.photographerAvailability.forBooking, {
          method: 'POST',
          headers,
          signal: abortController.signal,
          body: JSON.stringify({
            date: format(date, 'yyyy-MM-dd'),
            time: time || undefined,
            shoot_address: address,
            shoot_city: city,
            shoot_state: state,
            shoot_zip: zip || '',
            photographer_ids: photographers.map(p => Number(p.id)),
          }),
        });
        
        if (isCancelled) return;

        if (!response.ok) {
          throw new Error('Failed to fetch photographer data');
        }

        const json = await response.json();
        const photographerData = json?.data || [];

        // First, show photographers immediately WITHOUT distance (fast)
        const initialPhotographers = photographerData.map((p: any) => {
          const photographer = photographers.find(ph => String(ph.id) === String(p.id));
          const parsedDistance = typeof p.distance === 'number'
            ? p.distance
            : p.distance
            ? Number.parseFloat(String(p.distance))
            : undefined;
          return {
            id: String(p.id),
            name: p.name || photographer?.name || '',
            avatar: p.avatar || p.profile_image || p.photo || photographer?.avatar,
            distance: Number.isFinite(parsedDistance as number) ? parsedDistance : undefined,
            address: photographer?.address,
            city: photographer?.city,
            state: photographer?.state,
            zip: photographer?.zip,
            availabilitySlots: p.availability_slots,
            unavailableSlots: p.unavailable_slots,
            bookedSlots: p.booked_slots,
            netAvailableSlots: p.net_available_slots,
            isAvailableAtTime: p.is_available_at_time,
            hasAvailability: p.has_availability,
            shootsCountToday: p.shoots_count_today,
            distanceFrom: p.distance_from,
            previousShootId: p.previous_shoot_id,
            travel_range: (photographer as any)?.travel_range ?? null,
            travel_range_unit: (photographer as any)?.travel_range_unit ?? 'miles',
          };
        });

        // Also fetch raw availability slots from bulkIndex (same as Availability page)
        // This ensures the bars show the same data as the Availability page
        let rawAvailabilityByPhotographer: Record<string, any[]> = {};
        try {
          const bulkResponse = await fetch(API_ROUTES.photographerAvailability.bulkIndex, {
            method: 'POST',
            headers,
            signal: abortController.signal,
            body: JSON.stringify({
              photographer_ids: photographers.map(p => Number(p.id)),
              from_date: format(date, 'yyyy-MM-dd'),
              to_date: format(date, 'yyyy-MM-dd'),
            }),
          });
          if (bulkResponse.ok) {
            const bulkJson = await bulkResponse.json();
            rawAvailabilityByPhotographer = bulkJson?.data || {};
            console.log('[SchedulingForm] bulkIndex response:', {
              rawData: rawAvailabilityByPhotographer,
              photographerIds: photographers.map(p => p.id),
              date: format(date, 'yyyy-MM-dd'),
            });
          } else {
            console.error('[SchedulingForm] bulkIndex failed:', bulkResponse.status, bulkResponse.statusText);
          }
        } catch (e) {
          console.error('[SchedulingForm] Error fetching bulk availability:', e);
        }

        // Process raw availability to get slots for the selected date
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        const enrichedPhotographers = initialPhotographers.map((p: any) => {
          const rawSlots = rawAvailabilityByPhotographer[p.id] || rawAvailabilityByPhotographer[String(p.id)] || [];
          
          // Log raw slot structure to debug day_of_week matching
          if (rawSlots.length > 0) {
            const daysInSlots = rawSlots.map((s: any) => s.day_of_week);
            console.log('[SchedulingForm] Raw slots sample for', p.name, ':', {
              firstSlot: JSON.stringify(rawSlots[0]),
              allDaysOfWeek: JSON.stringify(daysInSlots),
              lookingFor: dayOfWeek,
              hasMatchingDay: daysInSlots.some((d: string) => d?.toLowerCase() === dayOfWeek),
            });
          }
          
          // Filter slots: specific date slots OR recurring weekly slots for this day
          const specificDateSlots = rawSlots.filter((s: any) => {
            const slotDate = s?.date ? String(s.date).slice(0, 10) : '';
            return slotDate === dateStr;
          });
          const weeklySlots = rawSlots.filter((s: any) => {
            const slotDate = s?.date ? String(s.date).trim() : '';
            if (slotDate) return false;
            return normalizeDayOfWeek(s?.day_of_week) === dayOfWeek;
          });
          
          // Use specific date slots if available, otherwise fall back to weekly recurring
          const relevantSlots = specificDateSlots.length > 0 ? specificDateSlots : weeklySlots;
          
          // Filter to available slots only (not unavailable)
          const availableSlots = relevantSlots
            .filter((s: any) => !s.status || s.status === 'available')
            .map((s: any) => ({
              start_time: s.start_time,
              end_time: s.end_time,
            }));

          console.log('[SchedulingForm] Processing photographer:', {
            id: p.id,
            name: p.name,
            rawSlotsCount: rawSlots.length,
            dayOfWeek,
            specificDateSlotsCount: specificDateSlots.length,
            weeklySlotsCount: weeklySlots.length,
            availableSlotsCount: availableSlots.length,
            availableSlots,
          });

          return {
            ...p,
            availabilitySlots: availableSlots,
            netAvailableSlots: availableSlots.length > 0 ? availableSlots : p.netAvailableSlots,
          };
        });

        setPhotographersWithDistance(enrichedPhotographers);
        setIsCalculatingDistances(false); // Show list immediately

        // Update availability map
        const availabilityMap = new Map<string | number, { isAvailable: boolean; nextAvailableTimes: string[] }>();
        enrichedPhotographers.forEach((p: any) => {
          const slots = p.availabilitySlots || p.netAvailableSlots || [];
          const nextTimes = slots
            .slice(0, 3)
            .map((slot: any) => to12Hour(slot.start_time));
          const isAvailable = slots.length > 0 || p.isAvailableAtTime;
          
          availabilityMap.set(p.id, { isAvailable: isAvailable ?? false, nextAvailableTimes: nextTimes });
          availabilityMap.set(String(p.id), { isAvailable: isAvailable ?? false, nextAvailableTimes: nextTimes });
          availabilityMap.set(Number(p.id), { isAvailable: isAvailable ?? false, nextAvailableTimes: nextTimes });
        });
        setPhotographerAvailability(availabilityMap);
        setIsLoadingAvailability(false);

        // Then calculate distances asynchronously in background
        const bookingCoords = await getCoordinatesFromAddress(address, city, state, zip || '');
        if (!bookingCoords || isCancelled) return;

        // Calculate distances one by one and update state progressively
        for (const p of photographerData) {
          if (isCancelled) return; // Stop if cancelled
          const photographer = photographers.find(ph => String(ph.id) === String(p.id));
          const parsedDistance = typeof p.distance === 'number'
            ? p.distance
            : p.distance
            ? Number.parseFloat(String(p.distance))
            : undefined;
          if (Number.isFinite(parsedDistance as number)) {
            continue;
          }

          const originAddress = photographer?.address || '';
          const originCity = photographer?.city || '';
          const originState = photographer?.state || '';
          const originZip = photographer?.zip || '';
          const hasOriginAddress = [originAddress, originCity, originState, originZip].some(value => Boolean(value && String(value).trim()));
          if (hasOriginAddress) {
            const originCoords = await getCoordinatesFromAddress(
              originAddress,
              originCity,
              originState,
              originZip || ''
            );
            if (originCoords && !isCancelled) {
              const distance = calculateDistance(
                bookingCoords.lat,
                bookingCoords.lon,
                originCoords.lat,
                originCoords.lon
              );
              // Update this photographer's distance
              setPhotographersWithDistance(prev => 
                prev.map(ph => ph.id === String(p.id) ? { ...ph, distance } : ph)
              );
            }
          }
        }

      } catch (error: any) {
        if (error.name === 'AbortError' || isCancelled) return;
        console.error('Error fetching photographer data:', error);
        setPhotographersWithDistance(photographers.map(p => ({ ...p })));
        setIsCalculatingDistances(false);
        setIsLoadingAvailability(false);

        // Fallback: compute distance from photographers' saved profile address
        computeDistancesFromProfiles();
      }
    };

    fetchPhotographerData();
    
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [address, city, state, zip, photographers, date, time]);

  // Filter and sort photographers
  const filteredAndSortedPhotographers = useMemo(() => {
    let filtered = showAllPhotographers
      ? photographerOptions
      : photographersWithDistance.length > 0
        ? photographersWithDistance
        : photographerOptions;

    const selectedTimeMinutes = time ? timeToMinutes(time) : null;
    const getAvailabilityMetrics = (photographerItem: any) => {
      const rawSlots = Array.isArray(photographerItem.netAvailableSlots) && photographerItem.netAvailableSlots.length > 0
        ? photographerItem.netAvailableSlots
        : Array.isArray(photographerItem.availabilitySlots)
        ? photographerItem.availabilitySlots
        : [];
      const slots = rawSlots
        .map((slot: any) => ({
          start: timeToMinutes(slot.start_time),
          end: timeToMinutes(slot.end_time),
        }))
        .filter((slot) => Number.isFinite(slot.start) && Number.isFinite(slot.end) && slot.end > slot.start);
      const availability = photographerAvailability.get(photographerItem.id)
        || photographerAvailability.get(String(photographerItem.id))
        || photographerAvailability.get(Number(photographerItem.id));
      const availableAtSelectedTime = selectedTimeMinutes !== null
        ? slots.some((slot) => slot.start <= selectedTimeMinutes && slot.end > selectedTimeMinutes)
        : false;
      const firstStart = slots.length > 0 ? Math.min(...slots.map((slot) => slot.start)) : Number.POSITIVE_INFINITY;
      const totalMinutes = slots.reduce((total, slot) => total + (slot.end - slot.start), 0);
      const isAvailable = selectedTimeMinutes !== null
        ? availableAtSelectedTime || Boolean(photographerItem.isAvailableAtTime)
        : slots.length > 0 || Boolean(availability?.isAvailable || photographerItem.hasAvailability);

      return {
        isAvailable,
        availableAtSelectedTime,
        firstStart,
        totalMinutes,
      };
    };

    if (!showAllPhotographers && (date || time || photographerAvailability.size > 0)) {
      filtered = filtered.filter((photographerItem) => getAvailabilityMetrics(photographerItem).isAvailable);
    }

    // Multi-category mode: filter by specialties for the active category
    if (isMultiCategory && activeCategoryForPicker && activeCategoryCapabilityForPicker.serviceIds.size > 0) {
      const allowedIds = filteredPhotographersForCategory
        ? new Set(filteredPhotographersForCategory.map(p => String(p.id)))
        : null;
      if (allowedIds) {
        filtered = filtered.filter(p => allowedIds.has(String(p.id)));
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p as any).city?.toLowerCase().includes(query) ||
        (p as any).state?.toLowerCase().includes(query)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      const aDistance = (a as any).distance;
      const bDistance = (b as any).distance;
      const compareDistance = () => {
        if (aDistance === undefined && bDistance === undefined) return 0;
        if (aDistance === undefined) return 1;
        if (bDistance === undefined) return -1;
        return aDistance - bDistance;
      };

      if (sortBy === 'availability') {
        const aMetrics = getAvailabilityMetrics(a);
        const bMetrics = getAvailabilityMetrics(b);

        if (aMetrics.availableAtSelectedTime !== bMetrics.availableAtSelectedTime) {
          return aMetrics.availableAtSelectedTime ? -1 : 1;
        }
        if (aMetrics.totalMinutes !== bMetrics.totalMinutes) return bMetrics.totalMinutes - aMetrics.totalMinutes;
        if (aMetrics.firstStart !== bMetrics.firstStart) return aMetrics.firstStart - bMetrics.firstStart;
        const distanceCompare = compareDistance();
        return distanceCompare !== 0 ? distanceCompare : a.name.localeCompare(b.name);
      }

      const distanceCompare = compareDistance();
      return distanceCompare !== 0 ? distanceCompare : a.name.localeCompare(b.name);
    });

    return sorted;
  }, [photographersWithDistance, photographerOptions, searchQuery, sortBy, showAllPhotographers, photographerAvailability, date, time, isMultiCategory, activeCategoryForPicker, activeCategoryCapabilityForPicker, filteredPhotographersForCategory]);

  const renderPhotographerFilters = (mobileDrawer = false) => (
    <div className={cn("space-y-3", mobileDrawer && "space-y-2") }>
      <div className={cn("flex items-center gap-2", mobileDrawer && "flex-col items-stretch") }>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("pl-9 h-9 rounded-full bg-slate-50 dark:bg-slate-900/50", mobileDrawer && "h-10")}
          />
        </div>

        <div
          className={cn(
            "flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            mobileDrawer && "-mx-1 px-1"
          )}
        >
          <button
            type="button"
            onClick={() => {
              setSortBy('distance');
            }}
            className={cn(
              "shrink-0 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors",
              sortBy === 'distance'
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60"
            )}
          >
            Distance
          </button>

          <button
            type="button"
            onClick={() => {
              setSortBy('availability');
            }}
            className={cn(
              "shrink-0 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors",
              sortBy === 'availability'
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60"
            )}
          >
            Availability
          </button>

          <button
            type="button"
            onClick={() => setShowAllPhotographers(!showAllPhotographers)}
            className={cn(
              "shrink-0 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors",
              showAllPhotographers
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60"
            )}
          >
            Show All
          </button>
        </div>
      </div>
    </div>
  );

  const renderPhotographerResults = (mobileDrawer = false) => {
    if (isCalculatingDistances) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Calculating distances...</span>
        </div>
      );
    }

    if (isLoadingAvailability && date && time) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Checking availability...</span>
        </div>
      );
    }

    if (!filteredAndSortedPhotographers.length) {
      return (
        <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
          {searchQuery
            ? 'No photographers found matching your search.'
            : showAllPhotographers
              ? 'No photographers found in the system.'
              : (
                <div className="space-y-2">
                  <p>No photographers available for the selected date and time.</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setShowAllPhotographers(true)}
                    className="text-blue-600"
                  >
                    Show all photographers
                  </Button>
                </div>
              )}
        </div>
      );
    }

    return (
      <div className={cn("grid", mobileDrawer ? "gap-2.5 pb-1 px-0.5" : "gap-3") }>
        {filteredAndSortedPhotographers.map((photographerItem) => {
          const isSelected = photographer === photographerItem.id;
          const locationLabel = formatLocationLabel({
            address: photographerItem.address,
            city: photographerItem.city,
            state: photographerItem.state,
            zip: photographerItem.zip,
          });

          const availabilitySource = (photographerItem.netAvailableSlots && photographerItem.netAvailableSlots.length > 0)
            ? photographerItem.netAvailableSlots
            : photographerItem.availabilitySlots || [];
          const availabilityScaleStartMinutes = 8 * 60;
          const availabilityScaleEndMinutes = 20 * 60;
          const availabilityScaleTotalMinutes = Math.max(1, availabilityScaleEndMinutes - availabilityScaleStartMinutes);
          const availabilityScaleTickCount = 11;
          const clampTimelineSlot = (slot: any) => {
            const startMinutes = Math.max(availabilityScaleStartMinutes, timeToMinutes(slot.start_time));
            const endMinutes = Math.min(availabilityScaleEndMinutes, timeToMinutes(slot.end_time));
            if (endMinutes <= startMinutes) return null;

            return {
              ...slot,
              start_time: minutesToTime(startMinutes),
              end_time: minutesToTime(endMinutes),
            };
          };

          const availabilitySlots = availabilitySource
            .map((slot) => ({
              start_time: normalizeSlotTime(slot.start_time),
              end_time: normalizeSlotTime(slot.end_time),
            }))
            .filter((slot) => slot.start_time && slot.end_time)
            .map(clampTimelineSlot)
            .filter(Boolean);
          const unavailableSlots = ((photographerItem as any).unavailableSlots || [])
            .map((slot: any) => ({
              start_time: normalizeSlotTime(slot.start_time),
              end_time: normalizeSlotTime(slot.end_time),
            }))
            .filter((slot: any) => slot.start_time && slot.end_time)
            .map(clampTimelineSlot)
            .filter(Boolean);
          const bookedSlots = ((photographerItem as any).bookedSlots || [])
            .map((slot: any) => ({
              start_time: normalizeSlotTime(slot.start_time),
              end_time: normalizeSlotTime(slot.end_time),
              status: slot.status,
              shoot_id: slot.shoot_id,
              address: slot.address,
              city: slot.city,
              state: slot.state,
              zip: slot.zip,
            }))
            .filter((slot: any) => slot.start_time && slot.end_time)
            .map(clampTimelineSlot)
            .filter(Boolean);
          const distanceMiles = typeof (photographerItem as any).distance === 'number' && Number.isFinite((photographerItem as any).distance)
            ? (photographerItem as any).distance
            : null;
          const distanceLabel = distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi` : null;
          const distanceFromLabel = (photographerItem as any).distanceFrom === 'previous_shoot'
            ? 'from previous shoot'
            : 'from home';
          const getLocationInitials = (slot: any) => {
            const parts = [slot.address, slot.city, slot.state]
              .filter(Boolean)
              .flatMap((value) => String(value).split(/\s+/))
              .map((part) => part.replace(/[^a-z0-9]/gi, ''))
              .filter(Boolean);
            return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
          };
          const renderTimelineSlot = (
            slot: any,
            key: string,
            className: string,
            label: string,
          ) => {
            const startMinutes = timeToMinutes(slot.start_time);
            const endMinutes = timeToMinutes(slot.end_time);
            const leftPercent = ((startMinutes - availabilityScaleStartMinutes) / availabilityScaleTotalMinutes) * 100;
            const widthPercent = ((endMinutes - startMinutes) / availabilityScaleTotalMinutes) * 100;
            const clampedLeft = Math.max(0, Math.min(100, leftPercent));
            const clampedWidth = Math.max(2, Math.min(100 - clampedLeft, widthPercent));

            if (clampedWidth <= 0) return null;

            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <span
                    className={className}
                    style={{ left: `${clampedLeft}%`, width: `${clampedWidth}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] whitespace-nowrap px-2 py-1 text-xs">
                  {label}{slot.address ? ` · ${getLocationInitials(slot)}` : ''} · {to12Hour(slot.start_time)}-{to12Hour(slot.end_time)}
                </TooltipContent>
              </Tooltip>
            );
          };

          return (
            <button
              key={photographerItem.id}
              type="button"
              onClick={() => setPhotographer?.(photographerItem.id)}
              className={cn(
                "w-full max-w-full min-w-0 text-left border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                mobileDrawer ? "rounded-xl px-3 py-2.5" : "rounded-2xl px-4 py-3",
                isSelected
                  ? "border-blue-500/70 bg-blue-50/60 dark:border-blue-500/50 dark:bg-blue-950/30"
                  : "border-slate-200/70 bg-white/70 dark:border-slate-800/70 dark:bg-slate-900/40 hover:border-blue-400/50"
              )}
            >
              <div className={cn("flex min-w-0 items-center", mobileDrawer ? "gap-3" : "gap-4") }>
                <Avatar
                  className={cn(
                    mobileDrawer ? "h-10 w-10 flex-shrink-0" : "h-11 w-11 flex-shrink-0",
                    isSelected && "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                  )}
                >
                  <AvatarImage
                    src={getAvatarUrl(photographerItem.avatar, 'photographer', undefined, photographerItem.id)}
                    alt={photographerItem.name}
                  />
                  <AvatarFallback>{photographerItem.name?.charAt(0)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn("font-semibold text-slate-900 dark:text-slate-100 truncate", mobileDrawer ? "text-base" : "text-sm") }>
                      {photographerItem.name}
                    </p>
                    {distanceLabel ? (
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                              {distanceLabel}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="px-2 py-1 text-xs">
                            Distance to shoot {distanceFromLabel}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                    {(() => {
                      const travelRange = (photographerItem as any).travel_range ?? (photographerItem as any).metadata?.travel_range;
                      const travelUnit = (photographerItem as any).travel_range_unit ?? (photographerItem as any).metadata?.travel_range_unit ?? 'miles';
                      const dist = (photographerItem as any).distance;
                      if (travelRange != null && dist != null && Number.isFinite(dist)) {
                        // Convert travel range to miles for comparison if in km
                        const rangeInMiles = travelUnit === 'km' ? travelRange * 0.621371 : travelRange;
                        if (dist > rangeInMiles) {
                          return (
                            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              Out of range
                            </span>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>

                  <p className={cn("truncate text-slate-500 dark:text-slate-400", mobileDrawer ? "mt-0.5 text-sm" : "mt-0.5 text-xs") }>
                    {locationLabel || 'Location unavailable'}
                  </p>

                  <TooltipProvider delayDuration={100}>
                    <div className={cn("relative h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden", mobileDrawer ? "mt-1.5" : "mt-2") }>
                      {availabilitySlots.map((slot, index) => renderTimelineSlot(
                        slot,
                        `${photographerItem.id}-slot-${index}`,
                        "absolute top-0 bottom-0 rounded-full bg-blue-500 dark:bg-blue-400",
                        "Available"
                      ))}
                      {bookedSlots.map((slot: any, index: number) => renderTimelineSlot(
                        slot,
                        `${photographerItem.id}-booked-${index}`,
                        "absolute top-0 bottom-0 rounded-full bg-blue-900 dark:bg-blue-700",
                        "Booked"
                      ))}
                      {unavailableSlots.map((slot: any, index: number) => renderTimelineSlot(
                        slot,
                        `${photographerItem.id}-unavailable-${index}`,
                        "absolute top-0 bottom-0 rounded-full bg-red-500 dark:bg-red-500",
                        "Unavailable"
                      ))}
                    </div>
                    {availabilitySlots.length > 0 ? (
                      <div className="mt-1 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        <span className="shrink-0">8 AM</span>
                        <div className="flex flex-1 items-center justify-between px-1">
                          {Array.from({ length: availabilityScaleTickCount }).map((_, index) => {
                            const tickMinutes = availabilityScaleStartMinutes + Math.round(((index + 1) * availabilityScaleTotalMinutes) / (availabilityScaleTickCount + 1));
                            return (
                              <Tooltip key={`${photographerItem.id}-scale-${index}`}>
                                <TooltipTrigger asChild>
                                  <span className="h-1.5 w-px bg-slate-300/80 dark:bg-slate-600/80" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="px-2 py-1 text-xs">
                                  {to12Hour(minutesToTime(tickMinutes))}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                        <span className="shrink-0">8 PM</span>
                      </div>
                    ) : null}
                  </TooltipProvider>
                </div>

                <span
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center rounded-full border",
                    isSelected
                      ? "h-8 w-8 border-blue-600 bg-blue-600 text-white"
                      : "h-8 w-8 border-slate-300/80 dark:border-slate-700/80"
                  )}
                >
                  {isSelected ? <Check className="h-4 w-4" /> : null}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const photographerTrigger = (
    <div
      className={cn(
        "bg-gray-50 dark:bg-card/60 rounded-lg p-3 sm:p-4 flex justify-between items-center transition-colors border border-gray-100 dark:border-muted/40",
        time ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-card/70" : "opacity-60 cursor-not-allowed"
      )}
      onClick={() => {
        if (!time) {
          toast({
            title: "Select time first",
            description: "Please choose a time before selecting a photographer.",
            variant: "destructive",
          });
          return;
        }
        setPhotographerDialogOpen(true);
      }}
    >
      <div className="flex items-center min-w-0">
        {selectedPhotographer ? (
          <>
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 mr-3 sm:mr-4 shrink-0">
              <AvatarImage
                src={getAvatarUrl(selectedPhotographer.avatar, 'photographer', undefined, selectedPhotographer.id)}
                alt={selectedPhotographer.name}
              />
              <AvatarFallback>{selectedPhotographer.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-base sm:text-xl font-semibold text-slate-900 dark:text-white">{selectedPhotographer.name}</span>
          </>
        ) : (
          <span className="truncate text-slate-500 dark:text-slate-400">Select a photographer</span>
        )}
      </div>
      <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-slate-400 shrink-0" />
    </div>
  );

  // NOTE: Removed redundant fetchAvailability useEffect that was calling a separate API
  // which didn't account for booked slots. The fetchPhotographerData above already 
  // calls the for-booking endpoint which returns correct is_available_at_time 
  // that accounts for existing bookings.
  return (
    <div className="space-y-5 sm:space-y-6 text-slate-900 dark:text-slate-100">
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {/* Date Selection Section */}
        <div className="bg-white dark:bg-card/40 rounded-2xl p-3 sm:p-6 space-y-3 sm:space-y-4 border border-slate-200 dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Select Date</h2>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {date ? format(date, "MMMM d, yyyy") : "Choose a date"}
            </span>
          </div>

          <div className="rounded-lg border border-gray-100 dark:border-muted/40 bg-gray-50 dark:bg-card/40 p-2.5 sm:p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={onDateChange}
              disabled={disabledDates}
              defaultMonth={date ?? today}
              fromMonth={today}
              className="border-none bg-transparent p-0 pointer-events-auto"
              classNames={{
                caption: "relative flex items-center justify-center",
                caption_label: "text-base font-semibold",
                nav: "absolute inset-y-0 w-full flex items-center justify-between",
                nav_button: "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100",
                nav_button_previous: "static",
                nav_button_next: "static",
                head_cell: "text-slate-500 rounded-md w-full font-medium text-xs sm:text-sm flex-1 text-center",
                day: "h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full text-sm sm:text-base font-medium aria-selected:opacity-100",
                day_selected: "bg-primary text-primary-foreground rounded-full",
                day_today: "bg-accent text-accent-foreground rounded-full",
                cell: "relative p-0 text-center text-sm sm:text-base focus-within:relative focus-within:z-20 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md flex-1",
              }}
            />
          </div>

          {formErrors['date'] && (
            <p className="text-sm font-medium text-destructive mt-1">{formErrors['date']}</p>
          )}
        </div>

        {sameDayAddressWarningMessage && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 shadow-sm dark:text-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600 dark:text-amber-300" />
              <p className="leading-5">{sameDayAddressWarningMessage}</p>
            </div>
          </div>
        )}

        {/* Time Selection Section */}
        <div className="bg-white dark:bg-card/40 rounded-2xl p-3 sm:p-6 space-y-3 sm:space-y-4 border border-slate-200 dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Time</h2>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {time || "Select a time"}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Suggested times
            </p>
            {suggestedTimes.length > 0 ? (
              <div className="relative overflow-hidden bg-white dark:bg-card/40">
                <div
                  ref={suggestedTimesRailRef}
                  className="flex gap-2 overflow-x-auto overflow-y-hidden py-1 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  onScroll={updateSuggestedTimesScrollState}
                >
                  {suggestedTimes.map((slot) => {
                    const disabled = isPhotographerTimeDisabled(photographer, slot);
                    return (
                      <Button
                        key={slot}
                        type="button"
                        variant={time === slot ? "default" : "outline"}
                        disabled={disabled}
                        data-suggested-time={slot}
                        onClick={() => handleQuickTimeSelect(slot)}
                        className={cn(
                          "h-11 min-w-[104px] shrink-0 rounded-xl border px-4 text-sm font-semibold shadow-sm transition-all",
                          time === slot
                            ? "border-blue-500 bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700"
                            : "border-gray-200 bg-gray-50 text-slate-900 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-muted/40 dark:bg-card/60 dark:text-slate-100 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
                        )}
                      >
                        {slot}
                      </Button>
                    );
                  })}
                </div>
                <div
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white from-0% via-white via-70% to-transparent dark:from-[#090e13] dark:from-0% dark:via-[#090e13] dark:via-70% dark:to-transparent",
                    !canScrollSuggestedTimesLeft && "opacity-0"
                  )}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white from-0% via-white via-70% to-transparent dark:from-[#090e13] dark:from-0% dark:via-[#090e13] dark:via-70% dark:to-transparent",
                    !canScrollSuggestedTimesRight && "opacity-0"
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Scroll suggested times left"
                  disabled={!canScrollSuggestedTimesLeft}
                  onClick={() => scrollSuggestedTimesBy('left')}
                  className={cn(
                    "absolute left-0 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full border-slate-200 bg-white/95 text-slate-700 shadow-md hover:bg-white dark:border-slate-700 dark:bg-[#090e13] dark:text-slate-100 dark:hover:bg-[#090e13]",
                    !canScrollSuggestedTimesLeft && "pointer-events-none opacity-0"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Scroll suggested times right"
                  disabled={!canScrollSuggestedTimesRight}
                  onClick={() => scrollSuggestedTimesBy('right')}
                  className={cn(
                    "absolute right-0 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full border-slate-200 bg-white/95 text-slate-700 shadow-md hover:bg-white dark:border-slate-700 dark:bg-[#090e13] dark:text-slate-100 dark:hover:bg-[#090e13]",
                    !canScrollSuggestedTimesRight && "pointer-events-none opacity-0"
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-muted/40 dark:bg-card/30 dark:text-slate-400">
                No matching suggested times for the selected photographer. Use the picker below or choose another photographer/date.
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-center gap-2 dark:border-muted/40 dark:bg-card/60 dark:text-slate-100 dark:hover:bg-card/70"
            onClick={() => handleTimeDialogOpen(true)}
            disabled={!date}
          >
            <Clock className="h-4 w-4" />
            Choose manually
          </Button>

          {isMobile ? (
            <Drawer open={timeDialogOpen} onOpenChange={handleTimeDialogOpen}>
              <DrawerContent className="flex h-auto max-h-[66vh] flex-col">
                <DrawerHeader className="pb-2 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <DrawerTitle>Select Time</DrawerTitle>
                      <DrawerDescription>Choose a time for the shoot</DrawerDescription>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-blue-600 dark:bg-slate-800 dark:text-blue-400">
                      {tempTime || time || 'Select'}
                    </span>
                  </div>
                </DrawerHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
                  <TimeSelect
                    value={tempTime || time}
                    onChange={onTimeChange}
                    startHour={8}
                    endHour={20}
                    interval={5}
                    availableTimes={availableTimesForSelectedPhotographer}
                    placeholder="Select a time"
                    className="w-full"
                  />
                </div>

                <DrawerFooter className="sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-background/95 pt-3 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
                  <Button type="button" className="h-11 w-full" onClick={handleTimeConfirm}>
                    OK
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={timeDialogOpen} onOpenChange={handleTimeDialogOpen}>
              <DialogContent className="sm:max-w-md w-full">
                <DialogHeader>
                  <div className="flex items-start justify-between gap-3 pr-8">
                    <div>
                      <DialogTitle>Select Time</DialogTitle>
                      <DialogDescription>
                        Choose a time for the shoot
                      </DialogDescription>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-blue-600 dark:bg-slate-800 dark:text-blue-400">
                      {tempTime || time || 'Select'}
                    </span>
                  </div>
                </DialogHeader>

                <div className="mt-4 w-full flex justify-center">
                  <TimeSelect
                    value={tempTime || time}
                    onChange={onTimeChange}
                    startHour={8}
                    endHour={20}
                    interval={5}
                    availableTimes={availableTimesForSelectedPhotographer}
                    placeholder="Select a time"
                    className="w-full"
                  />
                </div>

                <DialogFooter className="mt-4">
                  <Button type="button" className="w-full" onClick={handleTimeConfirm}>
                    OK
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {formErrors['time'] && (
            <p className="text-sm font-medium text-destructive mt-1">{formErrors['time']}</p>
          )}
        </div>

        {/* Photographer Section */}
        <div className="bg-white dark:bg-card/40 rounded-2xl p-3 sm:p-6 space-y-2 border border-slate-200 dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
            {isMultiCategory ? 'Photographers' : 'Photographer'}
          </h2>

          {isMultiCategory && (
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 mb-2">
              Assign a photographer for each service category
            </p>
          )}

          {/* Multi-category: per-category photographer triggers */}
          {isMultiCategory && serviceCategories.map(([categoryName, services]) => {
            const catPhotographer = getPhotographerDetailsForCategory(categoryName);
            return (
              <div key={categoryName} className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {categoryName}
                  <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                    ({services.map(s => s.name).join(', ')})
                  </span>
                </p>
                <div
                  className={cn(
                    "bg-gray-50 dark:bg-card/60 rounded-lg p-3 sm:p-4 flex justify-between items-center transition-colors border border-gray-100 dark:border-muted/40",
                    time ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-card/70" : "opacity-60 cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (!time) {
                      toast({
                        title: "Select time first",
                        description: "Please choose a time before selecting a photographer.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setActiveCategoryForPicker(categoryName);
                    // Pre-select the currently assigned photographer for this category
                    const currentId = getPhotographerForCategory(categoryName);
                    if (currentId) setPhotographer?.(currentId);
                    setPhotographerDialogOpen(true);
                  }}
                >
                  <div className="flex items-center min-w-0">
                    {catPhotographer ? (
                      <>
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 mr-2.5 sm:mr-3 shrink-0">
                          <AvatarImage
                            src={getAvatarUrl((catPhotographer as any).avatar, 'photographer', undefined, catPhotographer.id)}
                            alt={catPhotographer.name}
                          />
                          <AvatarFallback>{catPhotographer.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm sm:text-base font-semibold text-slate-900 dark:text-white">{catPhotographer.name}</span>
                      </>
                    ) : (
                      <span className="truncate text-slate-500 dark:text-slate-400 text-sm">Select a photographer</span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 shrink-0" />
                </div>
                <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200/70 bg-white p-3 dark:border-slate-800/70 dark:bg-slate-900/40 sm:grid-cols-[1fr_140px]">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Schedule</p>
                    <ServiceDatePicker
                      value={getServiceSchedule(services[0]?.id || '').date}
                      onChange={(value) => updateServiceSchedules(services.map(s => s.id), { date: value })}
                      triggerClassName="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Time</p>
                    <ServiceTimePicker
                      value={getServiceSchedule(services[0]?.id || '').time}
                      options={buildConflictAwareServiceTimeOptions(getPhotographerForCategory(categoryName), getServiceSchedule(services[0]?.id || '').time)}
                      onChange={(value) => updateServiceSchedules(services.map(s => s.id), { time: value })}
                      triggerClassName="h-9"
                      isTimeDisabled={(value) => isPhotographerTimeDisabled(getPhotographerForCategory(categoryName), value)}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Single-category: original single photographer trigger with inline Drawer/Dialog */}
          {!isMultiCategory && (
            <>
              {selectedServices.length > 0 && (
                <div className="mb-3 space-y-2 rounded-lg border border-slate-200/70 bg-white p-3 dark:border-slate-800/70 dark:bg-slate-900/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service schedules</p>
                  {selectedServices.map(service => {
                    const schedule = getServiceSchedule(service.id);
                    return (
                      <div key={service.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px_120px] sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{service.name}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{formatScheduleLine(service.id)}</p>
                        </div>
                        <ServiceDatePicker
                          value={schedule.date}
                          onChange={(value) => updateServiceSchedules([service.id], { date: value })}
                          triggerClassName="h-9"
                        />
                        <ServiceTimePicker
                          value={schedule.time}
                          options={buildConflictAwareServiceTimeOptions(photographer, schedule.time)}
                          onChange={(value) => updateServiceSchedules([service.id], { time: value })}
                          triggerClassName="h-9"
                          isTimeDisabled={(value) => isPhotographerTimeDisabled(photographer, value)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {isMobile ? (
                <Drawer open={photographerDialogOpen} onOpenChange={handlePhotographerDialogOpen}>
                  <DrawerTrigger asChild>{photographerTrigger}</DrawerTrigger>
                  <DrawerContent className="h-[78vh] max-h-[78vh]">
                    <DrawerHeader className="pb-2 text-left">
                      <DrawerTitle className="text-lg text-slate-900 dark:text-slate-100">Select Photographer</DrawerTitle>
                      <DrawerDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                        {availabilityStats.hasAvailabilityData ? availabilityStats.available : availabilityStats.total} photographers available
                      </DrawerDescription>
                    </DrawerHeader>

                    <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
                      {renderPhotographerFilters(true)}
                      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 [scrollbar-gutter:stable_both-edges]">
                        {renderPhotographerResults(true)}
                      </div>
                    </div>

                    <DrawerFooter className="border-t border-slate-200/70 dark:border-slate-800/70 bg-white/90 dark:bg-slate-950/60 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-blue-500/80">Selected photographer</p>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {selectedPhotographerDetails?.name || 'None selected'}
                        </p>
                      </div>
                      <Button
                        onClick={handleConfirmPhotographer}
                        className="h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700"
                        disabled={!photographer}
                      >
                        Confirm Assignment
                      </Button>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Dialog open={photographerDialogOpen} onOpenChange={handlePhotographerDialogOpen}>
                  <DialogTrigger asChild>{photographerTrigger}</DialogTrigger>

                  <DialogContent className="sm:max-w-2xl w-[92vw] max-h-[90vh] p-0 overflow-hidden">
                    <div className="flex flex-col h-full sm:h-[70vh]">
                      <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 min-h-0">
                        <DialogHeader className="space-y-1 text-left items-start">
                          <DialogTitle className="text-xl text-slate-900 dark:text-slate-100">Select Photographer</DialogTitle>
                          <DialogDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                            {availabilityStats.hasAvailabilityData ? availabilityStats.available : availabilityStats.total} photographers available
                          </DialogDescription>
                        </DialogHeader>

                        {renderPhotographerFilters(false)}

                        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                          {renderPhotographerResults(false)}
                        </div>

                        <div className="pt-4 border-t border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/50 backdrop-blur flex-shrink-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className={cn(
                                "h-10 w-10 shrink-0",
                                selectedPhotographerDetails
                                  ? "ring-2 ring-blue-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                                  : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              )}>
                                {selectedPhotographerDetails ? (
                                  <>
                                    <AvatarImage
                                      src={getAvatarUrl(selectedPhotographerDetails.avatar, 'photographer', undefined, selectedPhotographerDetails.id)}
                                      alt={selectedPhotographerDetails.name}
                                    />
                                    <AvatarFallback>{selectedPhotographerDetails.name?.charAt(0)}</AvatarFallback>
                                  </>
                                ) : (
                                  <AvatarFallback>
                                    <User className="h-4 w-4" />
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-blue-500/80">Selected specialist</p>
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {selectedPhotographerDetails?.name || 'None selected'}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                onClick={() => setPhotographerDialogOpen(false)}
                              >
                                Discard
                              </Button>
                              <Button
                                onClick={handleConfirmPhotographer}
                                disabled={!photographer}
                              >
                                Confirm Assignment
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}

          {/* Multi-category: shared photographer picker (no trigger, opened programmatically) */}
          {isMultiCategory && (
            <>
              {isMobile ? (
                <Drawer open={photographerDialogOpen} onOpenChange={(open) => {
                  setPhotographerDialogOpen(open);
                  if (!open) setActiveCategoryForPicker(null);
                }}>
                  <DrawerContent className="h-[78vh] max-h-[78vh]">
                    <DrawerHeader className="pb-2 text-left">
                      <DrawerTitle className="text-lg text-slate-900 dark:text-slate-100">
                        Select Photographer{activeCategoryForPicker ? ` for ${activeCategoryForPicker}` : ''}
                      </DrawerTitle>
                      <DrawerDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                        {availabilityStats.hasAvailabilityData ? availabilityStats.available : availabilityStats.total} photographers available
                      </DrawerDescription>
                    </DrawerHeader>

                    <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
                      {renderPhotographerFilters(true)}
                      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 [scrollbar-gutter:stable_both-edges]">
                        {renderPhotographerResults(true)}
                      </div>
                    </div>

                    <DrawerFooter className="border-t border-slate-200/70 dark:border-slate-800/70 bg-white/90 dark:bg-slate-950/60 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-blue-500/80">
                          {activeCategoryForPicker ? `Photographer for ${activeCategoryForPicker}` : 'Selected photographer'}
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {selectedPhotographerDetails?.name || 'None selected'}
                        </p>
                      </div>
                      <Button
                        onClick={handleConfirmCategoryPhotographer}
                        className="h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700"
                        disabled={!photographer}
                      >
                        Confirm Assignment
                      </Button>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Dialog open={photographerDialogOpen} onOpenChange={(open) => {
                  setPhotographerDialogOpen(open);
                  if (!open) setActiveCategoryForPicker(null);
                }}>
                  <DialogContent className="sm:max-w-2xl w-[92vw] max-h-[90vh] p-0 overflow-hidden">
                    <div className="flex flex-col h-full sm:h-[70vh]">
                      <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 min-h-0">
                        <DialogHeader className="space-y-1 text-left items-start">
                          <DialogTitle className="text-xl text-slate-900 dark:text-slate-100">
                            Select Photographer{activeCategoryForPicker ? ` for ${activeCategoryForPicker}` : ''}
                          </DialogTitle>
                          <DialogDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                            {availabilityStats.hasAvailabilityData ? availabilityStats.available : availabilityStats.total} photographers available
                          </DialogDescription>
                        </DialogHeader>

                        {renderPhotographerFilters(false)}

                        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                          {renderPhotographerResults(false)}
                        </div>

                        <div className="pt-4 border-t border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/50 backdrop-blur flex-shrink-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className={cn(
                                "h-10 w-10 shrink-0",
                                selectedPhotographerDetails
                                  ? "ring-2 ring-blue-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                                  : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              )}>
                                {selectedPhotographerDetails ? (
                                  <>
                                    <AvatarImage
                                      src={getAvatarUrl(selectedPhotographerDetails.avatar, 'photographer', undefined, selectedPhotographerDetails.id)}
                                      alt={selectedPhotographerDetails.name}
                                    />
                                    <AvatarFallback>{selectedPhotographerDetails.name?.charAt(0)}</AvatarFallback>
                                  </>
                                ) : (
                                  <AvatarFallback>
                                    <User className="h-4 w-4" />
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-blue-500/80">
                                  {activeCategoryForPicker ? `Photographer for ${activeCategoryForPicker}` : 'Selected specialist'}
                                </p>
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {selectedPhotographerDetails?.name || 'None selected'}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setPhotographerDialogOpen(false);
                                  setActiveCategoryForPicker(null);
                                }}
                              >
                                Discard
                              </Button>
                              <Button
                                onClick={handleConfirmCategoryPhotographer}
                                disabled={!photographer}
                              >
                                Confirm Assignment
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
        </div>

      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        className="w-full h-14 text-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
      >
        CONFIRM
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={goBack}
        className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      >
        Back
      </Button>
    </div>
  );
};
