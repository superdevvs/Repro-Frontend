import { useCallback } from 'react';
import type { DayAvailability } from '@/utils/availabilityProvider';
import { isBookingIntervalDisabled } from '@/utils/bookingIntervalAvailability';
import { photographerRequiredServices, resolveServicePhotographerId } from '@/utils/photographerAssignment';
import { DEFAULT_SHOOT_DURATION_MINUTES, sumServiceShootDurations } from '@/utils/shootDuration';
import { useBookingUnits } from '@/features/shoot-units/useMultiUnitBooking';
import { resolveUnitSchedule, unitVisitDuration } from '@/features/shoot-units/model';
import { normalizeSlotTime, type WorkingWindowMinutes } from '@/utils/suggestedTimeSlots';
import type { SchedulingFormProps, SchedulingPhotographerView } from './schedulingModel';

type Options = Required<Pick<SchedulingFormProps, 'selectedServices' | 'serviceSchedules' | 'servicePhotographers' | 'sqft' | 'photographer'>> & {
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
  selectedServices, serviceSchedules, servicePhotographers, sqft, photographer, defaultServiceDate, defaultServiceTime,
  pickerServiceId, bookingAvailabilityDate, bookingAvailabilityTime, availabilityDataDate,
  dayAvailability, workingWindowMinutes, getPhotographerScheduleData,
}: Options) {
  const units = useBookingUnits();
  const unitDraft = units?.enabled ? units.draft : undefined;
  const unitCatalog = units?.enabled ? units.catalog : undefined;
  const durationForSelection = useCallback((serviceId?: string | null, scheduleDate = defaultServiceDate, scheduleTime = defaultServiceTime, photographerId?: string | number) => {
    const selected = selectedServices.find(service => service.id === serviceId);
    const target = String(photographerId ?? (selected ? resolveServicePhotographerId(selected, servicePhotographers, photographer) : photographer) ?? '');
    if (unitDraft && unitCatalog) {
      const defaults = Object.fromEntries(unitCatalog.map(service => [service.id, {
        ...serviceSchedules[service.id], photographer_id: servicePhotographers[service.id],
        ...(service.id === serviceId ? { date: scheduleDate, time: scheduleTime, photographer_id: target } : {}),
      }]));
      const resolved = resolveUnitSchedule({ ...unitDraft, defaults }, unitCatalog, {
        date: defaultServiceDate, time: serviceId ? defaultServiceTime : scheduleTime,
        photographer_id: serviceId ? photographer : target,
      });
      return unitVisitDuration(resolved.lines, scheduleDate, target, scheduleTime);
    }
    const services = photographerRequiredServices(selectedServices).filter(service => {
      const schedule = serviceSchedules[service.id];
      const prospectiveTime = service.id === serviceId || (!serviceId && !schedule?.time)
        ? scheduleTime : schedule?.time || defaultServiceTime;
      return (service.id === serviceId || (schedule?.date || defaultServiceDate) === scheduleDate)
        && normalizeSlotTime(prospectiveTime) === normalizeSlotTime(scheduleTime)
        && (!target || service.id === serviceId || (!serviceId && !servicePhotographers[service.id]) || !resolveServicePhotographerId(service, servicePhotographers, photographer)
          || resolveServicePhotographerId(service, servicePhotographers, photographer) === target);
    });
    if (!services.length) return DEFAULT_SHOOT_DURATION_MINUTES;
    const groups = new Map<string, typeof services>();
    for (const service of services) {
      const key = service.id === serviceId || (!serviceId && !servicePhotographers[service.id]) ? target : resolveServicePhotographerId(service, servicePhotographers, photographer) || target;
      groups.set(key, [...(groups.get(key) ?? []), service]);
    }
    return Math.max(...[...groups.values()].map(group => sumServiceShootDurations(group, sqft === '' ? null : sqft, serviceSchedules)));
  }, [defaultServiceDate, defaultServiceTime, photographer, selectedServices, servicePhotographers, serviceSchedules, sqft, unitCatalog, unitDraft]);

  const isPhotographerTimeDisabled = useCallback((photographerId: string | number | undefined, value: string, serviceId?: string) => {
    const requestedDate = (serviceId ? serviceSchedules[serviceId]?.date : undefined) || defaultServiceDate;
    // Never apply another service visit's day, or another photographer's blocked times.
    const usesMainDay = requestedDate === defaultServiceDate && String(photographerId || '') === String(photographer || '');
    const photographerItem = requestedDate === availabilityDataDate ? getPhotographerScheduleData(photographerId) : null;
    const netSlots = photographerItem?.netAvailableSlots ?? [];
    return isBookingIntervalDisabled({
      time: value,
      durationMinutes: durationForSelection(serviceId, requestedDate, value, photographerId),
      workingWindow: usesMainDay ? workingWindowMinutes : null,
      blocked: usesMainDay ? dayAvailability?.blocked ?? [] : [],
      bookedSlots: photographerItem?.bookedSlots ?? [],
      unavailableSlots: photographerItem?.unavailableSlots ?? [],
      availableSlots: netSlots.length ? netSlots : photographerItem?.availabilitySlots ?? [],
    });
  }, [availabilityDataDate, dayAvailability, defaultServiceDate, durationForSelection, getPhotographerScheduleData, photographer, serviceSchedules, workingWindowMinutes]);

  const bookingDurationForPhotographer = useCallback((id: string | number) => durationForSelection(pickerServiceId, bookingAvailabilityDate, bookingAvailabilityTime, id),
    [durationForSelection, pickerServiceId, bookingAvailabilityDate, bookingAvailabilityTime]);
  return {
    bookingDurationForPhotographer,
    bookingAvailabilityDuration: durationForSelection(pickerServiceId, bookingAvailabilityDate, bookingAvailabilityTime),
    isPhotographerTimeDisabled,
  };
}
