import { useCallback } from 'react';
import type { DayAvailability } from '@/utils/availabilityProvider';
import { isBookingIntervalDisabled } from '@/utils/bookingIntervalAvailability';
import { photographerRequiredServices } from '@/utils/photographerAssignment';
import { DEFAULT_SHOOT_DURATION_MINUTES, resolveServiceShootDuration } from '@/utils/shootDuration';
import { normalizeSlotTime, type WorkingWindowMinutes } from '@/utils/suggestedTimeSlots';
import type { SchedulingFormProps, SchedulingPhotographerView } from './schedulingModel';

type Options = Required<Pick<SchedulingFormProps, 'selectedServices' | 'serviceSchedules' | 'sqft' | 'photographer'>> & {
  defaultServiceDate: string;
  defaultServiceTime: string;
  pickerServiceId?: string | null;
  bookingAvailabilityDate: string;
  bookingAvailabilityTime: string;
  availabilityDataDate: string;
  dayAvailability: DayAvailability | null;
  workingWindowMinutes: WorkingWindowMinutes | null;
  getPhotographerScheduleData: (id?: string | number) => SchedulingPhotographerView | null;
};

/** Keep duration, independent visit dates, and complete-interval checks together. */
export function useBookingIntervalAvailability({
  selectedServices, serviceSchedules, sqft, photographer, defaultServiceDate, defaultServiceTime,
  pickerServiceId, bookingAvailabilityDate, bookingAvailabilityTime, availabilityDataDate,
  dayAvailability, workingWindowMinutes, getPhotographerScheduleData,
}: Options) {
  const durationForSelection = useCallback((serviceId?: string | null, scheduleDate = defaultServiceDate, scheduleTime = defaultServiceTime) => {
    const services = photographerRequiredServices(selectedServices).filter(service => {
      if (serviceId) return service.id === serviceId;
      const schedule = serviceSchedules[service.id];
      return (schedule?.date || defaultServiceDate) === scheduleDate
        && normalizeSlotTime(schedule?.time || defaultServiceTime) === normalizeSlotTime(scheduleTime);
    });
    return services.length ? Math.max(...services.map(service => resolveServiceShootDuration(
      service, sqft === '' ? null : sqft, serviceSchedules[service.id]?.duration_minutes,
    ))) : DEFAULT_SHOOT_DURATION_MINUTES;
  }, [defaultServiceDate, defaultServiceTime, selectedServices, serviceSchedules, sqft]);

  const isPhotographerTimeDisabled = useCallback((photographerId: string | number | undefined, value: string, serviceId?: string) => {
    const requestedDate = (serviceId ? serviceSchedules[serviceId]?.date : undefined) || defaultServiceDate;
    // Never apply another service visit's day, or another photographer's blocked times.
    const usesMainDay = requestedDate === defaultServiceDate && String(photographerId || '') === String(photographer || '');
    const photographerItem = requestedDate === availabilityDataDate ? getPhotographerScheduleData(photographerId) : null;
    const netSlots = photographerItem?.netAvailableSlots ?? [];
    return isBookingIntervalDisabled({
      time: value,
      durationMinutes: durationForSelection(serviceId),
      workingWindow: usesMainDay ? workingWindowMinutes : null,
      blocked: usesMainDay ? dayAvailability?.blocked ?? [] : [],
      bookedSlots: photographerItem?.bookedSlots ?? [],
      unavailableSlots: photographerItem?.unavailableSlots ?? [],
      availableSlots: netSlots.length ? netSlots : photographerItem?.availabilitySlots ?? [],
    });
  }, [availabilityDataDate, dayAvailability, defaultServiceDate, durationForSelection, getPhotographerScheduleData, photographer, serviceSchedules, workingWindowMinutes]);

  return {
    bookingAvailabilityDuration: durationForSelection(pickerServiceId, bookingAvailabilityDate, bookingAvailabilityTime),
    isPhotographerTimeDisabled,
  };
}
