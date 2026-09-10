import { describe, expect, it } from 'vitest';
import { buildShootScheduleTimestamp } from './shootScheduleSubmission';

describe('shoot schedule submission storage contract', () => {
  it('preserves legacy wall-clock timestamps without a shoot timezone', () => {
    expect(buildShootScheduleTimestamp('2026-09-09', '10:00', null)).toBe('2026-09-09T10:00:00');
  });
  it.each([
    ['2026-09-09', '2026-09-09T14:00:00.000Z'],
    ['2026-01-09', '2026-01-09T15:00:00.000Z'],
  ])('converts 10 AM New York to its actual instant on %s', (date, expected) => {
    expect(buildShootScheduleTimestamp(date, '10:00', 'America/New_York')).toBe(expected);
  });
  it.each(['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'])('preserves unchanged ambiguous instant %s', (original) => {
    expect(buildShootScheduleTimestamp('2026-11-01', '01:30', 'America/New_York', original)).toBe(new Date(original).toISOString());
  });
  it('rejects nonexistent spring-forward times', () => {
    expect(() => buildShootScheduleTimestamp('2026-03-08', '02:30', 'America/New_York')).toThrow('does not exist');
  });
  it('rejects newly selected ambiguous fall-back times instead of guessing', () => {
    expect(() => buildShootScheduleTimestamp('2026-11-01', '01:30', 'America/New_York')).toThrow('occurs twice');
  });
  it('preserves a naive UTC storage value including seconds independent of viewer timezone', () => {
    expect(buildShootScheduleTimestamp('2026-09-09', '10:00', 'America/New_York', '2026-09-09 14:00:12'))
      .toBe('2026-09-09T14:00:12.000Z');
  });
  it('reports an invalid saved timezone before submitting', () => {
    expect(() => buildShootScheduleTimestamp('2026-09-09', '10:00', 'Invalid/Zone')).toThrow('shoot timezone is invalid');
  });
  it('converts a local date crossing the UTC date boundary', () => {
    expect(buildShootScheduleTimestamp('2026-09-09', '01:00', 'Asia/Kolkata')).toBe('2026-09-08T19:30:00.000Z');
  });
});
