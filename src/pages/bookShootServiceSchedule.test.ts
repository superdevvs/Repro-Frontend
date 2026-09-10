import { describe, expect, it } from 'vitest';
import { buildBookShootServiceSchedule } from './bookShootServiceSchedule';

describe('booking service schedule submission', () => {
  it('uses the order clock for a legacy service without a custom schedule', () => {
    expect(buildBookShootServiceSchedule('56', {}, '2026-09-09', '10:00 AM', null))
      .toBe('2026-09-09T10:00:00');
  });
  it('uses a custom service clock in the explicit booking timezone', () => {
    expect(buildBookShootServiceSchedule('56', { '56': { date: '2026-01-09', time: '11:30' } },
      '2026-09-09', '10:00 AM', { timezone: 'America/New_York' }))
      .toBe('2026-01-09T16:30:00.000Z');
  });
  it('preserves the original service instant when an unchanged clock is ambiguous', () => {
    expect(buildBookShootServiceSchedule('56', {}, '2026-11-01', '01:30', {
      timezone: 'America/New_York', service_items: [{ service_id: 56, scheduled_at: '2026-11-01T06:30:00Z' }],
    })).toBe('2026-11-01T06:30:00.000Z');
  });
});
