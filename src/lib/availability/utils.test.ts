import { describe, it, expect } from "vitest";
import {
  getInitials,
  mapBackendSlots,
  normalizePhotographerNumericId,
  toHhMm,
  uiTimeToHhmm,
} from "./utils";

describe("uiTimeToHhmm", () => {
  it("returns empty string for empty input", () => {
    expect(uiTimeToHhmm("")).toBe("");
    expect(uiTimeToHhmm(undefined)).toBe("");
  });

  it("pads single-digit 24h hours", () => {
    expect(uiTimeToHhmm("9:00")).toBe("09:00");
  });

  it("keeps already-padded 24h input intact", () => {
    expect(uiTimeToHhmm("14:30")).toBe("14:30");
  });

  it("converts AM times to 24h", () => {
    expect(uiTimeToHhmm("9:00 AM")).toBe("09:00");
    expect(uiTimeToHhmm("11:45 AM")).toBe("11:45");
  });

  it("maps 12:00 AM to midnight", () => {
    expect(uiTimeToHhmm("12:00 AM")).toBe("00:00");
  });

  it("keeps 12:00 PM as noon", () => {
    expect(uiTimeToHhmm("12:00 PM")).toBe("12:00");
  });

  it("converts PM times to 24h", () => {
    expect(uiTimeToHhmm("3:30 PM")).toBe("15:30");
    expect(uiTimeToHhmm("11:15 PM")).toBe("23:15");
  });

  it("is case-insensitive for meridiem", () => {
    expect(uiTimeToHhmm("3:30 pm")).toBe("15:30");
    expect(uiTimeToHhmm("3:30 Pm")).toBe("15:30");
  });

  it("passes through malformed input unchanged", () => {
    expect(uiTimeToHhmm("not-a-time")).toBe("not-a-time");
  });
});

describe("toHhMm", () => {
  it("returns empty string for empty input", () => {
    expect(toHhMm("")).toBe("");
    expect(toHhMm(undefined)).toBe("");
  });

  it("truncates 24h HH:MM:SS to HH:MM", () => {
    expect(toHhMm("14:30:00")).toBe("14:30");
  });

  it("leaves HH:MM 24h input intact", () => {
    expect(toHhMm("14:30")).toBe("14:30");
  });

  it("converts PM to 24h", () => {
    expect(toHhMm("2:00 PM")).toBe("14:00");
    expect(toHhMm("11:45 PM")).toBe("23:45");
  });

  it("converts AM to 24h with zero-padding", () => {
    expect(toHhMm("2:00 AM")).toBe("02:00");
  });

  it("maps 12:00 AM to midnight", () => {
    expect(toHhMm("12:00 AM")).toBe("00:00");
  });

  it("keeps 12:00 PM as noon", () => {
    expect(toHhMm("12:00 PM")).toBe("12:00");
  });
});

describe("normalizePhotographerNumericId", () => {
  it("parses numeric string as number", () => {
    expect(normalizePhotographerNumericId("42")).toBe(42);
    expect(normalizePhotographerNumericId("0")).toBe(0);
  });

  it("produces a deterministic positive integer for non-numeric input", () => {
    const a = normalizePhotographerNumericId("abc");
    const b = normalizePhotographerNumericId("abc");
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThan(0);
  });

  it("produces different values for different non-numeric inputs", () => {
    expect(normalizePhotographerNumericId("alice")).not.toBe(
      normalizePhotographerNumericId("bob")
    );
  });
});

describe("mapBackendSlots", () => {
  it("returns empty array for empty/nullish input", () => {
    expect(mapBackendSlots([], "1")).toEqual([]);
    expect(mapBackendSlots(null, "1")).toEqual([]);
    expect(mapBackendSlots(undefined, "1")).toEqual([]);
  });

  it("preserves a well-formed row", () => {
    const result = mapBackendSlots(
      [
        {
          id: 5,
          photographer_id: 10,
          date: "2026-04-19",
          day_of_week: null,
          start_time: "09:00",
          end_time: "17:00",
          status: "available",
        },
      ],
      "10"
    );
    expect(result).toEqual([
      {
        id: 5,
        photographer_id: 10,
        date: "2026-04-19",
        day_of_week: null,
        start_time: "09:00",
        end_time: "17:00",
        status: "available",
      },
    ]);
  });

  it("generates a numeric id when absent", () => {
    const result = mapBackendSlots(
      [{ start_time: "09:00", end_time: "17:00", status: "available" }],
      "7"
    );
    expect(typeof result[0].id).toBe("number");
    expect(Number.isFinite(result[0].id as number)).toBe(true);
  });

  it("falls back to the passed photographerId when photographer_id is missing", () => {
    const result = mapBackendSlots(
      [{ id: 1, start_time: "09:00", end_time: "17:00" }],
      "42"
    );
    expect(result[0].photographer_id).toBe(42);
  });

  it("normalizes missing date and day_of_week to null", () => {
    const result = mapBackendSlots(
      [{ id: 1, photographer_id: 1, start_time: "09:00", end_time: "17:00" }],
      "1"
    );
    expect(result[0].date).toBeNull();
    expect(result[0].day_of_week).toBeNull();
  });

  it("coerces start_time and end_time to strings", () => {
    const result = mapBackendSlots(
      [{ id: 1, photographer_id: 1, start_time: "09:00", end_time: "17:00" }],
      "1"
    );
    expect(typeof result[0].start_time).toBe("string");
    expect(typeof result[0].end_time).toBe("string");
  });
});

describe("getInitials", () => {
  it("returns empty string for empty name", () => {
    expect(getInitials("")).toBe("");
  });

  it("returns single initial for single-word name", () => {
    expect(getInitials("John")).toBe("J");
  });

  it("returns two-letter initials for a two-word name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("truncates to the first two initials for longer names", () => {
    expect(getInitials("Mary Jane Watson")).toBe("MJ");
  });

  it("uppercases lowercase input", () => {
    expect(getInitials("ada lovelace")).toBe("AL");
  });
});
