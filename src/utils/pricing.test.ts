import { describe, expect, it } from 'vitest';
import { calculatePricingBreakdown, calculateDiscountAmount, isDiscountEligibleService } from './pricing';

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

  it.each([
    ['percent', 10, 27, 353, 21.18, 374.18],
    ['fixed', 500, 270, 110, 6.6, 116.6],
  ] as const)('keeps cancellation and travel fees whole with a %s discount', (discountType, discountValue, discountAmount, discountedSubtotal, taxAmount, totalQuote) => {
    expect(calculatePricingBreakdown({ serviceSubtotal: 380, discountEligibleSubtotal: 270, discountType, discountValue, taxRate: 0.06 }))
      .toMatchObject({ discountAmount, discountedSubtotal, taxAmount, totalQuote });
  });

  it.each([
    { name: 'Onsite Cancellation/hold fee' }, { name: 'Travel fee - 90 Miles' },
    { name: 'Hold fee' }, { name: 'Mileage charge' }, { name: 'Renamed fee', financial_only: true },
    { service: { name: 'Travel fee' } },
  ])('excludes financial and legacy fee metadata: %j', (service) => {
    expect(isDiscountEligibleService(service)).toBe(false);
  });

  it('discounts ordinary media work and never reduces a fee-only booking', () => {
    expect(isDiscountEligibleService({ name: '30 HDR Photos + 2D Floor plans', financial_only: false })).toBe(true);
    expect(calculatePricingBreakdown({ serviceSubtotal: 60, discountEligibleSubtotal: 0, discountType: 'percent', discountValue: 100, taxRate: 0.06 }))
      .toMatchObject({ discountAmount: 0, totalQuote: 63.6 });
  });
});
