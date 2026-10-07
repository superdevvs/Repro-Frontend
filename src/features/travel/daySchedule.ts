import { getShootSchedule } from '@/utils/shootSchedule';
import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import type { TravelPayload, TravelTransition } from './types';

export type DayBooking = { id: string; start: string; end: string; duration_minutes: number; photographer_id: number; label: string; shoot_id: number | null; can_adjust: boolean; expected_edit_version: string | null; target?: boolean };
export type DaySchedule = { date: string; timezone: string; photographer: { id: number; name: string }; bookings: DayBooking[]; schedule_version: string };
export type ScheduleChange = { scheduledAt: string; offsetMinutes: number; timezone: string };
export type ScheduleFields = { date?: string; time?: string; duration_minutes?: number };

export function localSchedule(at: string, timezone: string) {
  return getShootSchedule({ scheduled_at: at, timezone });
}
export function minuteOfDay(at: string, timezone: string) {
  const { time } = localSchedule(at, timezone);
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
export function atMinute(date: string, minutes: number, timezone: string, original?: string) {
  const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const value = buildShootScheduleTimestamp(date, time, timezone, original);
  if (!value) throw new Error('Choose a valid time.');
  return value;
}
export function shiftScheduleFields<T extends ScheduleFields>(fields: Record<string, T>, base: ScheduleFields, change: ScheduleChange): Record<string, T> {
  return Object.fromEntries(Object.entries(fields).map(([key, row]) => {
    const at = buildShootScheduleTimestamp(row.date || base.date || '', row.time || base.time || '', change.timezone);
    if (!at) return [key, row];
    const next = localSchedule(new Date(Date.parse(at) + change.offsetMinutes * 60000).toISOString(), change.timezone);
    return [key, { ...row, ...next }];
  }));
}
/** Preserve legacy floating clocks when previewing an adjusted draft. */
export function shiftTravelPayload(payload: TravelPayload, minutes: number, timezone: string): TravelPayload {
  const shift = (value: unknown) => {
    if (typeof value !== 'string' || !value) return value;
    const clock = getShootSchedule({ scheduled_at: value, timezone: payload.timezone });
    const at = buildShootScheduleTimestamp(clock.date, clock.time, timezone, payload.timezone ? value : undefined);
    if (!at) return value;
    const shifted = new Date(Date.parse(at) + minutes * 60000).toISOString();
    if (payload.timezone) return shifted;
    const local = localSchedule(shifted, timezone);
    return buildShootScheduleTimestamp(local.date, local.time, null);
  };
  const next = { ...payload, scheduled_at: shift(payload.scheduled_at) };
  for (const field of ['services', 'service_items', 'service_lines']) {
    if (Array.isArray(payload[field])) next[field] = payload[field].map(row => row && typeof row === 'object' ? { ...row, scheduled_at: shift(row.scheduled_at) } : row);
  }
  return next;
}
export function sameDayTransitions(transitions: TravelTransition[], timezone: string) {
  return transitions.filter(leg => !leg.neighbor || !leg.candidate_start
    || localSchedule(leg.neighbor.scheduled_at, timezone).date === localSchedule(leg.candidate_start, timezone).date);
}
export function overlaps(bookings: DayBooking[]) {
  return bookings.some((a, i) => bookings.some((b, j) => i < j && a.photographer_id === b.photographer_id
    && Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end)));
}
