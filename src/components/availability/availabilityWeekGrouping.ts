import type { Availability } from "@/types/availability";
import { weekViewEndHour, weekViewLabelHours } from "@/lib/availability/utils";
import { toMinutesOfDay } from "./availabilitySlotSegments";

export const weekStartWindows = weekViewLabelHours.map(hour => ({
  start: hour,
  end: Math.min(hour + 2, weekViewEndHour),
}));

/** Group starts, not durations: keep every entry and its exact times for inspection. */
export function groupWeekStarts(slots: Availability[]) {
  return weekStartWindows.map(({ start, end }, index) => {
    const entries = slots.filter(slot => {
      const minutes = toMinutesOfDay(slot.startTime);
      return minutes < end * 60 && (index === 0 ? toMinutesOfDay(slot.endTime) > start * 60 : minutes >= start * 60);
    }).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.photographerId.localeCompare(b.photographerId));
    const people = new Map<string, Availability>();
    const priority = { booked: 0, unavailable: 1, available: 2 };
    for (const entry of entries) {
      const previous = people.get(entry.photographerId);
      if (!previous || priority[entry.status] < priority[previous.status]) people.set(entry.photographerId, entry);
    }
    return { start, end, entries, people: [...people.values()] };
  });
}
