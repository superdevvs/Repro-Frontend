import { describe, expect, it } from 'vitest';

import { normalizeShootPaymentSummary, sumCompletedPayments } from './shootPaymentSummary';

/**
 * Refund arithmetic.
 *
 * Before refunds were recorded per payment, any refund removed the entire
 * payment from the paid total — a $50 refund against a $500 payment wiped out
 * all $500 and the shoot reported as unpaid. These tests pin the corrected
 * behaviour: a refund reduces a payment's contribution by exactly its amount.
 */

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  status: 'completed',
  amount: 500,
  ...overrides,
});

describe('sumCompletedPayments with refunds', () => {
  it('subtracts a partial refund rather than the whole payment', () => {
    expect(sumCompletedPayments([payment({ refunded_amount: 50 })])).toBe(450);
  });

  it('treats a fully refunded payment as contributing nothing', () => {
    expect(sumCompletedPayments([payment({ refunded_amount: 500 })])).toBe(0);
  });

  it('never returns a negative contribution when over-refunded', () => {
    expect(sumCompletedPayments([payment({ refunded_amount: 600 })])).toBe(0);
  });

  it('accepts the camelCase field name', () => {
    expect(sumCompletedPayments([payment({ refundedAmount: 125 })])).toBe(375);
  });

  it('still honours a legacy refunded flag with no amount recorded', () => {
    expect(sumCompletedPayments([payment({ refund_status: 'refunded' })])).toBe(0);
    expect(sumCompletedPayments([payment({ refunded_at: '2026-07-01T00:00:00Z' })])).toBe(0);
  });

  it('sums several payments, each net of its own refunds', () => {
    const total = sumCompletedPayments([
      payment({ id: 'a', amount: 300, refunded_amount: 100 }),
      payment({ id: 'b', amount: 200 }),
      payment({ id: 'c', amount: 100, refunded_amount: 100 }),
    ]);

    expect(total).toBe(400);
  });

  it('ignores payments that never completed', () => {
    expect(sumCompletedPayments([payment({ status: 'failed' })])).toBe(0);
  });
});

describe('normalizeShootPaymentSummary with refunds', () => {
  it('reports partial when a refund drops the paid total below the quote', () => {
    const summary = normalizeShootPaymentSummary({
      total_quote: 500,
      payments: [payment({ amount: 500, refunded_amount: 50 })],
    } as never);

    expect(summary.totalPaid).toBe(450);
    expect(summary.balance).toBe(50);
    expect(summary.paymentStatus).toBe('partial');
  });

  it('reports unpaid once everything is refunded', () => {
    const summary = normalizeShootPaymentSummary({
      total_quote: 500,
      payments: [payment({ amount: 500, refunded_amount: 500 })],
    } as never);

    expect(summary.totalPaid).toBe(0);
    expect(summary.balance).toBe(500);
    expect(summary.paymentStatus).toBe('unpaid');
  });

  it('stays paid when nothing has been refunded', () => {
    const summary = normalizeShootPaymentSummary({
      total_quote: 500,
      payments: [payment({ amount: 500 })],
    } as never);

    expect(summary.totalPaid).toBe(500);
    expect(summary.balance).toBe(0);
    expect(summary.paymentStatus).toBe('paid');
  });

  it('never reports a negative balance', () => {
    const summary = normalizeShootPaymentSummary({
      total_quote: 100,
      payments: [payment({ amount: 500 })],
    } as never);

    expect(summary.balance).toBe(0);
    expect(summary.paymentStatus).toBe('paid');
  });
});
