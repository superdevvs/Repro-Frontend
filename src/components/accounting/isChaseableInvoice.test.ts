import { describe, expect, it } from 'vitest';

import { isChaseableInvoice, isSettleableInvoice } from './InvoiceList';

/**
 * Which invoices offer "Send reminder".
 *
 * The control was originally gated on `pending`/`overdue`, but the backend marks
 * an issued invoice `sent` and a part-paid one `partial` — so on real data the
 * reminder was unreachable for exactly the invoices that needed chasing.
 *
 * Note the casts below. `InvoiceData['status']` is declared as
 * `'paid' | 'pending' | 'overdue'`, which is narrower than what the API actually
 * returns — `invoiceService.mapInvoiceResponse` passes the backend value straight
 * through with a cast. That understated type is the reason the original gate was
 * written the way it was, so these cases deliberately exercise the real values
 * rather than the declared ones.
 */
type ChaseableInvoice = Parameters<typeof isChaseableInvoice>[0];

const invoice = (
  status: string,
  overrides: { amount?: number; balance?: number } = {},
): ChaseableInvoice =>
  ({
    status,
    amount: 400,
    balance: 400,
    ...overrides,
  }) as unknown as ChaseableInvoice;

describe('isChaseableInvoice', () => {
  it.each(['sent', 'partial', 'pending', 'overdue'])(
    'chases an outstanding %s invoice',
    (status) => {
      expect(isChaseableInvoice(invoice(status))).toBe(true);
    },
  );

  it.each(['paid', 'draft', 'cancelled', 'canceled', 'void', 'refunded'])(
    'never chases a %s invoice',
    (status) => {
      expect(isChaseableInvoice(invoice(status))).toBe(false);
    },
  );

  it('ignores case and surrounding whitespace on the status', () => {
    expect(isChaseableInvoice(invoice(' PAID '))).toBe(false);
    expect(isChaseableInvoice(invoice('Partial'))).toBe(true);
  });

  it('does not chase a zero balance even when the status looks unsettled', () => {
    // A $0.00 invoice is settled by definition; chasing it would be a wrong email.
    expect(isChaseableInvoice(invoice('sent', { amount: 0, balance: 0 }))).toBe(false);
  });

  it('chases a part-paid invoice on its remaining balance', () => {
    expect(isChaseableInvoice(invoice('partial', { amount: 500, balance: 350 }))).toBe(true);
  });

  it('falls back to the amount when no balance is recorded', () => {
    expect(isChaseableInvoice(invoice('sent', { amount: 400, balance: undefined }))).toBe(true);
    expect(isChaseableInvoice(invoice('sent', { amount: 0, balance: undefined }))).toBe(false);
  });

  it('chases when neither figure is usable, rather than hiding the action', () => {
    // Better to offer a reminder an operator can judge than to silently remove
    // the only chase mechanism because of missing data.
    expect(
      isChaseableInvoice(invoice('sent', { amount: undefined, balance: undefined })),
    ).toBe(true);
  });
});

describe('isSettleableInvoice', () => {
  it.each(['sent', 'partial', 'unpaid', 'pending', 'overdue'])(
    'allows a superadmin to settle an outstanding %s invoice',
    (status) => {
      expect(isSettleableInvoice(invoice(status, { balance: 125 }))).toBe(true);
    },
  );

  it.each(['paid', 'draft', 'cancelled', 'canceled', 'void', 'refunded'])(
    'does not offer settlement for a %s invoice',
    (status) => {
      expect(isSettleableInvoice(invoice(status, { balance: 125 }))).toBe(false);
    },
  );

  it('does not offer settlement when the remaining balance is zero', () => {
    expect(isSettleableInvoice(invoice('sent', { amount: 400, balance: 0 }))).toBe(false);
    expect(isSettleableInvoice(invoice('partial', { amount: 400, balance: 0 }))).toBe(false);
  });

  it('falls back to a known positive invoice amount when balance is unavailable', () => {
    expect(isSettleableInvoice(invoice('sent', { amount: 400, balance: undefined }))).toBe(true);
  });

  it('rejects unknown or unusable financial state', () => {
    expect(isSettleableInvoice(invoice('processing', { balance: 125 }))).toBe(false);
    expect(
      isSettleableInvoice(invoice('sent', { amount: undefined, balance: undefined })),
    ).toBe(false);
  });
});
