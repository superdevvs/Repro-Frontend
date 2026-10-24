import { describe, expect, it } from "vitest";
import {
  buildSelectedDateAvailabilities,
  buildMonthAvailabilities,
} from "@/lib/availability/selectors";
import type { BackendSlot } from "@/types/availability";
import {
  photographerDay,
  summarizeDays,
  subtractWindows,
} from "./calendarModel";

const monday = new Date(2026, 9, 19);
const weekly = (id: number, person: number): BackendSlot => ({
  id,
  photographer_id: person,
  day_of_week: "monday",
  date: null,
  start_time: "09:00",
  end_time: "17:00",
  status: "available",
});
const people = [
  { id: "1", name: "Jay" },
  { id: "2", name: "Mia" },
];
describe("production availability summaries", () => {
  it("keeps each photographer’s weekly hours when another has a date override, in Day and Month", () => {
    const deps = {
      selectedPhotographer: "all",
      backendSlots: [],
      allBackendSlots: [
        weekly(1, 1),
        weekly(2, 2),
        {
          ...weekly(3, 1),
          date: "2026-10-19",
          start_time: "10:00",
          end_time: "12:00",
        },
      ],
    };
    const rows = buildSelectedDateAvailabilities(deps, monday);
    expect(people.map((p) => photographerDay(p, rows).freeMinutes)).toEqual([
      120, 480,
    ]);
    const month = buildMonthAvailabilities(deps, monday).filter(
      (row) => row.date === "2026-10-19",
    );
    expect(people.map((p) => photographerDay(p, month).freeMinutes)).toEqual([
      120, 480,
    ]);
  });
  it("retains weekly hours under a dated booking and subtracts visits and blocks without double counting", () => {
    const deps = {
      selectedPhotographer: "all",
      backendSlots: [],
      allBackendSlots: [
        weekly(1, 1),
        weekly(2, 2),
        {
          ...weekly(3, 1),
          date: "2026-10-19",
          status: "booked",
          shoot_id: 22,
          start_time: "10:00",
          end_time: "12:00",
        },
        {
          ...weekly(4, 1),
          date: null,
          status: "unavailable",
          start_time: "11:00",
          end_time: "13:00",
        },
      ],
    };
    const rows = buildMonthAvailabilities(deps, monday).filter(
      (row) => row.date === "2026-10-19",
    );
    const days = people.map((p) => photographerDay(p, rows));
    expect(days[0].free).toEqual([
      { start: 540, end: 600 },
      { start: 780, end: 1020 },
    ]);
    expect(summarizeDays(days)).toMatchObject({
      freeMinutes: 780,
      peopleFree: 2,
      shoots: 1,
    });
  });
  it("keeps recurring blocks active under specific-date hours", () => {
    const deps = {
      selectedPhotographer: "all",
      backendSlots: [],
      allBackendSlots: [
        weekly(1, 1),
        {
          ...weekly(2, 1),
          status: "unavailable",
          start_time: "10:00",
          end_time: "11:00",
        },
        { ...weekly(3, 1), date: "2026-10-19" },
      ],
    };
    expect(
      photographerDay(people[0], buildSelectedDateAvailabilities(deps, monday))
        .freeMinutes,
    ).toBe(420);
  });
  it("does not treat an unconfigured date or a fully blocked date as available", () => {
    expect(summarizeDays([photographerDay(people[0], [])])).toMatchObject({
      configured: false,
      freeMinutes: 0,
      peopleFree: 0,
    });
    const rows = buildSelectedDateAvailabilities(
      {
        selectedPhotographer: "all",
        backendSlots: [],
        allBackendSlots: [
          { ...weekly(1, 1), date: "2026-10-19", status: "unavailable" },
          weekly(2, 1),
        ],
      },
      monday,
    );
    expect(photographerDay(people[0], rows).freeMinutes).toBe(0);
  });
  it("merges adjacent hours, clips overlaps and respects exact boundaries", () => {
    expect(
      subtractWindows(
        [
          { start: 540, end: 720 },
          { start: 700, end: 1020 },
        ],
        [
          { start: 480, end: 540 },
          { start: 600, end: 660 },
          { start: 630, end: 700 },
          { start: 1020, end: 1100 },
        ],
      ),
    ).toEqual([
      { start: 540, end: 600 },
      { start: 700, end: 1020 },
    ]);
  });
});
