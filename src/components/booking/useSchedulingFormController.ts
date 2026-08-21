import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { to12Hour, to24Hour, formatTimeForDisplay } from '@/utils/availabilityUtils';
import { getDayAvailability } from '@/utils/availabilityProvider';
import { buildTimeOptionsForRange as buildTimeOptionsForRangePure, isDisabledByWindowOrBlocked } from '@/utils/suggestedTimeSlots';
import { derivePanelState } from '@/utils/availabilityPanelState';
import { FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY } from '@/config/availabilityDefaults';
import API_ROUTES from '@/lib/api';
import { getCategorySpecialtyId, hasCategorySpecialty } from '@/utils/photographerSpecialties';
import { buildAssignmentGroups, requiresPerServiceAssignment as computeRequiresPerServiceAssignment } from '@/utils/photographerAssignment';
import { buildServiceTimeOptions } from '@/components/shoots/ServiceSchedulePicker';
import { useSchedulingBase } from './useSchedulingBase';
import {
  isAbortError,
  canUseProtectedAvailabilityRoutes,
  readAvailabilityMap,
  readBookingPhotographers,
  type AvailabilityByPhotographer,
  type SchedulingFormProps,
  type SchedulingPhotographerView,
} from './schedulingModel';
import { useAuth } from '@/components/auth';
import { CANONICAL_TIMEZONE } from '@/utils/timezone';

export const useSchedulingFormController = ({
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
}: SchedulingFormProps) => {
  const { user } = useAuth();
  const canUseProtectedAvailability = canUseProtectedAvailabilityRoutes(user);
  const {
    disabledDates, today, toast, isMobile, isLocationLoading, timeDialogOpen,
    setTimeDialogOpen, tempTime, setTempTime, photographerDialogOpen,
    setPhotographerDialogOpen, searchQuery, setSearchQuery, sortBy, setSortBy,
    showAllPhotographers, setShowAllPhotographers, photographersWithDistance,
    setPhotographersWithDistance, isCalculatingDistances, setIsCalculatingDistances,
    photographerAvailability, setPhotographerAvailability, isLoadingAvailability,
    setIsLoadingAvailability, dayAvailability, setDayAvailability, availabilityPanel,
    setAvailabilityPanel, latestRequestRef, suggestedTimesRailRef,
    normalizeDayOfWeek,
    canScrollSuggestedTimesLeft, setCanScrollSuggestedTimesLeft,
    canScrollSuggestedTimesRight, setCanScrollSuggestedTimesRight, calendarMonth,
    setCalendarMonth, calendarAvailability, formatLocationLabel, normalizeSlotTime,
    defaultServiceDate, defaultServiceTime, getServiceSchedule, updateServiceSchedules,
    formatScheduleLine, normalizeAddressKey, timeToMinutes, minutesToTime, availabilityStats,
    calendarAvailableDays, calendarUnavailableDays, handleGetCurrentLocation,
  } = useSchedulingBase({
    date, time, address, city, state, zip, photographer, photographers,
    serviceSchedules, setServiceSchedules, selectedServices,
    setAddress, setCity, setState, setZip,
  });
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
    setTempTime(newTime);
  };
  const handleTimeDialogOpen = (open: boolean) => {
    if (open && !date) {
      toast({
        title: "Select date first",
        description: "Please choose a date before selecting time.",
        variant: "destructive",
      });
      return;
    }
    if (open) {
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
  const selectedPhotographer = photographers.find(p => p.id === photographer);
  const selectedPhotographerDetails = photographersWithDistance.find(
    (photographerItem) => String(photographerItem.id) === String(photographer)
  ) || selectedPhotographer;
  const fullAddress = address && city && state ? `${address}, ${city}, ${state}${zip ? ' ' + zip : ''}` : '';
  const assignmentGroups = useMemo(
    () => buildAssignmentGroups(selectedServices),
    [selectedServices],
  );
  const requiresPerServiceAssignment = computeRequiresPerServiceAssignment(selectedServices);
  const [activeServiceForPicker, setActiveServiceForPicker] = useState<string | null>(null);
  const activeServiceNameForPicker = activeServiceForPicker
    ? (selectedServices.find(s => s.id === activeServiceForPicker)?.name || '')
    : '';
  const activeServiceCapabilityForPicker = useMemo(() => {
    const empty = {
      categorySpecialtyId: '',
      categoryNameSpecialtyId: '',
      serviceIds: new Set<string>(),
    };
    if (!activeServiceForPicker) return empty;
    const service = selectedServices.find(s => s.id === activeServiceForPicker);
    if (!service) return empty;
    const categoryName = service.category?.name || 'Other';
    const category = service.category || { name: categoryName };
    return {
      categorySpecialtyId: getCategorySpecialtyId(category),
      categoryNameSpecialtyId: getCategorySpecialtyId({ name: categoryName }),
      serviceIds: new Set([service.id]),
    };
  }, [activeServiceForPicker, selectedServices]);
  const photographerOptions = useMemo(() => {
    const byId = new Map<string, SchedulingPhotographerView>();
    const makePickerSafe = (photographerItem: SchedulingPhotographerView) => canUseProtectedAvailability
      ? photographerItem
      : {
          ...photographerItem,
          address: undefined,
          city: undefined,
          state: undefined,
          zip: undefined,
        };
    for (const photographerItem of photographersWithDistance) {
      const pickerSafePhotographer = makePickerSafe(photographerItem);
      byId.set(String(photographerItem.id), {
        ...pickerSafePhotographer,
        id: String(photographerItem.id),
      });
    }
    for (const photographerItem of photographers) {
      const id = String(photographerItem.id);
      const enriched = byId.get(id);
      const pickerSafePhotographer = makePickerSafe(photographerItem);
      byId.set(id, {
        ...pickerSafePhotographer,
        ...enriched,
        id,
      });
    }
    return Array.from(byId.values());
  }, [canUseProtectedAvailability, photographers, photographersWithDistance]);
  useEffect(() => {
    if (!photographer || !date) {
      setDayAvailability(null);
      setAvailabilityPanel(null); // idle: no selection yet
      return;
    }
    const controller = new AbortController();
    const requestId = ++latestRequestRef.current;
    setAvailabilityPanel(derivePanelState({ loading: true, aborted: false, error: null, result: null }));
    if (!canUseProtectedAvailability) {
      const selected = photographerOptions.find((item) => String(item.id) === String(photographer));
      const bookable = selected?.availabilitySlots ?? [];
      const blocked = [...(selected?.bookedSlots ?? []), ...(selected?.unavailableSlots ?? [])]
        .filter((slot) => Boolean(slot.start_time && slot.end_time))
        .map((slot) => ({ start: slot.start_time, end: slot.end_time }));
      const starts = bookable.map((slot) => slot.start_time).filter(Boolean).sort();
      const ends = bookable.map((slot) => slot.end_time).filter(Boolean).sort();
      const workingHours = starts.length > 0 && ends.length > 0
        ? { start: starts[0], end: ends[ends.length - 1] }
        : null;
      const result = {
        status: workingHours ? 'success' as const : blocked.length > 0 ? 'empty' as const : 'not-configured' as const,
        day: {
          workingHours,
          blocked,
          fromConfig: workingHours !== null,
          timezone: CANONICAL_TIMEZONE,
        },
      };
      setDayAvailability(result.day);
      setAvailabilityPanel(derivePanelState({ loading: false, aborted: false, error: null, result }));
      return;
    }
    (async () => {
      try {
        const result = await getDayAvailability(photographer, date, controller.signal);
        if (requestId !== latestRequestRef.current) return; // stale → drop (Req 6.2)
        setDayAvailability(result.day);
        setAvailabilityPanel(
          derivePanelState({ loading: false, aborted: false, error: null, result }),
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (requestId !== latestRequestRef.current) return; // stale → drop (Req 6.2)
        setDayAvailability(null);
        setAvailabilityPanel(
          derivePanelState({ loading: false, aborted: false, error: err as Error, result: null }),
        );
      }
    })();
    return () => {
      controller.abort();
    };
  }, [canUseProtectedAvailability, date, latestRequestRef, photographer, photographerOptions, setAvailabilityPanel, setDayAvailability]);
  const isTimeWithinSlots = useCallback((value: string, slots: Array<{ start_time?: string; end_time?: string }> = []) => {
    const minutes = timeToMinutes(value);
    return slots.some((slot) => {
      if (!slot.start_time || !slot.end_time) return false;
      const start = timeToMinutes(slot.start_time);
      const end = timeToMinutes(slot.end_time);
      return minutes >= start && minutes < end;
    });
  }, [timeToMinutes]);
  const isTimeWithinBlockedSlots = useCallback((
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
  }, [timeToMinutes]);
  const getPhotographerScheduleData = useCallback((photographerId?: string | number) => {
    if (!photographerId) return null;
    return photographerOptions.find((item) => String(item.id) === String(photographerId)) ?? null;
  }, [photographerOptions]);
  const workingWindowMinutes = useMemo<{ start: number; end: number } | null>(() => {
    const workingHours = dayAvailability?.workingHours;
    if (workingHours) {
      const start = timeToMinutes(workingHours.start);
      const end = timeToMinutes(workingHours.end);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        return { start, end };
      }
    }
    const collectSlots = (): Array<{ start_time?: string; end_time?: string }> => {
      if (photographer) {
        const selected = getPhotographerScheduleData(photographer);
        const net = Array.isArray(selected?.netAvailableSlots) ? selected.netAvailableSlots : [];
        if (net.length > 0) return net;
        return Array.isArray(selected?.availabilitySlots) ? selected.availabilitySlots : [];
      }
      const all: Array<{ start_time?: string; end_time?: string }> = [];
      for (const item of photographerOptions) {
        const net = Array.isArray(item?.netAvailableSlots) ? item.netAvailableSlots : [];
        const avail = Array.isArray(item?.availabilitySlots) ? item.availabilitySlots : [];
        all.push(...(net.length > 0 ? net : avail));
      }
      return all;
    };
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = Number.NEGATIVE_INFINITY;
    for (const slot of collectSlots()) {
      if (!slot.start_time || !slot.end_time) continue;
      const start = timeToMinutes(slot.start_time);
      const end = timeToMinutes(slot.end_time);
      if (Number.isFinite(start)) minStart = Math.min(minStart, start);
      if (Number.isFinite(end)) maxEnd = Math.max(maxEnd, end);
    }
    if (minStart < maxEnd) return { start: minStart, end: maxEnd };
    return null;
  }, [dayAvailability, getPhotographerScheduleData, photographer, photographerOptions, timeToMinutes]);
  const availabilityCardWindow = useMemo(() => {
    if (workingWindowMinutes) {
      return {
        startMinutes: workingWindowMinutes.start,
        endMinutes: workingWindowMinutes.end,
        displayFallbackOnly: false,
      };
    }
    return {
      startMinutes: timeToMinutes(FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY.start),
      endMinutes: timeToMinutes(FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY.end),
      displayFallbackOnly: true,
    };
  }, [timeToMinutes, workingWindowMinutes]);
  const isPhotographerTimeDisabled = useCallback((photographerId: string | number | undefined, value: string) => {
    const dayBlocked = Array.isArray(dayAvailability?.blocked) ? dayAvailability!.blocked : [];
    if (isDisabledByWindowOrBlocked(value, workingWindowMinutes, dayBlocked)) {
      return true;
    }
    const photographerItem = getPhotographerScheduleData(photographerId);
    if (!photographerItem) return false;
    const bookedSlots = Array.isArray(photographerItem.bookedSlots) ? photographerItem.bookedSlots : [];
    const unavailableSlots = Array.isArray(photographerItem.unavailableSlots) ? photographerItem.unavailableSlots : [];
    if (isTimeWithinBlockedSlots(value, bookedSlots, 30) || isTimeWithinBlockedSlots(value, unavailableSlots)) return true;
    const netSlots = Array.isArray(photographerItem.netAvailableSlots) ? photographerItem.netAvailableSlots : [];
    if (netSlots.length > 0) return !isTimeWithinSlots(value, netSlots);
    return false;
  }, [dayAvailability, getPhotographerScheduleData, isTimeWithinBlockedSlots, isTimeWithinSlots, workingWindowMinutes]);
  const availableTimesForSelectedPhotographer = useMemo(
    () => buildTimeOptionsForRangePure(
      5,
      workingWindowMinutes?.start,
      workingWindowMinutes?.end,
    ).filter((option) => !isPhotographerTimeDisabled(photographer, option)),
    [isPhotographerTimeDisabled, photographer, workingWindowMinutes]
  );
  const suggestedTimes = useMemo(() => {
    if (!date) return [];
    if (!workingWindowMinutes) return [];
    return buildTimeOptionsForRangePure(15, workingWindowMinutes.start, workingWindowMinutes.end)
      .filter((option) => !isPhotographerTimeDisabled(photographer, option));
  }, [date, isPhotographerTimeDisabled, photographer, workingWindowMinutes]);
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
  }, [setCanScrollSuggestedTimesLeft, setCanScrollSuggestedTimesRight, suggestedTimesRailRef]);
  const handleSuggestedTimesWheel = React.useCallback((event: WheelEvent) => {
    const element = suggestedTimesRailRef.current;
    if (!element) return;
    if (element.scrollWidth <= element.clientWidth) return;
    event.preventDefault();
    event.stopPropagation();
    const scrollDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    element.scrollLeft += scrollDelta;
    window.requestAnimationFrame(updateSuggestedTimesScrollState);
  }, [suggestedTimesRailRef, updateSuggestedTimesScrollState]);
  const scrollSuggestedTimesBy = React.useCallback((direction: 'left' | 'right') => {
    const element = suggestedTimesRailRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction === 'left' ? -Math.max(240, element.clientWidth * 0.8) : Math.max(240, element.clientWidth * 0.8),
      behavior: 'smooth',
    });
  }, [suggestedTimesRailRef]);
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
  }, [date, isPhotographerTimeDisabled, photographer, setFormErrors, setTempTime, setTime, suggestedTimes, time]);
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
  }, [handleSuggestedTimesWheel, suggestedTimes, suggestedTimesRailRef]);
  useEffect(() => {
    const element = suggestedTimesRailRef.current;
    if (!element) return;
    const selectedButton = element.querySelector<HTMLButtonElement>(`[data-suggested-time="${time}"]`);
    selectedButton?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    window.requestAnimationFrame(updateSuggestedTimesScrollState);
  }, [suggestedTimes, suggestedTimesRailRef, time, updateSuggestedTimesScrollState]);
  const buildConflictAwareServiceTimeOptions = (photographerId: string | number | undefined, ensure?: string | null) =>
    buildServiceTimeOptions(ensure).map((option) => ({
      ...option,
      disabled: isPhotographerTimeDisabled(photographerId, option.value),
    }));
  const filteredPhotographersForService = useMemo(() => {
    if (!requiresPerServiceAssignment || activeServiceCapabilityForPicker.serviceIds.size === 0) return null; // null = no filtering
    return photographerOptions.filter(p => {
      const specialties = p.metadata?.specialties || p.specialties || [];
      if (!specialties.length) return true; // No specialties defined = show (can do anything)
      return hasCategorySpecialty(
        specialties,
        activeServiceCapabilityForPicker.categorySpecialtyId,
        activeServiceCapabilityForPicker.categoryNameSpecialtyId,
        activeServiceCapabilityForPicker.serviceIds,
      );
    });
  }, [requiresPerServiceAssignment, activeServiceCapabilityForPicker, photographerOptions]);
  const getPhotographerForService = (serviceId: string): string => servicePhotographers[serviceId] || '';
  const getPhotographerDetailsForService = (serviceId: string) => {
    const photographerId = getPhotographerForService(serviceId);
    if (!photographerId) return null;
    return photographersWithDistance.find(p => String(p.id) === String(photographerId))
      || photographers.find(p => String(p.id) === String(photographerId))
      || null;
  };
  const handleConfirmServicePhotographer = () => {
    if (!photographer || !activeServiceForPicker || !setServicePhotographers) {
      setPhotographerDialogOpen(false);
      return;
    }
    setServicePhotographers(prev => ({ ...prev, [activeServiceForPicker]: photographer }));
    setPhotographerDialogOpen(false);
    setActiveServiceForPicker(null);
    if (!selectedPhotographer) {
      setPhotographer?.(photographer);
    }
  };
  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();
    const computeDistancesFromProfiles = async () => {
      if (!canUseProtectedAvailability) return;
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
      setPhotographersWithDistance(
        photographers.map((p) => {
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
      for (const p of photographers) {
        if (isCancelled) return;
        const hasOriginAddress = [p.address, p.city, p.state, p.zip].some(value => Boolean(value && String(value).trim()));
        if (!hasOriginAddress) continue;
        const pKey = normalizeAddressKey({ address: p.address, city: p.city, state: p.state, zip: p.zip });
        if (bookingKey && pKey && bookingKey === pKey) {
          setPhotographersWithDistance((prev) => prev.map((ph) => (String(ph.id) === String(p.id) ? { ...ph, distance: 0 } : ph)));
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
              prev.map((ph) => (String(ph.id) === String(p.id) ? { ...ph, distance } : ph))
            );
          }
        } catch {
          continue;
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
        if (!canUseProtectedAvailability) {
          setIsLoadingAvailability(false);
          return;
        }
        try {
          const token = localStorage.getItem('authToken');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;
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
          const bulkJson: unknown = await bulkResponse.json();
          const rawAvailabilityByPhotographer = readAvailabilityMap(bulkJson);
          console.log('[SchedulingForm] No-address bulkIndex response:', {
            rawData: rawAvailabilityByPhotographer,
            photographerIds: photographers.map(p => p.id),
            date: format(date, 'yyyy-MM-dd'),
          });
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
            const specificDateSlots = rawSlots.filter((slot) => slot.date === dateStr);
            const weeklySlots = rawSlots.filter((slot) =>
              !slot.date && slot.day_of_week?.toLowerCase() === dayOfWeek
            );
            const relevantSlots = specificDateSlots.length > 0 ? specificDateSlots : weeklySlots;
            const availableSlots = relevantSlots
              .filter((slot) => !slot.status || slot.status === 'available')
              .map((slot) => ({
                start_time: slot.start_time,
                end_time: slot.end_time,
              }));
            const nextTimes = availableSlots.slice(0, 3).map((slot) => to12Hour(slot.start_time));
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
        } catch (error: unknown) {
          if (isAbortError(error) || isCancelled) return;
          console.error('Error fetching fallback availability:', error);
          setPhotographersWithDistance(photographers.map(p => ({ ...p })));
        } finally {
          setIsLoadingAvailability(false);
        }
        return;
      }
      const requestKey = `${format(date, 'yyyy-MM-dd')}-${time}-${address}`;
      setIsCalculatingDistances(true);
      setPhotographersWithDistance([]);
      setPhotographerAvailability(new Map());
      try {
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
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
            service_ids: selectedServices.map(service => Number(service.id)).filter(Number.isFinite),
          }),
        });
        if (isCancelled) return;
        if (!response.ok) {
          throw new Error('Failed to fetch photographer data');
        }
        const json: unknown = await response.json();
        const photographerData = readBookingPhotographers(json);
        const initialPhotographers: SchedulingPhotographerView[] = photographerData.map((p) => {
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
            address: canUseProtectedAvailability ? photographer?.address : undefined,
            city: canUseProtectedAvailability ? photographer?.city : undefined,
            state: canUseProtectedAvailability ? photographer?.state : undefined,
            zip: canUseProtectedAvailability ? photographer?.zip : undefined,
            serviceAreaLabel: p.service_area_label,
            availabilitySlots: p.availability_slots,
            unavailableSlots: p.unavailable_slots,
            bookedSlots: p.booked_slots,
            netAvailableSlots: p.net_available_slots,
            isAvailableAtTime: p.is_available_at_time,
            hasAvailability: p.has_availability,
            shootsCountToday: p.shoots_count_today,
            distanceFrom: p.distance_from,
            previousShootId: canUseProtectedAvailability ? p.previous_shoot_id : undefined,
            travel_range: photographer?.travel_range,
            travel_range_unit: photographer?.travel_range_unit ?? 'miles',
          };
        });
        let rawAvailabilityByPhotographer: AvailabilityByPhotographer = {};
        if (canUseProtectedAvailability) try {
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
            const bulkJson: unknown = await bulkResponse.json();
            rawAvailabilityByPhotographer = readAvailabilityMap(bulkJson);
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
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const enrichedPhotographers = initialPhotographers.map((p) => {
          const rawSlots = rawAvailabilityByPhotographer[p.id] || rawAvailabilityByPhotographer[String(p.id)] || [];
          if (rawSlots.length > 0) {
            const daysInSlots = rawSlots.map((slot) => slot.day_of_week);
            console.log('[SchedulingForm] Raw slots sample for', p.name, ':', {
              firstSlot: JSON.stringify(rawSlots[0]),
              allDaysOfWeek: JSON.stringify(daysInSlots),
              lookingFor: dayOfWeek,
              hasMatchingDay: daysInSlots.some((d: string) => d?.toLowerCase() === dayOfWeek),
            });
          }
          const specificDateSlots = rawSlots.filter((slot) => {
            const slotDate = slot.date ? String(slot.date).slice(0, 10) : '';
            return slotDate === dateStr;
          });
          const weeklySlots = rawSlots.filter((slot) => {
            const slotDate = slot.date ? String(slot.date).trim() : '';
            if (slotDate) return false;
            return normalizeDayOfWeek(slot.day_of_week) === dayOfWeek;
          });
          const relevantSlots = specificDateSlots.length > 0 ? specificDateSlots : weeklySlots;
          const availableSlots = relevantSlots
            .filter((slot) => !slot.status || slot.status === 'available')
            .map((slot) => ({
              start_time: slot.start_time,
              end_time: slot.end_time,
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
        const availabilityMap = new Map<string | number, { isAvailable: boolean; nextAvailableTimes: string[] }>();
        enrichedPhotographers.forEach((p) => {
          const slots = p.availabilitySlots || p.netAvailableSlots || [];
          const nextTimes = slots
            .slice(0, 3)
            .map((slot) => to12Hour(slot.start_time));
          const isAvailable = slots.length > 0 || p.isAvailableAtTime;
          availabilityMap.set(p.id, { isAvailable: isAvailable ?? false, nextAvailableTimes: nextTimes });
          availabilityMap.set(String(p.id), { isAvailable: isAvailable ?? false, nextAvailableTimes: nextTimes });
          availabilityMap.set(Number(p.id), { isAvailable: isAvailable ?? false, nextAvailableTimes: nextTimes });
        });
        setPhotographerAvailability(availabilityMap);
        setIsLoadingAvailability(false);
        if (!canUseProtectedAvailability) return;
        const bookingCoords = await getCoordinatesFromAddress(address, city, state, zip || '');
        if (!bookingCoords || isCancelled) return;
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
              setPhotographersWithDistance(prev => 
                prev.map(ph => ph.id === String(p.id) ? { ...ph, distance } : ph)
              );
            }
          }
        }
      } catch (error: unknown) {
        if (isAbortError(error) || isCancelled) return;
        console.error('Error fetching photographer data:', error);
        setPhotographersWithDistance(photographers.map(p => ({ ...p })));
        setIsCalculatingDistances(false);
        setIsLoadingAvailability(false);
        computeDistancesFromProfiles();
      }
    };
    fetchPhotographerData();
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [
    address, city, state, zip, photographers, date, normalizeAddressKey,
    normalizeDayOfWeek, time, canUseProtectedAvailability, selectedServices,
    setIsCalculatingDistances, setIsLoadingAvailability, setPhotographerAvailability,
    setPhotographersWithDistance,
  ]);
  const filteredAndSortedPhotographers = useMemo(() => {
    const enrichedPhotographerIds = new Set(
      photographersWithDistance.map((photographerItem) => String(photographerItem.id)),
    );
    let filtered = showAllPhotographers
      ? photographerOptions
      : photographersWithDistance.length > 0
        ? photographerOptions.filter((photographerItem) => enrichedPhotographerIds.has(String(photographerItem.id)))
        : photographerOptions;
    const selectedTimeMinutes = time ? timeToMinutes(time) : null;
    const getAvailabilityMetrics = (photographerItem: SchedulingPhotographerView) => {
      const rawSlots = Array.isArray(photographerItem.netAvailableSlots) && photographerItem.netAvailableSlots.length > 0
        ? photographerItem.netAvailableSlots
        : Array.isArray(photographerItem.availabilitySlots)
        ? photographerItem.availabilitySlots
        : [];
      const slots = rawSlots
        .map((slot) => ({
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
    if (requiresPerServiceAssignment && activeServiceForPicker && activeServiceCapabilityForPicker.serviceIds.size > 0) {
      const allowedIds = filteredPhotographersForService
        ? new Set(filteredPhotographersForService.map(p => String(p.id)))
        : null;
      if (allowedIds) {
        filtered = filtered.filter(p => allowedIds.has(String(p.id)));
      }
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.serviceAreaLabel?.toLowerCase().includes(query) ||
        p.city?.toLowerCase().includes(query) ||
        p.state?.toLowerCase().includes(query)
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      const aDistance = a.distance;
      const bDistance = b.distance;
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
  }, [photographersWithDistance, photographerOptions, searchQuery, sortBy, showAllPhotographers, photographerAvailability, date, time, requiresPerServiceAssignment, activeServiceForPicker, activeServiceCapabilityForPicker, filteredPhotographersForService, timeToMinutes]);

  return {
    date, setDate, time, setTime, formErrors, setFormErrors, handleSubmit, goBack,
    address, city, state, zip, bedrooms, bathrooms, sqft, photographer, photographers,
    setPhotographer, servicePhotographers, setServicePhotographers, serviceSchedules,
    selectedServices, sameDayAddressWarningMessage, disabledDates, today, toast, isMobile,
    isLocationLoading, timeDialogOpen, setTimeDialogOpen, tempTime, photographerDialogOpen,
    setPhotographerDialogOpen, searchQuery, setSearchQuery, sortBy, setSortBy,
    showAllPhotographers, setShowAllPhotographers, photographersWithDistance,
    isCalculatingDistances, photographerAvailability, isLoadingAvailability,
    dayAvailability, availabilityPanel, suggestedTimesRailRef, canScrollSuggestedTimesLeft,
    canScrollSuggestedTimesRight, calendarMonth, setCalendarMonth, calendarAvailability,
    formatLocationLabel, normalizeSlotTime, defaultServiceDate, defaultServiceTime,
    getServiceSchedule, updateServiceSchedules, formatScheduleLine, timeToMinutes,
    minutesToTime, availabilityStats, calendarAvailableDays, calendarUnavailableDays,
    onDateChange, onTimeChange, handleTimeDialogOpen, handleTimeConfirm,
    handleQuickTimeSelect, handlePhotographerDialogOpen, handleConfirmPhotographer,
    handleGetCurrentLocation, selectedPhotographer, selectedPhotographerDetails,
    fullAddress, assignmentGroups, requiresPerServiceAssignment, activeServiceForPicker,
    setActiveServiceForPicker, activeServiceNameForPicker, activeServiceCapabilityForPicker,
    photographerOptions, isTimeWithinSlots, isTimeWithinBlockedSlots,
    getPhotographerScheduleData, workingWindowMinutes, availabilityCardWindow,
    isPhotographerTimeDisabled, availableTimesForSelectedPhotographer, suggestedTimes,
    updateSuggestedTimesScrollState, scrollSuggestedTimesBy,
    buildConflictAwareServiceTimeOptions, filteredPhotographersForService,
    getPhotographerForService, getPhotographerDetailsForService,
    handleConfirmServicePhotographer, filteredAndSortedPhotographers,
  };
};

export type SchedulingFormController = ReturnType<typeof useSchedulingFormController>;
