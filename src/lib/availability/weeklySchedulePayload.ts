import type { WeeklyScheduleItem } from "@/types/availability";
import { uiTimeToHhmm } from "./utils";

const dayNames: Record<string, string> = {
  Mon: "monday", Tue: "tuesday", Wed: "wednesday", Thu: "thursday",
  Fri: "friday", Sat: "saturday", Sun: "sunday",
};

/** Build the replacement request from the editor's independent weekday hours. */
export function buildWeeklySchedulePayload(
  photographerId: string,
  schedule: WeeklyScheduleItem[],
  note: string,
) {
  return {
    photographer_id: Number(photographerId),
    availabilities: schedule.filter(day => day.active).map(day => ({
      day_of_week: dayNames[day.day] || day.day.toLowerCase(),
      start_time: uiTimeToHhmm(day.startTime),
      end_time: uiTimeToHhmm(day.endTime),
      status: "available" as const,
      note: note.trim() || null,
    })),
  };
}
