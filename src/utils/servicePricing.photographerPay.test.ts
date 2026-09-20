import { describe, expect, it } from 'vitest';

import { calculatePhotographerPay } from './servicePricing';

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
