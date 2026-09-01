import { to12Hour } from '@/utils/availabilityUtils';

type AvailabilitySlot = { start_time: string; end_time: string };

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours)) return 0;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

export const formatLocationLabel = (location?: {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}) => {
  if (!location) return '';
  return [location.address, location.city, location.state, location.zip]
    .filter((part) => part && String(part).trim().length > 0)
    .join(', ');
};

export const buildAvailabilitySegments = (slots: AvailabilitySlot[] = []) => {
  const segments: boolean[] = [];
  for (let hour = 8; hour < 20; hour += 1) {
    const segmentStart = hour * 60;
    const segmentEnd = (hour + 1) * 60;
    segments.push(slots.some((slot) => {
      const slotStart = timeToMinutes(slot.start_time);
      const slotEnd = timeToMinutes(slot.end_time);
      return slotStart < segmentEnd && slotEnd > segmentStart;
    }));
  }
  return segments;
};

export const formatAvailabilitySummary = (slots: AvailabilitySlot[] = []) => slots
  .slice(0, 3)
  .map((slot) => `${to12Hour(slot.start_time)}-${to12Hour(slot.end_time)}`)
  .join(', ');
