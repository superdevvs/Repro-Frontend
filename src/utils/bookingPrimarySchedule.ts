import { format } from 'date-fns';
import { to24Hour } from './availabilityUtils';
import { resolveServicePhotographerId, serviceRequiresPhotographer, type AssignableService } from './photographerAssignment';

/** Old drafts used empty override strings to mean inherited; new clears stay explicit. */
export function restoreBookingServiceSchedules<T extends Record<string, { date?: string; time?: string }>>(schedules: T, version: unknown): T {
  if (version === 2) return schedules;
  return Object.fromEntries(Object.entries(schedules).map(([id, schedule]) => {
    const row = { ...schedule };
    if (row.date === '') delete row.date;
    if (row.time === '') delete row.time;
    return [id, row];
  })) as T;
}

/** The legacy shoot header follows the first capture appointment; rows stay independent. */
export function bookingPrimarySchedule(
  services: ReadonlyArray<AssignableService>,
  schedules: Record<string, { date?: string; time?: string }>,
  date: Date | undefined,
  time: string,
  photographer: string,
  assignments: Record<string, string>,
) {
  const primary = services.find(serviceRequiresPhotographer) ?? services[0];
  const schedule = primary ? schedules[primary.id] : undefined;
  return {
    date: schedule?.date ?? (date ? format(date, 'yyyy-MM-dd') : ''),
    time: to24Hour(schedule?.time ?? time),
    photographer: primary ? resolveServicePhotographerId(primary, assignments, photographer) : null,
  };
}
