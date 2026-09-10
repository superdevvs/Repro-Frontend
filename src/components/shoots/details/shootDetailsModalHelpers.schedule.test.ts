import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { buildWeatherDateTime } from './shootDetailsModalHelpers';

describe('shoot forecast time', () => {
  it('uses the resolved appointment instant rather than recasting the booked day', () => {
    const shoot = {
      scheduledDate: '2026-09-09', time: '10:00',
      scheduledInstant: '2026-09-09T10:00:00-04:00',
    } as ShootData;
    expect(buildWeatherDateTime(shoot)).toBe('2026-09-09T14:00:00.000Z');
  });

  it('does not invent a timezone or forecast hour for a partial legacy response', () => {
    expect(buildWeatherDateTime({ scheduledDate: '2026-09-09', time: '10:00' } as ShootData))
      .toBeUndefined();
  });
});
