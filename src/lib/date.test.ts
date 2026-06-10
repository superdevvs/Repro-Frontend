import { describe, expect, it } from 'vitest';

import { calendarDay, formatInZone } from '@/lib/date';

describe('calendarDay', () => {
  it('parses a YYYY-MM-DD string as local midnight, never shifting the day', () => {
    const day = calendarDay('2024-01-15');

    expect(day.getFullYear()).toBe(2024);
    expect(day.getMonth()).toBe(0);
    expect(day.getDate()).toBe(15);
    expect(day.getHours()).toBe(0);
    expect(day.getMinutes()).toBe(0);
  });

  it('reads the wall-clock day even from a Y-m-d-prefixed datetime string', () => {
    const day = calendarDay('2024-12-31T23:59:59Z');

    expect(day.getFullYear()).toBe(2024);
    expect(day.getMonth()).toBe(11);
    expect(day.getDate()).toBe(31);
  });

  it('does not interpret the date as UTC midnight (regression for the timezone shift bug)', () => {
    // `new Date('2024-01-15')` returns UTC midnight, which renders as 2024-01-14
    // for any viewer west of UTC. `calendarDay` must use the local constructor
    // and must therefore disagree with that unsafe parse for those viewers.
    const safeDay = calendarDay('2024-01-15');
    const unsafeDay = new Date('2024-01-15');

    // The two only diverge when the runtime is not UTC, but the safe day must
    // always be the requested wall-clock day.
    expect(safeDay.getFullYear()).toBe(2024);
    expect(safeDay.getMonth()).toBe(0);
    expect(safeDay.getDate()).toBe(15);

    // If the runtime is west of UTC, the unsafe parse drops to the previous
    // calendar day. The safe parse never does.
    if (unsafeDay.getDate() !== 15) {
      expect(safeDay.getDate()).not.toBe(unsafeDay.getDate());
    }
  });

  it('returns an invalid date for malformed input rather than throwing', () => {
    expect(Number.isNaN(calendarDay('').getTime())).toBe(true);
    expect(Number.isNaN(calendarDay('not-a-date').getTime())).toBe(true);
  });
});

describe('formatInZone', () => {
  it("formats an absolute instant in the supplied timezone, not the viewer's", () => {
    // 2024-01-15T05:00:00Z is midnight in America/New_York (UTC-5) on Jan 15
    // and 9:00 PM the previous day in America/Los_Angeles. Forcing the zone
    // pins the displayed day to Jan 15 regardless of where the viewer is.
    const iso = '2024-01-15T05:00:00Z';

    const ny = formatInZone(iso, 'America/New_York');
    const la = formatInZone(iso, 'America/Los_Angeles');

    expect(ny).toContain('Jan 15');
    expect(la).toContain('Jan 14');
  });

  it('honors caller-supplied DateTimeFormat options', () => {
    const iso = '2024-06-01T15:30:00Z';

    const result = formatInZone(iso, 'UTC', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    expect(result).toContain('3:30');
    expect(result.toUpperCase()).toContain('UTC');
  });

  it('returns an empty string for invalid ISO input', () => {
    expect(formatInZone('not-an-iso', 'America/New_York')).toBe('');
  });
});
