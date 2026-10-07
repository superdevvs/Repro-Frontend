import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type {
  Availability,
  AvailabilityStatus,
  BackendSlot,
  WeeklyScheduleItem,
} from "@/types/availability";
import { mergeBookedSlots, normalizeAvailabilityDate, toHhMm, uiTimeToHhmm } from "./utils";

const slotCalendarDate = (slot: BackendSlot): string | null =>
  normalizeAvailabilityDate(slot.date ?? null);

const slotsForPhotographer = (
  selectedPhotographer: string,
  backendSlots: BackendSlot[],
  allBackendSlots: BackendSlot[]
): BackendSlot[] => {
  return mergeBookedSlots(selectedPhotographer === "all"
    ? allBackendSlots
    : backendSlots.filter((s) => Number(s.photographer_id) === Number(selectedPhotographer)));
};

const toAvailability = (s: BackendSlot, dateStr: string, idx: number, specific: BackendSlot[]): Availability => ({
  id: String(s.id ?? `${dateStr}-${idx}`),
  photographerId: String(s.photographer_id),
  date: dateStr,
  startTime: toHhMm(s.start_time),
  endTime: toHhMm(s.end_time),
  status: (s.status === "unavailable"
    ? "unavailable"
    : s.status === "booked"
    ? "booked"
    : "available") as AvailabilityStatus,
  origin: specific.some((sp) => sp.id === s.id) ? "specific" : "weekly",
  isRandom: Boolean(s.isRandom),
  shoot_id: s.shoot_id,
  shootDetails: s.shoot_details,
  shootTitle: s.shoot_details?.title ?? s.shoot_details?.address,
});

export interface SlotSelectorDeps {
  selectedPhotographer: string;
  backendSlots: BackendSlot[];
  allBackendSlots: BackendSlot[];
}

export const buildSelectedDateAvailabilities = (
  deps: SlotSelectorDeps,
  date: Date | undefined
): Availability[] => {
  if (!date || !deps.selectedPhotographer) return [];
  const dateStr = format(date, "yyyy-MM-dd");
  const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const rows = slotsForPhotographer(deps.selectedPhotographer, deps.backendSlots, deps.allBackendSlots);
  const specific = rows.filter((s) => slotCalendarDate(s) === dateStr);
  const weekly = rows.filter((s) => !slotCalendarDate(s) && s.day_of_week && s.day_of_week.toLowerCase() === dayOfWeek);
  const bookedSlots = specific.filter((s) => s.status === "booked");
  const nonBookedSpecific = specific.filter((s) => s.status !== "booked");
  const availabilitySlots = nonBookedSpecific.length > 0 ? nonBookedSpecific : weekly;
  const allSlots = [...bookedSlots, ...availabilitySlots];
  return allSlots.map((s, idx) => toAvailability(s, dateStr, idx, specific));
};

export const buildWeekAvailabilities = (
  deps: SlotSelectorDeps,
  date: Date | undefined
): Availability[] => {
  if (!date || !deps.selectedPhotographer) return [];
  const weekStart = startOfWeek(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rows = slotsForPhotographer(deps.selectedPhotographer, deps.backendSlots, deps.allBackendSlots);
  const result: Availability[] = [];
  weekDays.forEach((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dow = day.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const specific = rows.filter((s) => slotCalendarDate(s) === dayStr);
    const weekly = rows.filter((s) => !slotCalendarDate(s) && s.day_of_week?.toLowerCase() === dow);
    const bookedSlots = specific.filter((s) => s.status === "booked");
    const nonBookedSpecific = specific.filter((s) => s.status !== "booked");
    const availabilitySlots = nonBookedSpecific.length > 0 ? nonBookedSpecific : weekly;
    const allSlots = [...bookedSlots, ...availabilitySlots];
    allSlots.forEach((s, idx) => result.push(toAvailability(s, dayStr, idx, specific)));
  });
  return result;
};

export const buildMonthAvailabilities = (
  deps: SlotSelectorDeps,
  date: Date | undefined
): Availability[] => {
  if (!date || !deps.selectedPhotographer) return [];
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const rows = slotsForPhotographer(deps.selectedPhotographer, deps.backendSlots, deps.allBackendSlots);
  const result: Availability[] = [];
  monthDays.forEach((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dow = day.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const specific = rows.filter((s) => slotCalendarDate(s) === dayStr);
    const weekly = rows.filter((s) => !slotCalendarDate(s) && s.day_of_week?.toLowerCase() === dow);
    const allSlots = specific.length > 0 ? specific : weekly;
    allSlots.forEach((s, idx) => result.push(toAvailability(s, dayStr, idx, specific)));
  });
  return result;
};

export const checkTimeOverlap = (
  deps: SlotSelectorDeps,
  startTime: string,
  endTime: string,
  dateStr?: string,
  dayOfWeek?: string,
  excludeSlotId?: string
): boolean => {
  const start = uiTimeToHhmm(startTime);
  const end = uiTimeToHhmm(endTime);
  if (!start || !end) return false;

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const rows = slotsForPhotographer(deps.selectedPhotographer, deps.backendSlots, deps.allBackendSlots);

  const relevantSlots = rows.filter((slot) => {
    if (excludeSlotId && String(slot.id) === excludeSlotId) return false;
    if (dateStr) {
      if (slotCalendarDate(slot) === dateStr) return true;
      if (!slotCalendarDate(slot) && slot.day_of_week && dayOfWeek) {
        return slot.day_of_week.toLowerCase() === dayOfWeek.toLowerCase();
      }
      return false;
    } else if (dayOfWeek) {
      return !slotCalendarDate(slot) && slot.day_of_week?.toLowerCase() === dayOfWeek.toLowerCase();
    }
    return false;
  });

  return relevantSlots.some((slot) => {
    const slotStart = uiTimeToHhmm(slot.start_time);
    const slotEnd = uiTimeToHhmm(slot.end_time);
    if (!slotStart || !slotEnd) return false;
    const [slotStartH, slotStartM] = slotStart.split(":").map(Number);
    const [slotEndH, slotEndM] = slotEnd.split(":").map(Number);
    const slotStartMinutes = slotStartH * 60 + slotStartM;
    const slotEndMinutes = slotEndH * 60 + slotEndM;
    const isAdjacent = startMinutes === slotEndMinutes || slotStartMinutes === endMinutes;
    if (isAdjacent) return false;
    return startMinutes < slotEndMinutes && slotStartMinutes < endMinutes;
  });
};

const DAY_SHORT_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_LONG_NAMES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/** Build a Mon–Sun weekly schedule editor model from recurring (dateless) available slots. */
export const buildWeeklyScheduleFromSlots = (
  slots: BackendSlot[],
  fallback: WeeklyScheduleItem[]
): WeeklyScheduleItem[] => {
  return DAY_SHORT_LABELS.map((day, index) => {
    const longName = DAY_LONG_NAMES[index];
    const daySlots = slots.filter(
      (s) =>
        !slotCalendarDate(s) &&
        s.day_of_week?.toLowerCase() === longName &&
        (s.status ?? "available") === "available"
    );
    const primary = daySlots[0];
    const base = fallback[index] ?? {
      day,
      active: false,
      startTime: "09:00",
      endTime: "17:00",
    };
    if (!primary) {
      return { ...base, day, active: false };
    }
    return {
      day,
      active: true,
      startTime: toHhMm(primary.start_time) || base.startTime,
      endTime: toHhMm(primary.end_time) || base.endTime,
    };
  });
};

export const buildPhotographerAvailabilityLabel = (
  photographerId: string,
  date: Date | undefined,
  deps: {
    selectedPhotographer: string;
    backendSlots: BackendSlot[];
    photographerAvailabilityMap: Record<string, BackendSlot[]>;
    photographerWeeklySchedules: Record<string, WeeklyScheduleItem[]>;
  }
): string => {
  if (!date) return "Not available";

  const selectedId = String(deps.selectedPhotographer);
  const slots =
    selectedId === String(photographerId) && deps.backendSlots.length > 0
      ? deps.backendSlots
      : deps.photographerAvailabilityMap[photographerId] || [];

  const dayStr = format(date, "yyyy-MM-dd");
  const dow = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const specific = slots.filter((s) => slotCalendarDate(s) === dayStr);
  const weekly = slots.filter((s) => !slotCalendarDate(s) && s.day_of_week?.toLowerCase() === dow);

  // Same merge as the calendar: booked date slots always win visibility; when the
  // only dated rows are bookings, still surface weekly availability underneath —
  // but never label a booked/unavailable window as Available.
  const bookedSlots = specific.filter((s) => s.status === "booked");
  const nonBookedSpecific = specific.filter((s) => s.status !== "booked");
  const availabilitySlots = nonBookedSpecific.length > 0 ? nonBookedSpecific : weekly;
  const relevantSlots = [...bookedSlots, ...availabilitySlots];

  const bookedSlot = relevantSlots.find((s) => s.status === "booked");
  if (bookedSlot) {
    const time = `${toHhMm(bookedSlot.start_time)} - ${toHhMm(bookedSlot.end_time)}`;
    const shootId = bookedSlot.shoot_id ?? bookedSlot.shoot_details?.id;
    return shootId != null ? `Booked (#${shootId} · ${time})` : `Booked (${time})`;
  }

  const availableSlot = relevantSlots.find(
    (s) => (s.status ?? "available") === "available"
  );
  if (availableSlot) {
    return `Available (${toHhMm(availableSlot.start_time)} - ${toHhMm(availableSlot.end_time)})`;
  }

  const unavailableSlot = relevantSlots.find((s) => s.status === "unavailable");
  if (unavailableSlot) {
    return `Unavailable (${toHhMm(unavailableSlot.start_time)} - ${toHhMm(unavailableSlot.end_time)})`;
  }

  const schedule = deps.photographerWeeklySchedules[photographerId];
  if (schedule && schedule.length > 0) {
    const selectedDay = format(date, "EEE");
    const activeDay = schedule.find((d) => d.active && d.day === selectedDay);
    if (activeDay) {
      return `Available (${activeDay.startTime} - ${activeDay.endTime})`;
    }
  }

  return "Not available";
};
