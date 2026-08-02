import { describe, expect, it } from 'vitest';

import { isChaseableInvoice } from './InvoiceList';
import type { InvoiceData } from '@/utils/invoiceUtils';

/**
 * Which invoices offer "Send reminder".
 *
 * The control was originally gated on `pending`/`overdue`, but the backend marks
 * an issued invoice `sent` and a part-paid one `partial` — so on real data the
 * reminder was unreachable for exactly the invoices that needed chasing. These
 * pin the replacement rule.
 */
const invoice = (overrides: Partial<InvoiceData>): InvoiceData =>
  ({ status: 'sent', amount: 400, balance: 400, ...overrides } as InvoiceData);

describe('isChaseableInvoice', () => {
  it.each(['sent', 'partial', 'pending', 'overdue'])(
    'chases an outstanding %s invoice',
    (status) => {
      expect(isChaseableInvoice(invoice({ status: status as InvoiceData['status'] }))).toBe(true);
    },
  );

  it.each(['paid', 'draft', 'cancelled', 'canceled', 'void', 'refunded'])(
    'never chases a %s invoice',
    (status) => {
      expect(isChaseableInvoice(invoice({ status: status as InvoiceData['status'] }))).toBe(false);
    },
  );

  it('ignores case and surrounding whitespace on the status', () => {
    expect(isChaseableInvoice(invoice({ status: ' PAID ' as InvoiceData['status'] }))).toBe(false);
    expect(isChaseableInvoice(invoice({ status: 'Partial' as InvoiceData['status'] }))).toBe(true);
  });

  it('does not chase a zero balance even when the status looks unsettled', () => {
    // A $0.00 invoice is settled by definition; chasing it would be a wrong email.
    expect(isChaseableInvoice(invoice({ status: 'sent', amount: 0, balance: 0 }))).toBe(false);
  });

  it('chases a part-paid invoice on its remaining balance', () => {
    expect(isChaseableInvoice(invoice({ status: 'partial', amount: 500, balance: 350 }))).toBe(true);
  });

  it('falls back to the amount when no balance is recorded', () => {
    expect(
      isChaseableInvoice({ status: 'sent', amount: 400, balance: undefined } as InvoiceData),
    ).toBe(true);
    expect(
      isChaseableInvoice({ status: 'sent', amount: 0, balance: undefined } as InvoiceData),
    ).toBe(false);
  });

  it('chases when neither figure is usable, rather than hiding the action', () => {
    // Better to offer a reminder that an operator can judge than to silently
    // remove the only chase mechanism because of missing data.
    expect(
      isChaseableInvoice({
        status: 'sent',
        amount: undefined,
        balance: undefined,
      } as unknown as InvoiceData),
    ).toBe(true);
  });
});
