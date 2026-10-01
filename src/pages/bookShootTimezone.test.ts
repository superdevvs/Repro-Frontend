import { describe, expect, it } from 'vitest';
import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import { buildBookShootServiceSchedule } from './bookShootServiceSchedule';
import { resolveBookingTimezone } from './bookShootTimezone';

describe('booking timezone at submission', () => {
  it.each(['Asia/Kolkata', 'America/Los_Angeles'])('keeps legacy order and service clocks floating when editing from %s', (browserTimezone) => {
    const timezone = resolveBookingTimezone({ isEditMode: true, storedTimezone: null, browserTimezone });
    expect(timezone).toBeNull();
    expect(buildShootScheduleTimestamp('2026-09-09', '10:00', timezone, '2026-09-09T10:00:00Z'))
      .toBe('2026-09-09T10:00:00');
    expect(buildBookShootServiceSchedule('1', {}, '2026-09-09', '10:00', {
      timezone, service_items: [{ service_id: 1, scheduled_at: '2026-09-09T10:00:00Z' }],
    })).toBe('2026-09-09T10:00:00');
  });

  it('keeps an explicitly zoned edit in its stored timezone and preserves the DST-fold instant', () => {
    const timezone = resolveBookingTimezone({ isEditMode: true, storedTimezone: 'America/New_York', browserTimezone: 'Asia/Kolkata' });
    expect(timezone).toBe('America/New_York');
    expect(buildShootScheduleTimestamp('2026-11-01', '01:30', timezone, '2026-11-01T06:30:00Z'))
      .toBe('2026-11-01T06:30:00.000Z');
  });

  it('declares the browser timezone consistently for a new order and its services', () => {
    const timezone = resolveBookingTimezone({ isEditMode: false, storedTimezone: null, browserTimezone: 'Asia/Kolkata' });
    expect(timezone).toBe('Asia/Kolkata');
    expect(buildShootScheduleTimestamp('2026-09-09', '10:00', timezone)).toBe('2026-09-09T04:30:00.000Z');
    expect(buildBookShootServiceSchedule('1', {}, '2026-09-09', '10:00', { timezone }))
      .toBe('2026-09-09T04:30:00.000Z');
  });

  it('uses the existing business fallback when a new booking has no browser timezone', () => {
    const timezone = resolveBookingTimezone({ isEditMode: false, browserTimezone: null });
    expect(timezone).toBe('America/New_York');
    expect(buildShootScheduleTimestamp('2026-09-09', '10:00', timezone)).toBe('2026-09-09T14:00:00.000Z');
  });
});
