import { slotTimeToMinutes, type WorkingWindowMinutes } from './suggestedTimeSlots';
import { BOOKING_TRAVEL_BUFFER_MINUTES } from './shootDuration';

type Slot = { start_time?: string; end_time?: string };

/** Match an entire appointment to known availability; the API remains authoritative. */
export function isBookingIntervalDisabled({
  time, durationMinutes, workingWindow, blocked = [], bookedSlots = [], unavailableSlots = [],
  availableSlots = [], travelBufferMinutes = BOOKING_TRAVEL_BUFFER_MINUTES,
}: {
  time: string;
  durationMinutes: number;
  workingWindow?: WorkingWindowMinutes | null;
  blocked?: Array<{ start: string; end: string }>;
  bookedSlots?: Slot[];
  unavailableSlots?: Slot[];
  availableSlots?: Slot[];
  travelBufferMinutes?: number;
}): boolean {
  const start = slotTimeToMinutes(time);
  const end = start + durationMinutes;
  if (workingWindow && (start < workingWindow.start || end > workingWindow.end)) return true;
  if (blocked.some(slot => start < slotTimeToMinutes(slot.end) && end > slotTimeToMinutes(slot.start))) return true;
  const overlaps = (slots: Slot[], buffer: number) => slots.some(slot =>
    slot.start_time && slot.end_time
      && start < slotTimeToMinutes(slot.end_time) + buffer
      && end + buffer > slotTimeToMinutes(slot.start_time));
  if (overlaps(bookedSlots, travelBufferMinutes) || overlaps(unavailableSlots, 0)) return true;
  return availableSlots.length > 0 && !availableSlots.some(slot =>
    slot.start_time && slot.end_time
      && start >= slotTimeToMinutes(slot.start_time) && end <= slotTimeToMinutes(slot.end_time));
}
