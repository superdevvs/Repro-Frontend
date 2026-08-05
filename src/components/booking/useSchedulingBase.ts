import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import API_ROUTES from '@/lib/api';
import {
  isAbortError,
  readAvailabilityMap,
  type SchedulingFormProps,
  type SchedulingPhotographerView,
} from './schedulingModel';
import { to24Hour, formatTimeForDisplay } from '@/utils/availabilityUtils';
import type { DayAvailability } from '@/utils/availabilityProvider';
import type { AvailabilityPanelState } from '@/utils/availabilityPanelState';

type SchedulingBaseOptions = Pick<
  SchedulingFormProps,
  'date' | 'time' | 'address' | 'city' | 'state' | 'zip' | 'photographer'
  | 'photographers' | 'serviceSchedules' | 'setServiceSchedules' | 'selectedServices'
  | 'setAddress' | 'setCity' | 'setState' | 'setZip'
>;

export const useSchedulingBase = ({
  date,
  time,
  address = '',
  city = '',
  state = '',
  zip = '',
  photographer = '',
  photographers = [],
  serviceSchedules = {},
  setServiceSchedules,
  selectedServices = [],
  setAddress,
  setCity,
  setState,
  setZip,
}: SchedulingBaseOptions) => {
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
  const [photographersWithDistance, setPhotographersWithDistance] = useState<SchedulingPhotographerView[]>([]);
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  const [photographerAvailability, setPhotographerAvailability] = useState<Map<string | number, {
    isAvailable: boolean;
    nextAvailableTimes: string[];
  }>>(new Map());
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [dayAvailability, setDayAvailability] = useState<DayAvailability | null>(null);
  const [availabilityPanel, setAvailabilityPanel] = useState<AvailabilityPanelState | null>(null);
  const latestRequestRef = React.useRef(0);
  const suggestedTimesRailRef = React.useRef<HTMLDivElement | null>(null);
  const [canScrollSuggestedTimesLeft, setCanScrollSuggestedTimesLeft] = useState(false);
  const [canScrollSuggestedTimesRight, setCanScrollSuggestedTimesRight] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => date ?? new Date());
  const [calendarAvailability, setCalendarAvailability] = useState<{
    availableDates: Set<string>;
    unavailableDates: Set<string>;
    loading: boolean;
  }>({
    availableDates: new Set(),
    unavailableDates: new Set(),
    loading: false,
  });
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
  const normalizeSlotTime = useCallback((value?: string) => {
    if (!value) return '';
    const trimmed = value.trim();
    const converted = to24Hour(trimmed);
    const [hours, minutes] = converted.split(':');
    if (!hours || !minutes) return converted;
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  }, []);
  const defaultServiceDate = useMemo(() => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [date]);
  const defaultServiceTime = useMemo(
    () => normalizeSlotTime(time).slice(0, 5),
    [normalizeSlotTime, time],
  );
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
    const timeText = schedule.time ? formatTimeForDisplay(schedule.time) : 'No time';
    return `${dateText} at ${timeText}`;
  };
  const normalizeDayOfWeek = useCallback((value: unknown): string => {
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
  }, []);
  const getDateKey = useCallback((value: Date) => format(value, 'yyyy-MM-dd'), []);
  const getMonthBounds = useCallback((value: Date) => {
    const start = new Date(value.getFullYear(), value.getMonth(), 1);
    const end = new Date(value.getFullYear(), value.getMonth() + 1, 0);
    return { start, end };
  }, []);
  const buildDateKeysInRange = useCallback((start: Date, end: Date) => {
    const keys: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= end) {
      keys.push(getDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  }, [getDateKey]);
  const normalizeAddressKey = (value: { address?: string; city?: string; state?: string; zip?: string }) => {
    const joined = [value.address, value.city, value.state, value.zip]
      .filter(Boolean)
      .map((part) => String(part).trim().toLowerCase())
      .join(' ');
    return joined.replace(/[^a-z0-9]+/gi, '');
  };
  const timeToMinutes = useCallback((value: string) => {
    const normalized = normalizeSlotTime(value);
    const [hours, minutes] = normalized.split(':').map(Number);
    if (!Number.isFinite(hours)) return 0;
    return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
  }, [normalizeSlotTime]);
  const minutesToTime = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }, []);
  const availabilityStats = useMemo(() => {
    const basePhotographers: SchedulingPhotographerView[] = photographersWithDistance.length > 0
      ? photographersWithDistance
      : photographers;
    const availableCount = basePhotographers.reduce((count, photographerItem) => {
      const availability = photographerAvailability.get(photographerItem.id)
        || photographerAvailability.get(String(photographerItem.id))
        || photographerAvailability.get(Number(photographerItem.id));
      if (availability) {
        return availability.isAvailable ? count + 1 : count;
      }
      const hasSlots = Array.isArray(photographerItem.netAvailableSlots)
        ? photographerItem.netAvailableSlots.length > 0
        : false;
      return hasSlots ? count + 1 : count;
    }, 0);
    const hasAvailabilityData = photographerAvailability.size > 0
      || basePhotographers.some((photographerItem) => Array.isArray(photographerItem.netAvailableSlots));
    return {
      total: basePhotographers.length,
      available: availableCount,
      hasAvailabilityData,
    };
  }, [photographersWithDistance, photographers, photographerAvailability]);
  useEffect(() => {
    if (date) {
      setCalendarMonth(date);
    }
  }, [date]);
  useEffect(() => {
    const abortController = new AbortController();
    const fetchCalendarAvailability = async () => {
      if (photographers.length === 0) {
        setCalendarAvailability({
          availableDates: new Set(),
          unavailableDates: new Set(),
          loading: false,
        });
        return;
      }
      const { start, end } = getMonthBounds(calendarMonth);
      setCalendarAvailability(previous => ({
        ...previous,
        loading: true,
      }));
      try {
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(API_ROUTES.photographerAvailability.bulkIndex, {
          method: 'POST',
          headers,
          signal: abortController.signal,
          body: JSON.stringify({
            photographer_ids: photographers.map(p => Number(p.id)),
            from_date: getDateKey(start),
            to_date: getDateKey(end),
          }),
        });
        if (!response.ok) throw new Error('Failed to fetch calendar availability');
        const json: unknown = await response.json();
        const rawAvailabilityByPhotographer = readAvailabilityMap(json);
        const dateKeys = buildDateKeysInRange(start, end);
        const availabilityByDate = new Map<string, boolean>();
        for (const dateKey of dateKeys) {
          const dayOfWeek = normalizeDayOfWeek(new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }));
          let hasAvailability = false;
          for (const photographerItem of photographers) {
            const rawSlots = rawAvailabilityByPhotographer[photographerItem.id] || rawAvailabilityByPhotographer[String(photographerItem.id)] || [];
            const specificDateSlots = rawSlots.filter((slot) => {
              const slotDate = slot?.date ? String(slot.date).slice(0, 10) : '';
              return slotDate === dateKey;
            });
            const weeklySlots = rawSlots.filter((slot) => {
              const slotDate = slot?.date ? String(slot.date).trim() : '';
              if (slotDate) return false;
              return normalizeDayOfWeek(slot?.day_of_week) === dayOfWeek;
            });
            const relevantSlots = specificDateSlots.length > 0 ? specificDateSlots : weeklySlots;
            if (relevantSlots.some((slot) => !slot.status || slot.status === 'available')) {
              hasAvailability = true;
              break;
            }
          }
          availabilityByDate.set(dateKey, hasAvailability);
        }
        const todayKey = getDateKey(today);
        const availableDates = new Set<string>();
        const unavailableDates = new Set<string>();
        availabilityByDate.forEach((hasAvailability, dateKey) => {
          if (dateKey < todayKey) return;
          if (hasAvailability) {
            availableDates.add(dateKey);
          } else {
            unavailableDates.add(dateKey);
          }
        });
        setCalendarAvailability({
          availableDates,
          unavailableDates,
          loading: false,
        });
      } catch (error: unknown) {
        if (isAbortError(error)) return;
        setCalendarAvailability({
          availableDates: new Set(),
          unavailableDates: new Set(),
          loading: false,
        });
      }
    };
    fetchCalendarAvailability();
    return () => abortController.abort();
  }, [buildDateKeysInRange, calendarMonth, getDateKey, getMonthBounds, normalizeDayOfWeek, photographers, today]);
  const calendarAvailableDays = useMemo(
    () => Array.from(calendarAvailability.availableDates).map(dateKey => new Date(`${dateKey}T12:00:00`)),
    [calendarAvailability.availableDates],
  );
  const calendarUnavailableDays = useMemo(
    () => Array.from(calendarAvailability.unavailableDates).map(dateKey => new Date(`${dateKey}T12:00:00`)),
    [calendarAvailability.unavailableDates],
  );
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
  return {
    disabledDates, today, toast, isMobile, isLocationLoading, timeDialogOpen,
    setTimeDialogOpen, tempTime, setTempTime, photographerDialogOpen,
    setPhotographerDialogOpen, searchQuery, setSearchQuery, sortBy, setSortBy,
    showAllPhotographers, setShowAllPhotographers, photographersWithDistance,
    setPhotographersWithDistance, isCalculatingDistances, setIsCalculatingDistances,
    photographerAvailability, setPhotographerAvailability, isLoadingAvailability,
    setIsLoadingAvailability, dayAvailability, setDayAvailability, availabilityPanel,
    setAvailabilityPanel, latestRequestRef, suggestedTimesRailRef,
    canScrollSuggestedTimesLeft, setCanScrollSuggestedTimesLeft,
    canScrollSuggestedTimesRight, setCanScrollSuggestedTimesRight, calendarMonth,
    setCalendarMonth, calendarAvailability, setCalendarAvailability,
    formatLocationLabel, normalizeSlotTime, defaultServiceDate, defaultServiceTime,
    getServiceSchedule, updateServiceSchedules, formatScheduleLine,
    normalizeDayOfWeek, getDateKey, getMonthBounds, buildDateKeysInRange,
    normalizeAddressKey, timeToMinutes, minutesToTime,
    availabilityStats, calendarAvailableDays, calendarUnavailableDays,
    handleGetCurrentLocation,
  };
};
