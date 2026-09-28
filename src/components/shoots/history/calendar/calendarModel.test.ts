import { describe, expect, it } from 'vitest';
import { addCalendarDays, buildCalendarEntries, getCalendarDateRange, getCalendarDates, getCalendarToday, getShootCalendarDate, layoutCalendarSlots, moveCalendarDate } from './calendarModel';
import { calendarShoot } from './calendarFixtures.test-helper';

describe('calendar dates and ranges', () => {
  it('loads the complete Monday–Sunday month grid including spillover days', () => {
    const range = getCalendarDateRange('2026-09-28', 'month');
    expect(range).toEqual({ start: '2026-08-31', end: '2026-10-04' });
    expect(getCalendarDates(range)).toHaveLength(35);
  });
  it('returns a full week and an exact day even across year boundaries', () => {
    expect(getCalendarDateRange('2027-01-01', 'week')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
    expect(getCalendarDateRange('2027-01-01', 'day')).toEqual({ start: '2027-01-01', end: '2027-01-01' });
  });
  it('moves the active unit and clamps a month without rolling into the next month', () => {
    expect(moveCalendarDate('2026-09-28', 'day', 1)).toBe('2026-09-29');
    expect(moveCalendarDate('2026-09-28', 'week', 1)).toBe('2026-10-05');
    expect(moveCalendarDate('2026-12-31', 'month', 1)).toBe('2027-01-31');
    expect(moveCalendarDate('2027-01-31', 'month', 1)).toBe('2027-02-28');
    expect(moveCalendarDate('2028-01-31', 'month', 1)).toBe('2028-02-29');
  });
  it('performs calendar arithmetic without DST jumps and sources today from the viewer day', () => {
    expect(addCalendarDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addCalendarDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(getCalendarToday(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28');
  });
});

describe('calendar shoot projection', () => {
  it('keeps saved booking fields authoritative over an absolute instant', () => {
    const shoot = calendarShoot({ scheduledDate: '2026-09-28', time: '23:30', timezone: 'America/Los_Angeles' });
    Object.assign(shoot, { scheduled_at: '2026-09-29T06:30:00Z' });
    expect(buildCalendarEntries([shoot])[0]).toMatchObject({ date: '2026-09-28', time: '23:30', minutes: 1410 });
  });
  it('uses the existing zoned timestamp fallback when local fields are missing', () => {
    const shoot = calendarShoot({ scheduledDate: '', time: '', timezone: 'America/Los_Angeles' });
    Object.assign(shoot, { scheduled_at: '2026-09-29T06:30:00Z' });
    expect(getShootCalendarDate(shoot)).toBe('2026-09-28');
    expect(buildCalendarEntries([shoot])[0].time).toBe('23:30');
  });
  it('does not invent a date/time from creation or shift a legacy booking clock', () => {
    expect(buildCalendarEntries([calendarShoot({ scheduledDate: '', time: '', createdAt: '2026-09-28T08:00:00Z' })])[0]).toMatchObject({ date: null, time: null, minutes: null });
    const legacy = calendarShoot({ scheduledDate: '', time: '', timezone: null });
    Object.assign(legacy, { scheduled_at: '2026-09-28T09:30:00Z' });
    expect(buildCalendarEntries([legacy])[0]).toMatchObject({ date: '2026-09-28', time: '09:30' });
  });
  it('rejects impossible dates and places untimed appointments last with deterministic ties', () => {
    expect(getShootCalendarDate(calendarShoot({ scheduledDate: '2026-02-30' }))).toBeNull();
    const entries = buildCalendarEntries([
      calendarShoot({ id: '10' }), calendarShoot({ id: '4', time: '' }), calendarShoot({ id: '2' }), calendarShoot({ id: '2' }),
    ]);
    expect(entries.map(entry => entry.shoot.id)).toEqual(['2', '10', '4']);
    expect(entries.at(-1).minutes).toBeNull();
  });
  it('assigns stable nonoverlapping lanes across a chained overlap group', () => {
    const entries = buildCalendarEntries([
      calendarShoot({ id: '1', time: '09:00' }), calendarShoot({ id: '2', time: '09:30' }),
      calendarShoot({ id: '3', time: '10:00' }), calendarShoot({ id: '4', time: '12:00' }),
    ]);
    const slots = layoutCalendarSlots(entries);
    expect(slots.map(({ lane, lanes, group }) => ({ lane, lanes, group }))).toEqual([
      { lane: 0, lanes: 2, group: 0 }, { lane: 1, lanes: 2, group: 0 },
      { lane: 0, lanes: 2, group: 0 }, { lane: 0, lanes: 1, group: 1 },
    ]);
    expect(entries[0].shoot).not.toHaveProperty('duration');
  });
  it('supports dense starts and late-night starts without assigning untimed records a slot', () => {
    const entries = buildCalendarEntries([
      ...Array.from({ length: 15 }, (_, index) => calendarShoot({ id: String(index + 1), time: '09:00' })),
      calendarShoot({ id: '16', time: '23:55' }), calendarShoot({ id: '17', time: '' }),
    ]);
    const slots = layoutCalendarSlots(entries);
    expect(slots).toHaveLength(16);
    expect(slots.slice(0, 15).every(slot => slot.lanes === 15)).toBe(true);
    expect(slots.at(-1)).toMatchObject({ start: 1435, end: 1440, lanes: 1 });
  });
});
