import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';

describe('offline payment review data', () => {
  it('preserves cash and cheque intents through reload without treating them as paid', () => {
    const pendingPayments = [
      { id: 51, amount: 100, currency: 'USD', paymentMethod: 'cash', status: 'pending', submittedByName: 'Test Client', notes: 'Partial cash payment' },
      { id: 52, amount: 191.5, currency: 'USD', paymentMethod: 'check', status: 'pending', checkNumber: 'QA-001', paymentDate: '2026-09-13' },
    ];
    const shoot = transformShootFromApi({
      id: 89,
      payment: { totalQuote: 291.5, totalPaid: 0, pendingPayments, pendingTotal: 291.5 },
    });
    expect(shoot.payment.pendingPayments).toEqual(pendingPayments);
    expect(shoot.payment.pendingTotal).toBe(291.5);
    expect(shoot.payment.totalQuote).toBe(291.5);
    expect(shoot.payment.totalPaid).toBe(0);
    expect(transformShootFromApi({ id: shoot.id, payment: shoot.payment }).payment.pendingPayments).toEqual(pendingPayments);
  });

  it('clears the pending list when the refreshed response contains no intents', () => {
    expect(transformShootFromApi({ id: 89, payment: { totalQuote: 291.5, totalPaid: 291.5 } }).payment.pendingPayments).toEqual([]);
  });
});
