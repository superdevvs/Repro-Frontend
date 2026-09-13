import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';

describe('photographer compensation from the shoot API', () => {
  it.each([
    { totalPhotographerPay: '125.50', photographerPay: 125.5 },
    { total_photographer_pay: 125.5 },
    { photographerPay: 125.5 },
    { photographer_pay: '125.50' },
  ])('retains the supplied compensation and survives normalization again: %j', (fields) => {
    const shoot = transformShootFromApi({ id: 89, ...fields });
    expect(shoot.photographerPay).toBe(125.5);
    expect(shoot.totalPhotographerPay).toBe(125.5);
    expect(transformShootFromApi({ id: 89, totalPhotographerPay: shoot.totalPhotographerPay }).photographerPay).toBe(125.5);
  });

  it('preserves an explicit zero over a legacy fallback', () => {
    expect(transformShootFromApi({ id: 89, totalPhotographerPay: 0, photographer_pay: 125.5 }).photographerPay).toBe(0);
  });
});
