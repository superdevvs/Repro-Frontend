import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { determinePhotographerStatus } from './photographerUtils';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const shoot = (scheduledDate: string) => ({
  scheduledDate,
  photographer: { name: 'Photographer' },
} as ShootData);

describe('photographer scheduled-day activity', () => {
  it('keeps tomorrow upcoming after UTC midnight in a western viewer timezone', () => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 22));

    expect(determinePhotographerStatus('Photographer', [shoot('2026-09-08'), shoot('2026-09-10')]))
      .toBe('busy');
  });

  it('includes the whole thirtieth booked day in recent activity', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 22));

    expect(determinePhotographerStatus('Photographer', [shoot('2026-08-10')])).toBe('available');
    expect(determinePhotographerStatus('Photographer', [shoot('2026-08-09')])).toBe('offline');
  });
});
