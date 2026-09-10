import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { buildResumeScheduleTimestamp } from './shootResumeSchedule';

const shoot = (fields: Partial<ShootData>) => ({ id: '86', ...fields }) as ShootData;

describe('resuming a held shoot', () => {
  it('preserves a same-day 5 PM appointment at 1 PM', () => {
    expect(buildResumeScheduleTimestamp(shoot({
      scheduledDate: '2026-09-09', time: '17:00', timezone: null,
      scheduledInstant: '2026-09-09T21:00:00Z', scheduleTimezone: 'America/New_York',
    }), new Date('2026-09-09T17:00:00Z'))).toBe('2026-09-09T17:00:00');
  });
  it('moves a same-day 9 AM appointment at 10 AM to tomorrow in the booking zone', () => {
    expect(buildResumeScheduleTimestamp(shoot({
      scheduledDate: '2026-09-09', time: '09:00', timezone: null,
      scheduledInstant: '2026-09-09T13:00:00Z', scheduleTimezone: 'America/New_York',
    }), new Date('2026-09-09T14:00:00Z'))).toBe('2026-09-10T09:00:00');
  });
  it('uses the booking calendar day near UTC midnight', () => {
    expect(buildResumeScheduleTimestamp(shoot({
      scheduledDate: '2026-09-09', time: '09:00', timezone: 'America/New_York',
      scheduledInstant: '2026-09-09T13:00:00Z',
    }), new Date('2026-09-10T02:00:00Z'))).toBe('2026-09-10T13:00:00.000Z');
  });
  it('preserves an existing clock when no authoritative instant is available', () => {
    expect(buildResumeScheduleTimestamp(shoot({ scheduledDate: '2026-09-09', time: '09:00' }),
      new Date('2026-09-09T14:00:00Z'))).toBe('2026-09-09T09:00:00');
  });
  it('preserves an unchanged explicit-zone instant', () => {
    expect(buildResumeScheduleTimestamp(shoot({
      scheduledDate: '2026-09-09', time: '17:00', timezone: 'America/New_York',
      scheduledInstant: '2026-09-09T21:00:00Z',
    }), new Date('2026-09-09T17:00:00Z'))).toBe('2026-09-09T21:00:00.000Z');
  });
  it('requires an authoritative timezone before inventing a missing schedule', () => {
    expect(() => buildResumeScheduleTimestamp(shoot({}))).toThrow('Refresh this shoot');
  });
});
