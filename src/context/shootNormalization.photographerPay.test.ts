import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';
import { getPhotographerPayoutDate, getPhotographerPayoutStatus } from '@/components/accounting/photographerEarningsUtils';

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

  it.each(['photographerPaidAt', 'photographer_paid_at', 'paid_at_photographer'])(
    'preserves the photographer payment date from %s through normalization', (key) => {
      const paidAt = '2026-09-18T12:30:00Z';
      const shoot = transformShootFromApi({ id: 89, status: 'completed', [key]: paidAt });
      expect(shoot.photographerPaidAt).toBe(paidAt);
      expect(getPhotographerPayoutDate(shoot)).toBe(paidAt);
      expect(getPhotographerPayoutStatus(shoot)).toBe('paid');
      expect(transformShootFromApi({ id: 89, photographerPaidAt: shoot.photographerPaidAt }).photographerPaidAt).toBe(paidAt);
    },
  );

  it('does not turn a completed client payment into a photographer payout', () => {
    const shoot = transformShootFromApi({ id: 89, status: 'completed', payment_status: 'paid', total_paid: 200 });
    expect(shoot.photographerPaidAt).toBeUndefined();
    expect(getPhotographerPayoutStatus(shoot)).toBe('pending');
    expect(getPhotographerPayoutStatus(transformShootFromApi({ id: 90, status: 'scheduled' }))).toBe('upcoming');
  });
});
