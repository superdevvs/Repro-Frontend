import { describe, expect, it } from 'vitest';
import { approvalScheduleChanges } from './approvalScheduleChanges';
import type { ShootServiceObject } from '@/types/shoots';

describe('approval day adjustments', () => {
  const lines = [
    { shoot_service_id: '1', service_id: '2', shoot_unit_id: '7', photographer_id: '9', scheduled_at: '2026-10-13T17:30:00Z', duration_minutes: 75, price: 275 },
    { shoot_service_id: '2', service_id: '17', shoot_unit_id: '7', photographer_id: '9', scheduled_at: '2026-10-13T18:45:00Z', duration_minutes: 5, price: 175 },
    { shoot_service_id: '3', service_id: '2', shoot_unit_id: '8', photographer_id: '10', scheduled_at: '2026-10-13T17:30:00Z', duration_minutes: 45, price: 200 },
    { shoot_service_id: '4', service_id: '2', shoot_unit_id: '9', photographer_id: '9', scheduled_at: '2026-10-14T17:30:00Z', duration_minutes: 45, price: 200 },
  ] as ShootServiceObject[];
  it('moves the selected photographer and date while retaining service spacing and other visits', () => {
    expect(approvalScheduleChanges(lines, 'America/New_York', { scheduledAt: '2026-10-13T19:00:00Z', offsetMinutes: 90,
      timezone: 'America/New_York', visitScope: { photographerId: 9, date: '2026-10-13' } })).toEqual({
      '1': { scheduled_at: '2026-10-13T19:00:00.000Z' }, '2': { scheduled_at: '2026-10-13T20:15:00.000Z' },
    });
    expect(lines[0].duration_minutes).toBe(75);
    expect(lines[0].price).toBe(275);
  });
  it('retains floating legacy clocks when moving a day', () => {
    expect(approvalScheduleChanges([{ ...lines[0], scheduled_at: '2026-10-13T13:30:00' }], null,
      { scheduledAt: '2026-10-13T19:00:00Z', offsetMinutes: 90, timezone: 'America/New_York',
        visitScope: { photographerId: 9, date: '2026-10-13' } })).toEqual({ '1': { scheduled_at: '2026-10-13T15:00:00' } });
  });
  it('keeps the target unchanged when only a neighboring booking moves', () => {
    expect(approvalScheduleChanges(lines, 'America/New_York', { scheduledAt: lines[0].scheduled_at!, offsetMinutes: 0,
      timezone: 'America/New_York' })).toEqual({});
  });
});
