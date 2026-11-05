import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms';

describe.each([
  ['dashboard detail', transformShootFromApi],
  ['shoot history', mapShootApiToShootData],
] as const)('%s saved media order', (_label, normalize) => {
  it.each([10, '10'])('retains the server arrangement version %s across normalization', version => {
    expect(normalize({ id: 5933, media_order_version: version }).mediaOrderVersion).toBe(10);
  });

  it('distinguishes an untouched upload from a saved manual arrangement', () => {
    expect(normalize({ id: 1, media_order_version: 0 }).mediaOrderVersion).toBe(0);
    expect(normalize({ id: 1 }).mediaOrderVersion).toBeUndefined();
  });

  it('retains normalized data when a shoot passes through another view', () => {
    expect(normalize({ id: 1, mediaOrderVersion: 4 }).mediaOrderVersion).toBe(4);
  });
});
