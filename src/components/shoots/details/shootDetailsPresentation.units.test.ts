import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { getShootDetailsServiceNames } from './shootDetailsPresentation';

describe('unit service chip summary', () => {
  it('bounds repeated unit services while preserving legacy service display', () => {
    const shoot = { services: Array.from({ length: 100 }, () => 'Photography'), units: [{ id: 1, label: '101', kind: 'unit' }] } as ShootData;
    expect(getShootDetailsServiceNames(shoot)).toEqual(['Photography × 100']);
    expect(getShootDetailsServiceNames({ ...shoot, units: [], services: ['Photography', 'Photography'] })).toEqual(['Photography', 'Photography']);
  });
});
