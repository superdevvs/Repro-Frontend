import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import type { ShootData } from '@/types/shoots';
import { parseShootDateTime, shootDataToSummary } from './dashboardDerivedUtils';
import { getShootSchedule } from './shootSchedule';

describe('dashboard schedule agrees with shoot details', () => {
  it.each(['2026-10-05T16:30:00Z', '2026-10-05T12:30:00-04:00'])(
    'shows 12:30 Eastern for service timestamp %s', (scheduledAt) => {
      const shoot = {
        id: '685', scheduledDate: '2026-10-05', time: '', timezone: 'America/New_York',
        scheduledAt, serviceItems: [{ scheduledAt }], services: [],
        location: { address: '11815 Breton Court' },
      } as unknown as ShootData;
      expect(format(parseShootDateTime(shoot)!, 'HH:mm')).toBe('12:30');
      expect(shootDataToSummary(shoot).timeLabel).toBe('12:30 PM');
      expect(getShootSchedule(shoot).time).toBe('12:30');
    },
  );

  it('preserves legacy civil times when no booking timezone exists', () => {
    const shoot = { serviceItems: [{ scheduledAt: '2026-10-05T12:30:00Z' }] } as unknown as ShootData;
    expect(format(parseShootDateTime(shoot)!, 'HH:mm')).toBe('12:30');
  });
});
