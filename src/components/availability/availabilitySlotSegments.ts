import type { Availability } from '@/types/availability';

/**
 * Convert "HH:mm" to total minutes since midnight.
 */
export const toMinutesOfDay = (hhmm: string): number => {
  if (!hhmm) return 0;
  const [hStr, mStr] = hhmm.split(":");
  return (Number(hStr) || 0) * 60 + (Number(mStr) || 0);
};

/**
 * Convert total minutes since midnight back to "HH:mm".
 */
const minutesToHhmm = (minutes: number): string => {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

/**
 * Split available slots around overlapping unavailable slots so the calendar
 * shows e.g. "Available 9 AM – 10 AM | Unavailable 10 AM – 11 AM | Available 11 AM – 5 PM"
 * instead of an Available bar that visually runs straight through the
 * unavailable block. Operates per-photographer so slots from different
 * photographers don't affect each other.
 */
export const splitAvailableAroundUnavailable = (slots: Availability[]): Availability[] => {
  const result: Availability[] = [];
  for (const slot of slots) {
    if (slot.status !== "available") {
      result.push(slot);
      continue;
    }

    const slotStart = toMinutesOfDay(slot.startTime);
    const slotEnd = toMinutesOfDay(slot.endTime);

    if (slotEnd <= slotStart) {
      result.push(slot);
      continue;
    }

    const overlaps = slots
      .filter(
        (other) =>
          other.id !== slot.id &&
          other.status === "unavailable" &&
          (other.photographerId == null || slot.photographerId == null
            ? true
            : String(other.photographerId) === String(slot.photographerId)),
      )
      .map((other) => ({
        start: Math.max(slotStart, toMinutesOfDay(other.startTime)),
        end: Math.min(slotEnd, toMinutesOfDay(other.endTime)),
      }))
      .filter((range) => range.end > range.start)
      .sort((a, b) => a.start - b.start);

    if (overlaps.length === 0) {
      result.push(slot);
      continue;
    }

    let cursor = slotStart;
    let segIdx = 0;
    for (const range of overlaps) {
      if (range.start > cursor) {
        result.push({
          ...slot,
          id: `${slot.id}-seg-${segIdx++}`,
          startTime: minutesToHhmm(cursor),
          endTime: minutesToHhmm(range.start),
        });
      }
      cursor = Math.max(cursor, range.end);
    }
    if (cursor < slotEnd) {
      result.push({
        ...slot,
        id: `${slot.id}-seg-${segIdx++}`,
        startTime: minutesToHhmm(cursor),
        endTime: minutesToHhmm(slotEnd),
      });
    }
  }

  return result;
};
