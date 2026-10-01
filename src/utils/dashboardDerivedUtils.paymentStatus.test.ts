import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { getDashboardPaymentStatus, shootDataToSummary } from './dashboardDerivedUtils';

describe('getDashboardPaymentStatus', () => {
  it('reads paid from nested payment totals', () => {
    expect(
      getDashboardPaymentStatus({
        totalQuote: 200,
        totalPaid: 200,
        paymentStatus: 'paid',
      } as ShootData['payment']),
    ).toBe('paid');
  });

  it('reads unpaid from nested payment totals', () => {
    expect(
      getDashboardPaymentStatus({
        totalQuote: 200,
        totalPaid: 0,
        paymentStatus: 'unpaid',
      } as ShootData['payment']),
    ).toBe('unpaid');
  });

  it('reads top-level payment_status on shoot-shaped payloads', () => {
    expect(
      getDashboardPaymentStatus({
        id: '9',
        payment_status: 'paid',
        total_quote: 150,
        total_paid: 150,
      } as unknown as ShootData),
    ).toBe('paid');
  });
});

describe('shootDataToSummary paymentStatus', () => {
  it('surfaces paid for a transformed shoot with nested payment', () => {
    const summary = shootDataToSummary({
      id: '42',
      scheduledDate: '2026-10-01',
      time: '10:00 AM',
      location: { address: '1 Main', city: 'Austin', state: 'TX', zip: '78701' },
      payment: { baseQuote: 100, taxRate: 0, taxAmount: 0, totalQuote: 100, totalPaid: 100, paymentStatus: 'paid' },
      status: 'delivered',
      workflowStatus: 'delivered',
    } as ShootData);
    expect(summary.paymentStatus).toBe('paid');
  });
});
