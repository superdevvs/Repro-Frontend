import type { Availability, Photographer } from "@/types/availability";
import { toMinutesOfDay } from "./availabilitySlotSegments";

export type TimeWindow = { start: number; end: number };
export type PhotographerDay = {
  photographer: Photographer;
  rules: Availability[];
  bookings: Availability[];
  blocks: Availability[];
  working: TimeWindow[];
  free: TimeWindow[];
  freeMinutes: number;
};
export const clockTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export const freeDuration = (minutes: number, compact = false) => {
  const hours = Math.floor(minutes / 60),
    remainder = minutes % 60;
  return hours
    ? `${hours}h${remainder ? `${compact ? "" : " "}${remainder}${compact ? "" : "m"}` : ""}`
    : `${remainder}m`;
};
export function mergeWindows(windows: TimeWindow[]): TimeWindow[] {
  const result: TimeWindow[] = [];
  for (const window of [...windows]
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && last.end >= window.start)
      last.end = Math.max(last.end, window.end);
    else result.push({ ...window });
  }
  return result;
}
export function subtractWindows(
  windows: TimeWindow[],
  occupied: TimeWindow[],
): TimeWindow[] {
  const result: TimeWindow[] = [];
  for (const window of mergeWindows(windows)) {
    let cursor = window.start;
    for (const block of mergeWindows(occupied)) {
      if (block.end <= cursor || block.start >= window.end) continue;
      if (block.start > cursor)
        result.push({ start: cursor, end: Math.min(block.start, window.end) });
      cursor = Math.max(cursor, block.end);
      if (cursor >= window.end) break;
    }
    if (cursor < window.end) result.push({ start: cursor, end: window.end });
  }
  return result;
}
export function photographerDay(
  photographer: Photographer,
  slots: Availability[],
): PhotographerDay {
  const rows = slots.filter((row) => row.photographerId === photographer.id);
  const rules = rows.filter((row) => row.status === "available");
  const bookings = rows.filter((row) => row.status === "booked");
  const blocks = rows.filter((row) => row.status === "unavailable");
  const range = (row: Availability) => ({
    start: toMinutesOfDay(row.startTime),
    end: toMinutesOfDay(row.endTime),
  });
  const working = mergeWindows(rules.map(range));
  const free = subtractWindows(working, [...bookings, ...blocks].map(range));
  return {
    photographer,
    rules,
    bookings,
    blocks,
    working,
    free,
    freeMinutes: free.reduce((sum, w) => sum + w.end - w.start, 0),
  };
}
export const summarizeDays = (days: PhotographerDay[]) => ({
  freeMinutes: days.reduce((sum, day) => sum + day.freeMinutes, 0),
  peopleFree: days.filter((day) => day.free.some((w) => w.end - w.start >= 60))
    .length,
  shoots: new Set(
    days.flatMap((day) =>
      day.bookings.map((row) => row.shoot_id ?? row.shootDetails?.id ?? row.id),
    ),
  ).size,
  configured: days.some((day) => day.working.length || day.blocks.length),
});
