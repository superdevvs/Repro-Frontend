import { describe, expect, it } from 'vitest';
import { calculatePricingBreakdown, calculateDiscountAmount } from './pricing';

describe('currency preview rounding', () => {
  it('matches the saved invoice for shoot 1989 with its five-percent discount', () => {
    expect(calculatePricingBreakdown({
      serviceSubtotal: 295, discountType: 'percent', discountValue: 5, taxRate: 0.06,
    })).toMatchObject({
      discountAmount: 14.75, discountedSubtotal: 280.25, taxAmount: 16.82, totalQuote: 297.07,
    });
  });

  it.each([
    [16.75, 1.01, 17.76],
    [167.75, 10.07, 177.82],
    [280.24, 16.81, 297.05],
    [280.26, 16.82, 297.08],
    [0, 0, 0],
  ])('rounds tax on %s using decimal half-up cents', (serviceSubtotal, taxAmount, totalQuote) => {
    expect(calculatePricingBreakdown({ serviceSubtotal, taxRate: 0.06 }))
      .toMatchObject({ taxAmount, totalQuote });
  });

  it('rounds half-cent discounts consistently and caps them at the subtotal', () => {
    expect(calculateDiscountAmount(201.5, 'percent', 5)).toBe(10.08);
    expect(calculateDiscountAmount(100, 'fixed', 120)).toBe(100);
  });
});
