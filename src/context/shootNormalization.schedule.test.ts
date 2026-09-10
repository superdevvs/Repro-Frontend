import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';

describe('shoot schedule normalization', () => {
  it('keeps the booked date and time from the production legacy payload', () => {
    const shoot = transformShootFromApi({
      id: 86, scheduled_date: '2026-09-09T00:00:00.000000Z',
      scheduled_at: '2026-09-09T10:00:00.000000Z', time: '10:00:00', timezone: null,
    });
    expect(shoot).toMatchObject({ scheduledDate: '2026-09-09', time: '10:00', timezone: null });
  });

  it('uses the booking timezone for absolute timestamp fallbacks and retains it for services', () => {
    const shoot = transformShootFromApi({
      id: 87, scheduled_at: '2026-09-10T02:30:00Z', timezone: 'America/Los_Angeles',
    });
    expect(shoot).toMatchObject({
      scheduledDate: '2026-09-09', time: '19:30', timezone: 'America/Los_Angeles',
    });
  });

  it('preserves legacy timestamp clock fields when explicit date and time are absent', () => {
    expect(transformShootFromApi({ id: 88, scheduled_at: '2026-09-09T10:00:00Z' }))
      .toMatchObject({ scheduledDate: '2026-09-09', time: '10:00' });
  });

  it('retains authoritative instant and fee-window fields separately from local labels', () => {
    expect(transformShootFromApi({
      id: 86, scheduled_date: '2026-09-09', time: '10:00',
      scheduled_instant: '2026-09-09T14:00:00+00:00', cancellation_fee_window: false,
    })).toMatchObject({
      scheduledDate: '2026-09-09', time: '10:00', cancellationFeeWindow: false,
      scheduledInstant: '2026-09-09T14:00:00+00:00',
    });
  });
});
