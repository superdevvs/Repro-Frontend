import { formatTimeForDisplay } from '@/utils/availabilityUtils';

/** Per-service schedule entry as held in the booking wizard. */
export interface ServiceScheduleEntry {
  date?: string;
  time?: string;
}

export type ServiceScheduleMap = Record<string, ServiceScheduleEntry | undefined>;

/**
 * Derive the "<date> at <time>" label shown for a single service row in the
 * Booking_Summary. Each service prefers its OWN per-service schedule and only
 * falls back to the booking-level date/time when its own value is missing, so
 * one service's time never leaks into another's row (no cross-contamination).
 *
 * The time is always rendered through the Time_Formatter
 * (`formatTimeForDisplay`) so canonical `HH:mm` / `HH:mm:ss` values are shown
 * as a 12-hour wall-clock string (e.g. `09:30` -> `9:30 AM`).
 *
 * Pure and side-effect free: returns a string and reads only its arguments.
 */
export function getServiceScheduleLabel(
  serviceId: string,
  serviceSchedules: ServiceScheduleMap,
  fallbackDate?: string,
  fallbackTime?: string,
): string {
  const serviceSchedule = serviceSchedules[serviceId];
  const scheduleDate = serviceSchedule?.date || fallbackDate;
  const scheduleTime = serviceSchedule?.time || fallbackTime;
  const timeLabel = scheduleTime ? formatTimeForDisplay(scheduleTime) : '';
  return [scheduleDate, timeLabel].filter(Boolean).join(' at ');
}
