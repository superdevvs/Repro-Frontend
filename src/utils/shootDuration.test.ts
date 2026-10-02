import { describe, expect, it } from 'vitest';
import { resolveServiceShootDuration, resolveShootDuration, sumServiceShootDurations } from './shootDuration';
import { applyServiceScheduleToAllIds } from './applyServiceScheduleToAll';

describe('duration defaults and preservation', () => {
  it('defaults to60 and preserves positive booked snapshots without clamping', () => {
    expect(resolveShootDuration()).toBe(60);
    expect(resolveShootDuration(null, 0, 30, 60)).toBe(30);
    expect(resolveShootDuration(85)).toBe(85);
    expect(resolveShootDuration(15)).toBe(15);
    expect(resolveShootDuration(10)).toBe(10);
    expect(resolveShootDuration(300)).toBe(300);
    expect(resolveShootDuration(360)).toBe(360);
  });
  it('uses catalog defaults, short tiers and zero non-onsite work', () => {
    expect(resolveServiceShootDuration({ booking_duration_defaults: { default_minutes: 15, min_minutes: 5, max_minutes: 300 } })).toBe(15);
    expect(resolveServiceShootDuration({ pricing_type: 'variable', shoot_duration_minutes: 60, sqft_ranges: [{ sqft_from: 0, sqft_to: 2000, duration: 15 }] }, 1000)).toBe(15);
    expect(resolveServiceShootDuration({ photographer_required: false, shoot_duration_minutes: 0 })).toBe(0);
  });
  it('sums distinct capture services once, treats packages as one SKU and never caps visit totals', () => {
    const exterior = { id: '6', shoot_duration_minutes: 15 };
    expect(sumServiceShootDurations([exterior, exterior, { id: '7', shoot_duration_minutes: 30 }])).toBe(45);
    expect(sumServiceShootDurations([{ id: 'package', shoot_duration_minutes: 90 }, { id: 'editing', photographer_required: false }])).toBe(90);
    expect(sumServiceShootDurations([{ id: 'a', shoot_duration_minutes: 270 }, { id: 'b', shoot_duration_minutes: 90 }])).toBe(360);
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
