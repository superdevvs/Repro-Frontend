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
import { toHhMm, uiTimeToHhmm } from "./utils";

const slotsForPhotographer = (
  selectedPhotographer: string,
  backendSlots: BackendSlot[],
  allBackendSlots: BackendSlot[]
): BackendSlot[] => {
  return selectedPhotographer === "all"
    ? allBackendSlots
    : backendSlots.filter((s) => Number(s.photographer_id) === Number(selectedPhotographer));
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
  const specific = rows.filter((s) => s.date === dateStr);
  const weekly = rows.filter((s) => !s.date && s.day_of_week && s.day_of_week.toLowerCase() === dayOfWeek);
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
    const specific = rows.filter((s) => s.date === dayStr);
    const weekly = rows.filter((s) => !s.date && s.day_of_week?.toLowerCase() === dow);
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
    const specific = rows.filter((s) => s.date === dayStr);
    const weekly = rows.filter((s) => !s.date && s.day_of_week?.toLowerCase() === dow);
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
      if (slot.date === dateStr) return true;
      if (!slot.date && slot.day_of_week && dayOfWeek) {
        return slot.day_of_week.toLowerCase() === dayOfWeek.toLowerCase();
      }
      return false;
    } else if (dayOfWeek) {
      return !slot.date && slot.day_of_week?.toLowerCase() === dayOfWeek.toLowerCase();
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
  const specific = slots.filter((s) => s.date === dayStr);
  const weekly = slots.filter((s) => !s.date && s.day_of_week?.toLowerCase() === dow);
  const relevantSlots = specific.length > 0 ? specific : weekly;

  const availableSlot = relevantSlots.find((s) => (s.status ?? "available") !== "unavailable");
  if (availableSlot) {
    return `Available (${toHhMm(availableSlot.start_time)} - ${toHhMm(availableSlot.end_time)})`;
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
