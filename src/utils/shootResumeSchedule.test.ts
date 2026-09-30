import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import {
  buildResumeSchedulePayload,
  buildResumeScheduleTimestamp,
  shootNeedsResumeSchedule,
} from './shootResumeSchedule';

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

describe('undated on-hold resume gate', () => {
  it('requires a schedule when shoot-level date is missing', () => {
    expect(shootNeedsResumeSchedule(shoot({ timezone: 'America/New_York' }))).toBe(true);
    expect(shootNeedsResumeSchedule(shoot({ scheduledDate: '2026-09-30', time: '10:00' }))).toBe(false);
  });

  it('returns needs_schedule for undated holds (never invent / empty POST)', () => {
    expect(buildResumeSchedulePayload(shoot({
      timezone: 'America/New_York', photographer: { id: '1104', name: 'Jaz' },
    }))).toBe('needs_schedule');
  });

  it('uses BE shape 3 when a future appointment is already saved', () => {
    expect(buildResumeSchedulePayload(shoot({
      scheduledDate: '2026-10-05', time: '14:00', timezone: 'America/New_York',
      scheduledInstant: '2026-10-05T18:00:00Z',
      photographer: { id: 1104, name: 'Jaz' },
    }), new Date('2026-09-29T12:00:00Z'))).toEqual({ photographer_id: 1104 });
  });

  it('requires dialog confirmation when a past appointment must move forward', () => {
    expect(buildResumeSchedulePayload(shoot({
      scheduledDate: '2026-09-09', time: '09:00', timezone: 'America/New_York',
      scheduledInstant: '2026-09-09T13:00:00Z',
      photographer: { id: '1104', name: 'Jaz' },
    }), new Date('2026-09-09T14:00:00Z'))).toBe('needs_schedule');
  });

  it('requires dialog when shoot header date mismatches service schedules', () => {
    expect(buildResumeSchedulePayload(shoot({
      scheduledDate: '2026-08-12', time: '11:10', timezone: 'America/New_York',
      scheduledInstant: '2026-08-12T15:10:00Z',
      photographer: { id: 989, name: 'Jay Snap' },
      serviceObjects: [
        { id: '7', name: '45 HDR Photos', price: 199, quantity: 1, photographer_id: '1106', scheduled_at: '2026-09-30 15:10:00' },
      ],
    }), new Date('2026-09-29T12:00:00Z'))).toBe('needs_schedule');
  });
});
