import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';
import { resolveServiceShootDuration } from '@/utils/shootDuration';

describe('service duration metadata normalization', () => {
  it('keeps catalogue defaults distinct from a booked duration snapshot', () => {
    const shoot = transformShootFromApi({ id: 1, services: [
      { id: 10, name: 'Photos', shoot_duration_minutes: 120, pivot: { duration_minutes: 30 } },
      { id: 11, name: 'Video', shoot_duration_minutes: 150 },
    ] });
    const [photos, video] = shoot.serviceObjects!;
    expect(photos).toMatchObject({ shoot_duration_minutes: 120, duration_minutes: 30 });
    expect(resolveServiceShootDuration(photos)).toBe(30);
    expect(resolveServiceShootDuration(video)).toBe(150);
  });

  it('retains defaults on canonical booked lines and nested catalogue metadata', () => {
    const shoot = transformShootFromApi({ id: 1, service_items: [
      { service_id: 10, name: 'Photos', duration_minutes: 85, shoot_duration_minutes: 120 },
      { service_id: 11, name: 'Video', service: { id: 11, shoot_duration_minutes: 150 } },
    ] });
    expect(shoot.serviceItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: '10', duration_minutes: 85, shoot_duration_minutes: 120 }),
      expect.objectContaining({ service_id: '11', shoot_duration_minutes: 150 }),
    ]));
  });
});
