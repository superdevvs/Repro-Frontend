import { getShootSchedule } from '@/utils/shootSchedule';
import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import type { TravelPayload, TravelTransition } from './types';

export type DayDuration = { key: string; name: string; duration_minutes: number; min_minutes?: number; max_minutes?: number };
export type DayBooking = { id: string; start: string; end: string; duration_minutes: number; duration_items?: DayDuration[]; photographer_id: number; label: string; shoot_id: number | null; can_adjust: boolean; expected_edit_version: string | null; target?: boolean };
export type DaySchedule = { date: string; timezone: string; photographer: { id: number; name: string }; bookings: DayBooking[]; schedule_version: string };
export type VisitScope = { photographerId: number; date: string };
export type ScheduleChange = { visitScope?: VisitScope; scheduledAt: string; offsetMinutes: number; timezone: string; photographerId?: number; fromStart?: string; fromEnd?: string; serviceDurations?: Record<string, number> };
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
    return [key, { ...row, ...next, ...(change.serviceDurations?.[key] != null ? { duration_minutes: change.serviceDurations[key] } : {}) }];
  }));
}
/** Preserve legacy floating clocks when previewing an adjusted draft. */
export function shiftTravelPayload(payload: TravelPayload, minutes: number, timezone: string, scope?: VisitScope): TravelPayload {
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
    if (Array.isArray(payload[field])) next[field] = payload[field].map(row => row && typeof row === 'object'
      && (!scope || (Number(row.photographer_id ?? payload.photographer_id) === scope.photographerId
        && typeof row.scheduled_at === 'string' && localSchedule(row.scheduled_at, timezone).date === scope.date))
      ? { ...row, scheduled_at: shift(row.scheduled_at) } : row);
  }
  return next;
}
/** Move one capture visit, preserving independent service and photographer appointments. */
export function shiftTravelVisit(payload: TravelPayload, change: ScheduleChange): TravelPayload {
  if (!change.photographerId || !change.fromStart) return shiftTravelPayload(payload, change.offsetMinutes, change.timezone, change.visitScope);
  const matches = (row: Record<string, unknown>) => {
    const clock = getShootSchedule({ scheduled_at: typeof row.scheduled_at === 'string' ? row.scheduled_at : undefined, timezone: payload.timezone });
    const timestamp = buildShootScheduleTimestamp(clock.date, clock.time, change.timezone);
    const at = timestamp ? Date.parse(timestamp) : NaN;
    return rowPhotographer(payload, row) === change.photographerId && at === Date.parse(change.fromStart!);
  };
  const next = { ...payload };
  if (matches(payload)) next.scheduled_at = shiftTravelPayload(payload, change.offsetMinutes, change.timezone).scheduled_at;
  for (const field of ['services', 'service_items', 'service_lines']) {
    if (Array.isArray(payload[field])) next[field] = payload[field].map(row => row && typeof row === 'object' && matches(row)
      ? { ...row, scheduled_at: shiftTravelPayload({ ...payload, scheduled_at: row.scheduled_at }, change.offsetMinutes, change.timezone).scheduled_at,
        ...(change.serviceDurations?.[durationKey(row)] != null ? { duration_minutes: change.serviceDurations[durationKey(row)] } : {}) } : row);
  }
  return next;
}
export function durationKey(row: Record<string, unknown>) {
  return String(row.shoot_service_id ?? row.service_id ?? row.id ?? row.client_key ?? '');
}
/** Resolved payload lines already carry booking durations, independent of catalogue prices. */
export function visitDurationItems(payload: TravelPayload | null, photographer: number, start: string, timezone: string): DayDuration[] {
  if (!payload) return [];
  const rows = [payload.service_lines, payload.service_items, payload.services].find(Array.isArray) as Record<string, unknown>[] | undefined;
  return (rows ?? []).flatMap(row => {
    const clock = getShootSchedule({ scheduled_at: typeof row.scheduled_at === 'string' ? row.scheduled_at : String(payload.scheduled_at ?? ''), timezone: payload.timezone });
    const at = buildShootScheduleTimestamp(clock.date, clock.time, timezone);
    if (!at || rowPhotographer(payload, row) !== photographer || Date.parse(at) !== Date.parse(start)
      || !(Number(row.duration_minutes) > 0)) return [];
    return [{ key: durationKey(row), name: String(row.service_name ?? row.name ?? `Service ${row.service_id ?? row.id ?? ''}`), duration_minutes: Number(row.duration_minutes),
      min_minutes: Number(row.booking_duration_min_minutes) || 5, max_minutes: Number(row.booking_duration_max_minutes) || 300 }];
  });
}
function rowPhotographer(payload: TravelPayload, row: Record<string, unknown>) {
  const assignments = Array.isArray(payload.service_photographers) ? payload.service_photographers as Record<string, unknown>[] : [];
  return Number(row.photographer_id ?? assignments.find(item => String(item.service_id) === String(row.service_id ?? row.id))?.photographer_id ?? payload.photographer_id);
}
export function scheduleFieldsAfterVisit<T extends ScheduleFields>(payload: TravelPayload, fields: Record<string, T>, change: ScheduleChange) {
  const shifted = shiftTravelVisit(payload, change);
  const field = ['service_items', 'services', 'service_lines'].find(key => Array.isArray(payload[key]));
  const next = { ...fields };
  if (field) (shifted[field] as Record<string, unknown>[]).forEach((row, index) => {
    const before = (payload[field] as Record<string, unknown>[])[index];
    if (row.scheduled_at === before.scheduled_at && row.duration_minutes === before.duration_minutes) return;
    const key = durationKey(row);
    next[key] = { ...fields[key], ...getShootSchedule({ scheduled_at: row.scheduled_at, timezone: payload.timezone }), duration_minutes: Number(row.duration_minutes) };
  });
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
