import { describe, expect, it } from 'vitest';
import { resolveServiceShootDuration, resolveShootDuration } from './shootDuration';
import { applyServiceScheduleToAllIds } from './applyServiceScheduleToAll';

describe('duration defaults and preservation', () => {
  it('defaults to60, preserves30 and85, and limits new values to30–240', () => {
    expect(resolveShootDuration()).toBe(60);
    expect(resolveShootDuration(null, 0, 30, 60)).toBe(30);
    expect(resolveShootDuration(85)).toBe(85);
    expect(resolveShootDuration(10)).toBe(30);
    expect(resolveShootDuration(300)).toBe(240);
  });
  it('uses a booked override before catalogue and tier durations', () => {
    const service = { pricing_type: 'variable', shoot_duration_minutes: 120, sqft_ranges: [{ sqft_from: 1, sqft_to: 2000, duration: 90 }] };
    expect(resolveServiceShootDuration(service, 1000)).toBe(90);
    expect(resolveServiceShootDuration(service, 1000, 30)).toBe(30);
    expect(resolveServiceShootDuration({ ...service, duration_minutes: 85 }, 1000)).toBe(85);
    expect(resolveServiceShootDuration(service, 3000)).toBe(120);
    expect(resolveServiceShootDuration(service, null)).toBe(120);
    expect(resolveServiceShootDuration({ ...service, pricing_type: 'fixed' }, 1000)).toBe(120);
    expect(resolveServiceShootDuration({ ...service, sqft_ranges: [{ sqft_from: 1, sqft_to: 2000, duration: null }] }, 1000)).toBe(120);
    expect(resolveServiceShootDuration({}, 1000)).toBe(60);
  });
  it('copies date and time while retaining different per-service duration snapshots', () => {
    expect(applyServiceScheduleToAllIds({ '1': { duration_minutes: 30 }, '2': { duration_minutes: 85 } }, ['1', '2'], { date: '2026-10-06', time: '11:00' }))
      .toEqual({ '1': { date: '2026-10-06', time: '11:00', duration_minutes: 30 }, '2': { date: '2026-10-06', time: '11:00', duration_minutes: 85 } });
  });
});
