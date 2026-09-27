import { describe, expect, it } from 'vitest';
import type { ClientBillingItem } from '@/types/clientBilling';
import { getClientBillingChartData, getClientBillingPaidMetrics } from './clientBillingPresentation';

const item = (date: string, amount: number, extra: Partial<ClientBillingItem> = {}): ClientBillingItem => ({
  id: date, source: 'invoice', sourceLabel: 'Invoice', property: 'Test property', issueDate: date, paidAt: date,
  amount, amountPaid: amount, balance: 0, status: 'paid', bucket: 'paid', paymentRequiredToRelease: false, ...extra,
});

describe('client billing period semantics', () => {
  it('includes both custom endpoints and only completed payments, with correct counts', () => {
    const result = getClientBillingPaidMetrics([
      item('2026-09-01T00:00:00', 100), item('2026-09-30T23:59:59', 200), item('2026-08-31', 50), item('2026-10-01', 80),
      item('2026-09-15', 150, { bucket: 'due_now', amountPaid: 30, balance: 120 }),
      item('2026-09-15', 0, { bucket: 'no_payment_required', status: 'no_payment_required', paymentRequired: false }),
      item('2025-09-01', 1000), item('invalid', 999),
    ], { startDate: '2026-09-01', endDate: '2026-09-30' }, 30, new Date('2026-09-27T12:00:00'));
    expect(result).toEqual({ paidInRange: 300, paidCount: 2, annualSpend: 430 });
  });

  it('uses a rolling inclusive calendar-day window, excludes future days, and retains paid amount fallback', () => {
    const result = getClientBillingPaidMetrics([
      item('2026-08-29T00:00:00', 10), item('2026-09-27T23:59:59', 20, { amountPaid: 0 }),
      item('2026-08-28T23:59:59', 30), item('2026-09-28', 40),
    ], undefined, 30, new Date('2026-09-27T12:00:00'));
    expect(result.paidInRange).toBe(30);
    expect(result.paidCount).toBe(2);
  });

  it('keeps the annual chart scoped to its calendar year with separate billing and payment dates', () => {
    const data = getClientBillingChartData([
      item('2025-09-05', 900), item('2026-09-05', 100),
      item('', 70, { paidAt: null, issueDate: '2026-09-10', bucket: 'due_now', amountPaid: 20 }),
      item('2026-10-05', 40, { issueDate: '2026-09-10' }),
      item('', 10, { paidAt: null, issueDate: null, dueDate: '2026-09-20' }),
      item('invalid', 1000),
    ], 2026);
    expect(data).toHaveLength(12);
    expect(data[8]).toEqual({ month: 'Sep', 'Amount billed': 220, 'Amount paid': 110 });
    expect(data[9]).toEqual({ month: 'Oct', 'Amount billed': 0, 'Amount paid': 40 });
    expect(data[0]).toEqual({ month: 'Jan', 'Amount billed': 0, 'Amount paid': 0 });
  });

  it('does not move a December bill into January when payment crosses a year boundary', () => {
    const record = item('2026-01-05', 250, { issueDate: '2025-12-20', dueDate: '2026-01-10' });
    const previousYear = getClientBillingChartData([record], 2025);
    const currentYear = getClientBillingChartData([record], 2026);
    expect(previousYear[11]).toEqual({ month: 'Dec', 'Amount billed': 250, 'Amount paid': 0 });
    expect(currentYear[0]).toEqual({ month: 'Jan', 'Amount billed': 0, 'Amount paid': 250 });
  });
});
