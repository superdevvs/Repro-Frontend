import { expect, it } from "vitest";
import { buildWeeklySchedulePayload } from "./weeklySchedulePayload";

it("preserves separate weekday hours and notes while omitting inactive days", () => {
  expect(buildWeeklySchedulePayload("41", [
    { day: "Mon", active: true, startTime: "10:30", endTime: "17:00" },
    { day: "Tuesday", active: true, startTime: "09:00", endTime: "15:00" },
    { day: "Wed", active: false, startTime: "09:00", endTime: "17:00" },
  ], "  Morning cover  ")).toEqual({
    photographer_id: 41,
    availabilities: [
      { day_of_week: "monday", start_time: "10:30", end_time: "17:00", status: "available", note: "Morning cover" },
      { day_of_week: "tuesday", start_time: "09:00", end_time: "15:00", status: "available", note: "Morning cover" },
    ],
  });
});

it("allows clearing the recurring schedule and a saved note", () => {
  expect(buildWeeklySchedulePayload("41", [], "").availabilities).toEqual([]);
  expect(buildWeeklySchedulePayload("41", [{ day: "Mon", active: true, startTime: "09:00", endTime: "17:00" }], " ").availabilities[0].note).toBeNull();
});
