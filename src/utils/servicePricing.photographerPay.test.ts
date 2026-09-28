import { describe, expect, it } from 'vitest';

import { calculatePhotographerPay, resolveBookedPhotographerUnitPay } from './servicePricing';

describe('calculatePhotographerPay', () => {
  it('returns a flat catalog amount unchanged', () => {
    expect(
      calculatePhotographerPay(
        { id: 1, name: 'HDR', price: 200, photographer_pay: 80, photographer_pay_type: 'fixed' },
        null,
      ),
    ).toBe(80);
  });

  it('resolves percent catalog pay against the service price', () => {
    expect(
      calculatePhotographerPay(
        {
          id: 1,
          name: 'HDR',
          price: 200,
          photographer_pay: null,
          photographer_pay_type: 'percent',
          photographer_pay_percent: 45,
        },
        null,
      ),
    ).toBe(90);
  });

  it('ignores a stale percent when the catalog is fixed', () => {
    expect(
      calculatePhotographerPay(
        {
          id: 1,
          name: 'HDR',
          price: 200,
          photographer_pay: 45,
          photographer_pay_type: 'fixed',
          photographer_pay_percent: 90,
        },
        null,
      ),
    ).toBe(45);
  });
});

describe('booked photographer pay', () => {
  it('keeps a saved zero instead of substituting the current catalog rate', () => {
    expect(resolveBookedPhotographerUnitPay({ photographer_pay: 0 }, 90)).toBe(0);
    expect(resolveBookedPhotographerUnitPay({ photographer_pay: '0.00' }, 90)).toBe(0);
  });

  it('retains the saved unit rate for multiplication by the booked quantity', () => {
    expect(resolveBookedPhotographerUnitPay({ photographer_pay: 40 }, 90) * 3).toBe(120);
  });

  it('uses catalog pay only when a booked rate is unavailable', () => {
    expect(resolveBookedPhotographerUnitPay({ photographer_pay: null }, 90)).toBe(90);
    expect(resolveBookedPhotographerUnitPay({}, null)).toBe(0);
  });
});
