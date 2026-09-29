import { describe, expect, it } from 'vitest';

import { resolveAdaptiveDeliveredVisibleCount } from './resolveAdaptiveDeliveredVisibleCount';

describe('resolveAdaptiveDeliveredVisibleCount', () => {
  it('returns preferred count before measurements are available', () => {
    expect(
      resolveAdaptiveDeliveredVisibleCount({
        availableHeight: 0,
        itemHeight: 0,
        totalItems: 10,
      }),
    ).toBe(3);
  });

  it('caps preferred count at total items', () => {
    expect(
      resolveAdaptiveDeliveredVisibleCount({
        availableHeight: 0,
        itemHeight: 0,
        totalItems: 1,
      }),
    ).toBe(1);
  });

  it('shows minimum 2 when the column is short', () => {
    // One 224px card barely fits; still keep the minimum of 2.
    expect(
      resolveAdaptiveDeliveredVisibleCount({
        availableHeight: 230,
        itemHeight: 224,
        totalItems: 8,
      }),
    ).toBe(2);
  });

  it('prefers 3 when three cards fit', () => {
    // 3 * 224 + 2 * 12 = 696
    expect(
      resolveAdaptiveDeliveredVisibleCount({
        availableHeight: 700,
        itemHeight: 224,
        totalItems: 8,
      }),
    ).toBe(3);
  });

  it('fills taller columns with more than 3 cards', () => {
    // 5 * 224 + 4 * 12 = 1168
    expect(
      resolveAdaptiveDeliveredVisibleCount({
        availableHeight: 1200,
        itemHeight: 224,
        totalItems: 8,
      }),
    ).toBe(5);
  });

  it('never exceeds available shoots', () => {
    expect(
      resolveAdaptiveDeliveredVisibleCount({
        availableHeight: 2000,
        itemHeight: 224,
        totalItems: 4,
      }),
    ).toBe(4);
  });

  it('returns 0 when there are no shoots', () => {
    expect(
      resolveAdaptiveDeliveredVisibleCount({
        availableHeight: 1200,
        itemHeight: 224,
        totalItems: 0,
      }),
    ).toBe(0);
  });
});
