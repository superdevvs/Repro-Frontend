import { to24Hour } from '@/utils/availabilityUtils';

type AvailabilityWindow = { start_time?: unknown; end_time?: unknown; status?: unknown };

export function normalizeBookingTime(value: string): string | null {
  const clock = to24Hour(value.trim());
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(clock);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** The check endpoint returns available ranges together with occupied ranges. */
export function isBookingTimeAvailable(time: string, slots: AvailabilityWindow[]): boolean {
  const clock = normalizeBookingTime(time);
  if (!clock) return false;
  const contains = (slot: AvailabilityWindow) => {
    const start = normalizeBookingTime(String(slot.start_time ?? ''));
    const end = normalizeBookingTime(String(slot.end_time ?? ''));
    return start !== null && end !== null && start <= clock && clock < end;
  };
  const available = (slot: AvailabilityWindow) => !slot.status || slot.status === 'available';
  return slots.some(slot => available(slot) && contains(slot))
    && !slots.some(slot => !available(slot) && contains(slot));
}
