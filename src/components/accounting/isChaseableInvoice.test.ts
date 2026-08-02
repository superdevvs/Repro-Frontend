import { describe, expect, it } from 'vitest';

import { isChaseableInvoice } from './InvoiceList';

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
