// SchedulingForm.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { TimeSelect } from "@/components/ui/time-select";
import { format } from "date-fns";
import { MapPin, User, Package, ChevronRight, Loader2, Search } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { to12Hour, to24Hour } from '@/utils/availabilityUtils';
import API_ROUTES from '@/lib/api';
import { CheckCircle2, Check, Clock } from "lucide-react";
import { getAvatarUrl } from '@/utils/defaultAvatars';

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
  photographers?: Array<{ id: string; name: string; avatar?: string }>;
  setPhotographer?: React.Dispatch<React.SetStateAction<string>>;
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
  setPhotographer
}) => {
  const disabledDates = {
    before: new Date(),
  };
  const today = React.useMemo(() => new Date(), []);
  const quickTimes = React.useMemo(
    () => [
      '09:30 AM',
      '10:00 AM',
      '10:30 AM',
      '11:00 AM',
      '11:30 AM',
      '12:00 PM',
      '12:30 PM',
      '01:00 PM',
      '01:30 PM',
      '02:00 PM',
      '02:30 PM',
      '03:00 PM',
    ],
    []
  );
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
    availabilitySlots?: Array<{ start_time: string; end_time: string }>;
    bookedSlots?: Array<{ shoot_id: number; start_time: string; end_time: string; title: string }>;
    netAvailableSlots?: Array<{ start_time: string; end_time: string }>;
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
          const originAddress = p.origin_address?.address || p.home_address?.address || '';
          const originCity = p.origin_address?.city || p.home_address?.city || '';
          const originState = p.origin_address?.state || p.home_address?.state || '';
          const originZip = p.origin_address?.zip || p.home_address?.zip || '';
          return {
            id: String(p.id),
            name: p.name || photographer?.name || '',
            avatar: p.avatar || p.profile_image || p.photo || photographer?.avatar,
            distance: Number.isFinite(parsedDistance as number) ? parsedDistance : undefined,
            address: originAddress,
            city: originCity,
            state: originState,
            zip: originZip,
            distanceFrom: p.distance_from as 'home' | 'previous_shoot',
            previousShootId: p.previous_shoot_id,
            availabilitySlots: p.availability_slots,
            bookedSlots: p.booked_slots,
            netAvailableSlots: p.net_available_slots,
            isAvailableAtTime: p.is_available_at_time,
            hasAvailability: p.has_availability,
            shootsCountToday: p.shoots_count_today,
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
          const originAddress = p.origin_address?.address || p.home_address?.address || '';
          const originCity = p.origin_address?.city || p.home_address?.city || '';
          const originState = p.origin_address?.state || p.home_address?.state || '';
          const originZip = p.origin_address?.zip || p.home_address?.zip || '';
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
    // When showAllPhotographers is true, use original photographers list (bypasses availability)
    let filtered = showAllPhotographers 
      ? photographers.map(p => {
          // Try to find enriched data from photographersWithDistance
          const enriched = photographersWithDistance.find(pwd => pwd.id === p.id);
          return enriched || { ...p };
        })
      : photographersWithDistance;

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

      // When sorting by distance and a time is selected, bubble available photographers first
      if (sortBy === 'distance' && time) {
        const aAvailability = photographerAvailability.get(a.id)
          || photographerAvailability.get(String(a.id))
          || photographerAvailability.get(Number(a.id));
        const bAvailability = photographerAvailability.get(b.id)
          || photographerAvailability.get(String(b.id))
          || photographerAvailability.get(Number(b.id));
        const aIsAvailable = Boolean(aAvailability?.isAvailable);
        const bIsAvailable = Boolean(bAvailability?.isAvailable);
        if (aIsAvailable !== bIsAvailable) return aIsAvailable ? -1 : 1;
      }

      if (sortBy === 'availability') {
        const aAvailability = photographerAvailability.get(a.id)
          || photographerAvailability.get(String(a.id))
          || photographerAvailability.get(Number(a.id));
        const bAvailability = photographerAvailability.get(b.id)
          || photographerAvailability.get(String(b.id))
          || photographerAvailability.get(Number(b.id));
        const aIsAvailable = Boolean(aAvailability?.isAvailable);
        const bIsAvailable = Boolean(bAvailability?.isAvailable);

        if (aIsAvailable !== bIsAvailable) return aIsAvailable ? -1 : 1;
        const distanceCompare = compareDistance();
        return distanceCompare !== 0 ? distanceCompare : a.name.localeCompare(b.name);
      }

      const distanceCompare = compareDistance();
      return distanceCompare !== 0 ? distanceCompare : a.name.localeCompare(b.name);
    });

    return sorted;
  }, [photographersWithDistance, photographers, searchQuery, sortBy, showAllPhotographers, photographerAvailability, time]);

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
            onClick={() => setSortBy('distance')}
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
            onClick={() => setSortBy('availability')}
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

          const availabilitySlots = availabilitySource
            .map((slot) => ({
              start_time: normalizeSlotTime(slot.start_time),
              end_time: normalizeSlotTime(slot.end_time),
            }))
            .filter((slot) => slot.start_time && slot.end_time);

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
                  <p className={cn("font-semibold text-slate-900 dark:text-slate-100 truncate", mobileDrawer ? "text-base" : "text-sm") }>
                    {photographerItem.name}
                  </p>

                  <p className={cn("truncate text-slate-500 dark:text-slate-400", mobileDrawer ? "mt-0.5 text-sm" : "mt-0.5 text-xs") }>
                    {locationLabel || 'Location unavailable'}
                  </p>

                  <div className={cn("relative h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden", mobileDrawer ? "mt-1.5" : "mt-2") }>
                    {availabilitySlots.map((slot, index) => {
                      const slotStart = 8 * 60;
                      const slotEnd = 20 * 60;
                      const startMinutes = timeToMinutes(slot.start_time);
                      const endMinutes = timeToMinutes(slot.end_time);
                      const totalMinutes = slotEnd - slotStart;
                      const leftPercent = ((startMinutes - slotStart) / totalMinutes) * 100;
                      const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;
                      const clampedLeft = Math.max(0, Math.min(100, leftPercent));
                      const clampedWidth = Math.max(2, Math.min(100 - clampedLeft, widthPercent));

                      if (clampedWidth <= 0) return null;

                      return (
                        <span
                          key={`${photographerItem.id}-slot-${index}`}
                          className="absolute top-0 bottom-0 rounded-full bg-blue-500 dark:bg-blue-400"
                          style={{ left: `${clampedLeft}%`, width: `${clampedWidth}%` }}
                        />
                      );
                    })}
                  </div>
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
        <div className="bg-white dark:bg-card/40 rounded-2xl p-3 sm:p-6 space-y-3 sm:space-y-4 border border-slate-200/80 dark:border-muted/40 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
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

        {/* Time Selection Section */}
        <div className="bg-white dark:bg-card/40 rounded-2xl p-3 sm:p-6 space-y-3 sm:space-y-4 border border-slate-200/80 dark:border-muted/40 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Time</h2>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {time || "Select a time"}
            </span>
          </div>

          <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
            {quickTimes.map((slot) => (
              <Button
                key={slot}
                type="button"
                variant={time === slot ? "default" : "outline"}
                disabled={!date}
                onClick={() => handleQuickTimeSelect(slot)}
                className={cn(
                  "h-11 text-sm font-semibold",
                  time === slot
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-50 dark:bg-card/60 border-gray-200 dark:border-muted/40 text-slate-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-card/70"
                )}
              >
                {slot}
              </Button>
            ))}
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
              <DrawerContent className="h-[56vh] max-h-[56vh]">
                <DrawerHeader className="pb-2 text-left">
                  <DrawerTitle>Select Time</DrawerTitle>
                  <DrawerDescription>Choose a time for the shoot</DrawerDescription>
                </DrawerHeader>

                <div className="px-4 pb-2">
                  <TimeSelect
                    value={tempTime || time}
                    onChange={onTimeChange}
                    startHour={6}
                    endHour={21}
                    interval={5}
                    placeholder="Select a time"
                    className="w-full"
                  />
                </div>

                <DrawerFooter className="[padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))]">
                  <Button type="button" className="w-full" onClick={handleTimeConfirm}>
                    OK
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={timeDialogOpen} onOpenChange={handleTimeDialogOpen}>
              <DialogContent className="sm:max-w-md w-full">
                <DialogHeader>
                  <DialogTitle>Select Time</DialogTitle>
                  <DialogDescription>
                    Choose a time for the shoot
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 w-full flex justify-center">
                  <TimeSelect
                    value={tempTime || time}
                    onChange={onTimeChange}
                    startHour={6}
                    endHour={21}
                    interval={5}
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
        <div className="bg-white dark:bg-card/40 rounded-2xl p-3 sm:p-6 space-y-2 border border-slate-200/80 dark:border-muted/40 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">Photographer</h2>

          {isMobile ? (
            <Drawer open={photographerDialogOpen} onOpenChange={handlePhotographerDialogOpen}>
              <DrawerTrigger asChild>{photographerTrigger}</DrawerTrigger>
              <DrawerContent className="h-[78vh] max-h-[78vh]">
                <DrawerHeader className="pb-2 text-left">
                  <DrawerTitle className="text-lg text-slate-900 dark:text-slate-100">Select Photographer</DrawerTitle>
                  <DrawerDescription className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">
                    Curated network - {availabilityStats.hasAvailabilityData ? availabilityStats.available : availabilityStats.total} available
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
                        Curated network - {availabilityStats.hasAvailabilityData ? availabilityStats.available : availabilityStats.total} available
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
