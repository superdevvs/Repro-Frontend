import { describe, it, expect } from "vitest";
import {
  buildMonthAvailabilities,
  buildPhotographerAvailabilityLabel,
  buildSelectedDateAvailabilities,
  buildWeekAvailabilities,
  checkTimeOverlap,
  type SlotSelectorDeps,
} from "./selectors";
import type { BackendSlot, WeeklyScheduleItem } from "@/types/availability";

// April 19, 2026 is a Sunday (local time). Using Date(year, monthIndex, day)
// avoids the UTC-parse-shift that "2026-04-19" string would introduce in
// negative-offset timezones.
const APR_19_2026_SUNDAY = new Date(2026, 3, 19);

const makeSlot = (overrides: Partial<BackendSlot>): BackendSlot => ({
  id: 1,
  photographer_id: 10,
  start_time: "09:00",
  end_time: "17:00",
  ...overrides,
});

const deps = (
  slots: BackendSlot[],
  selectedPhotographer = "10",
  allBackendSlots: BackendSlot[] = []
): SlotSelectorDeps => ({
  selectedPhotographer,
  backendSlots: slots,
  allBackendSlots,
});

describe("buildSelectedDateAvailabilities", () => {
  it("returns empty array when date is undefined", () => {
    expect(buildSelectedDateAvailabilities(deps([]), undefined)).toEqual([]);
  });

  it("returns empty when no photographer is selected", () => {
    expect(
      buildSelectedDateAvailabilities(deps([], ""), APR_19_2026_SUNDAY)
    ).toEqual([]);
  });

  it("returns specific-date slots tagged origin=specific", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: "2026-04-19",
        start_time: "09:00",
        end_time: "12:00",
        status: "available",
      }),
    ];
    const result = buildSelectedDateAvailabilities(
      deps(slots),
      APR_19_2026_SUNDAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe("specific");
    expect(result[0].status).toBe("available");
    expect(result[0].startTime).toBe("09:00");
    expect(result[0].endTime).toBe("12:00");
  });

  it("falls back to weekly slot when no specific slot exists", () => {
    const slots = [
      makeSlot({
        id: 2,
        date: null,
        day_of_week: "sunday",
        start_time: "10:00",
        end_time: "14:00",
        status: "available",
      }),
    ];
    const result = buildSelectedDateAvailabilities(
      deps(slots),
      APR_19_2026_SUNDAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe("weekly");
    expect(result[0].startTime).toBe("10:00");
  });

  it("keeps booked specific slot alongside weekly availability", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: "2026-04-19",
        status: "booked",
        start_time: "10:00",
        end_time: "11:00",
      }),
      makeSlot({
        id: 2,
        date: null,
        day_of_week: "sunday",
        start_time: "09:00",
        end_time: "17:00",
        status: "available",
      }),
    ];
    const result = buildSelectedDateAvailabilities(
      deps(slots),
      APR_19_2026_SUNDAY
    );
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("booked");
    expect(result[1].origin).toBe("weekly");
  });

  it("ignores weekly when a non-booked specific slot exists", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: "2026-04-19",
        status: "available",
        start_time: "09:00",
        end_time: "12:00",
      }),
      makeSlot({
        id: 2,
        date: null,
        day_of_week: "sunday",
        status: "available",
        start_time: "13:00",
        end_time: "18:00",
      }),
    ];
    const result = buildSelectedDateAvailabilities(
      deps(slots),
      APR_19_2026_SUNDAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe("specific");
  });

  it("filters by photographer_id when a specific photographer is selected", () => {
    const slots = [
      makeSlot({
        id: 1,
        photographer_id: 10,
        date: "2026-04-19",
        status: "available",
      }),
      makeSlot({
        id: 2,
        photographer_id: 20,
        date: "2026-04-19",
        status: "available",
      }),
    ];
    const result = buildSelectedDateAvailabilities(
      deps(slots, "10"),
      APR_19_2026_SUNDAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].photographerId).toBe("10");
  });

  it("uses allBackendSlots when selectedPhotographer === 'all'", () => {
    const all = [
      makeSlot({ id: 1, photographer_id: 10, date: "2026-04-19" }),
      makeSlot({ id: 2, photographer_id: 20, date: "2026-04-19" }),
    ];
    const result = buildSelectedDateAvailabilities(
      deps([], "all", all),
      APR_19_2026_SUNDAY
    );
    expect(result).toHaveLength(2);
  });
});

describe("buildWeekAvailabilities", () => {
  it("returns empty array when date is undefined", () => {
    expect(buildWeekAvailabilities(deps([]), undefined)).toEqual([]);
  });

  it("covers all 7 days from the week's start (Sun-Sat)", () => {
    const dows = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const slots = dows.map((dow, i) =>
      makeSlot({ id: i + 1, date: null, day_of_week: dow, status: "available" })
    );
    const result = buildWeekAvailabilities(deps(slots), APR_19_2026_SUNDAY);
    expect(result).toHaveLength(7);
    const dates = result.map((r) => r.date);
    expect(dates).toEqual([
      "2026-04-19",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
      "2026-04-25",
    ]);
  });

  it("prefers specific slot over weekly when both fall on same day", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: "2026-04-19",
        status: "available",
        start_time: "09:00",
        end_time: "10:00",
      }),
      makeSlot({
        id: 2,
        date: null,
        day_of_week: "sunday",
        status: "available",
        start_time: "13:00",
        end_time: "14:00",
      }),
    ];
    const result = buildWeekAvailabilities(deps(slots), APR_19_2026_SUNDAY);
    const sundaySlots = result.filter((r) => r.date === "2026-04-19");
    expect(sundaySlots).toHaveLength(1);
    expect(sundaySlots[0].origin).toBe("specific");
    expect(sundaySlots[0].startTime).toBe("09:00");
  });
});

describe("buildMonthAvailabilities", () => {
  it("returns empty array when date is undefined", () => {
    expect(buildMonthAvailabilities(deps([]), undefined)).toEqual([]);
  });

  it("materializes a weekly slot on every matching weekday of the month", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: null,
        day_of_week: "tuesday",
        status: "available",
      }),
    ];
    const result = buildMonthAvailabilities(deps(slots), APR_19_2026_SUNDAY);
    // Tuesdays in April 2026: 7, 14, 21, 28 = 4
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.date)).toEqual([
      "2026-04-07",
      "2026-04-14",
      "2026-04-21",
      "2026-04-28",
    ]);
  });

  it("specific slot overrides weekly for its date", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: null,
        day_of_week: "tuesday",
        start_time: "09:00",
        end_time: "17:00",
        status: "available",
      }),
      makeSlot({
        id: 2,
        date: "2026-04-07",
        start_time: "10:00",
        end_time: "12:00",
        status: "unavailable",
      }),
    ];
    const result = buildMonthAvailabilities(deps(slots), APR_19_2026_SUNDAY);
    const apr07 = result.filter((r) => r.date === "2026-04-07");
    expect(apr07).toHaveLength(1);
    expect(apr07[0].status).toBe("unavailable");
    expect(apr07[0].origin).toBe("specific");
  });
});

describe("checkTimeOverlap", () => {
  it("treats adjacent ranges (09-12 and 12-17) as non-overlapping", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: "2026-04-19",
        start_time: "12:00",
        end_time: "17:00",
      }),
    ];
    expect(
      checkTimeOverlap(deps(slots), "09:00", "12:00", "2026-04-19", "sunday")
    ).toBe(false);
  });

  it("detects partial overlap (09-13 vs 12-17)", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: "2026-04-19",
        start_time: "12:00",
        end_time: "17:00",
      }),
    ];
    expect(
      checkTimeOverlap(deps(slots), "09:00", "13:00", "2026-04-19", "sunday")
    ).toBe(true);
  });

  it("detects full-containment overlap", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: "2026-04-19",
        start_time: "09:00",
        end_time: "17:00",
      }),
    ];
    expect(
      checkTimeOverlap(deps(slots), "10:00", "12:00", "2026-04-19", "sunday")
    ).toBe(true);
  });

  it("skips the slot matching excludeSlotId", () => {
    const slots = [
      makeSlot({
        id: 5,
        date: "2026-04-19",
        start_time: "09:00",
        end_time: "12:00",
      }),
    ];
    expect(
      checkTimeOverlap(deps(slots), "09:00", "12:00", "2026-04-19", "sunday", "5")
    ).toBe(false);
  });

  it("falls back to weekly slots for the given dayOfWeek when no specific-date slot matches", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: null,
        day_of_week: "sunday",
        start_time: "09:00",
        end_time: "12:00",
      }),
    ];
    expect(
      checkTimeOverlap(deps(slots), "10:00", "11:00", "2026-04-19", "sunday")
    ).toBe(true);
  });

  it("matches on day_of_week only when no dateStr provided", () => {
    const slots = [
      makeSlot({
        id: 1,
        date: null,
        day_of_week: "monday",
        start_time: "09:00",
        end_time: "12:00",
      }),
    ];
    expect(
      checkTimeOverlap(deps(slots), "10:00", "11:00", undefined, "monday")
    ).toBe(true);
  });

  it("returns false when start or end is empty", () => {
    expect(checkTimeOverlap(deps([]), "", "12:00")).toBe(false);
  });

  it("returns false when neither dateStr nor dayOfWeek is provided", () => {
    const slots = [makeSlot({ id: 1, date: null, day_of_week: "monday" })];
    expect(checkTimeOverlap(deps(slots), "09:00", "12:00")).toBe(false);
  });
});

describe("buildPhotographerAvailabilityLabel", () => {
  const baseDeps = {
    selectedPhotographer: "10",
    backendSlots: [] as BackendSlot[],
    photographerAvailabilityMap: {} as Record<string, BackendSlot[]>,
    photographerWeeklySchedules: {} as Record<string, WeeklyScheduleItem[]>,
  };

  it("returns 'Not available' when date is undefined", () => {
    expect(buildPhotographerAvailabilityLabel("10", undefined, baseDeps)).toBe(
      "Not available"
    );
  });

  it("uses backendSlots for the currently selected photographer", () => {
    const slots = [
      makeSlot({
        id: 1,
        photographer_id: 10,
        date: "2026-04-19",
        start_time: "09:00",
        end_time: "17:00",
        status: "available",
      }),
    ];
    expect(
      buildPhotographerAvailabilityLabel("10", APR_19_2026_SUNDAY, {
        ...baseDeps,
        backendSlots: slots,
      })
    ).toBe("Available (09:00 - 17:00)");
  });

  it("uses photographerAvailabilityMap for non-selected photographers", () => {
    const map = {
      "20": [
        makeSlot({
          id: 2,
          photographer_id: 20,
          date: null,
          day_of_week: "sunday",
          start_time: "10:00",
          end_time: "14:00",
          status: "available",
        }),
      ],
    };
    expect(
      buildPhotographerAvailabilityLabel("20", APR_19_2026_SUNDAY, {
        ...baseDeps,
        photographerAvailabilityMap: map,
      })
    ).toBe("Available (10:00 - 14:00)");
  });

  it("falls back to photographerWeeklySchedules when no slots on that date", () => {
    const schedules: Record<string, WeeklyScheduleItem[]> = {
      "10": [
        { day: "Sun", active: true, startTime: "9:00 AM", endTime: "5:00 PM" },
        { day: "Mon", active: false, startTime: "9:00 AM", endTime: "5:00 PM" },
      ],
    };
    expect(
      buildPhotographerAvailabilityLabel("10", APR_19_2026_SUNDAY, {
        ...baseDeps,
        photographerWeeklySchedules: schedules,
      })
    ).toBe("Available (9:00 AM - 5:00 PM)");
  });

  it("returns 'Not available' when no slots and no matching active weekly schedule", () => {
    const schedules: Record<string, WeeklyScheduleItem[]> = {
      "10": [
        { day: "Mon", active: true, startTime: "9:00 AM", endTime: "5:00 PM" },
      ],
    };
    expect(
      buildPhotographerAvailabilityLabel("10", APR_19_2026_SUNDAY, {
        ...baseDeps,
        photographerWeeklySchedules: schedules,
      })
    ).toBe("Not available");
  });

  it("returns 'Not available' when the only slot is unavailable and no weekly fallback exists", () => {
    const slots = [
      makeSlot({
        id: 1,
        photographer_id: 10,
        date: "2026-04-19",
        status: "unavailable",
      }),
    ];
    expect(
      buildPhotographerAvailabilityLabel("10", APR_19_2026_SUNDAY, {
        ...baseDeps,
        backendSlots: slots,
      })
    ).toBe("Not available");
  });
});
