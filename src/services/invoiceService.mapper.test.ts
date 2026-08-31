import { describe, expect, it, vi } from 'vitest';

import { mapInvoiceMutationResponse, mapInvoiceResponse } from './invoiceService';
import { isChaseableInvoice } from '@/components/accounting/InvoiceList';

/**
 * Regression cover for the production closeout defect.
 *
 * `/api/invoices` returns `balance_due: 0` for client invoices that still owe the
 * full amount — the field belongs to the weekly payout model and is never populated
 * for them. The mapper treated a zero balance as settled, so every `sent` invoice was
 * relabelled `paid`, which both mislabelled the row and removed its Send Reminder
 * control. Invoice 00030 is the live example: `sent`, `is_paid: false`,
 * `amount_paid: "0.00"`, on an unpaid shoot, rendered as a green "paid" badge.
 *
 * Payloads below are the real shapes observed on production (2 Aug 2026), trimmed to
 * the fields the mapper reads.
 */

type ApiRecord = Parameters<typeof mapInvoiceResponse>[0];

const record = (overrides: Record<string, unknown>): ApiRecord =>
  ({
    id: 999,
    invoice_number: 'Invoice 09999',
    charges_total: 0,
    payments_total: 0,
    balance_due: 0,
    ...overrides,
  }) as unknown as ApiRecord;

const future = '2099-01-31T00:00:00.000000Z';
const past = '2026-05-14T00:00:00.000000Z';

// Exactly as returned by GET /api/invoices for invoice id 76.
const invoice00030 = record({
  id: 76,
  invoice_number: 'Invoice 00030',
  status: 'sent',
  is_paid: false,
  is_sent: true,
  total_amount: '475.94',
  amount_paid: '0.00',
  balance_due: 0,
  paid_at: null,
  sent_at: null,
  due_date: '2026-07-29T00:00:00.000000Z',
  shoot_id: 62,
});

describe('mapInvoiceResponse — status is never inferred from a zero balance', () => {
  it('keeps invoice 00030 out of paid and leaves it chaseable', () => {
    const mapped = mapInvoiceResponse(invoice00030);

    expect(mapped.status).not.toBe('paid');
    expect(mapped.balance).toBeCloseTo(475.94, 2);
    expect(isChaseableInvoice(mapped)).toBe(true);
  });

  it('maps invoice 00030 to sent once its due date is not in the past', () => {
    // The live record is past due, so it correctly resolves to `overdue`. With the
    // same payload and a future due date the preserved API status must be `sent`.
    const mapped = mapInvoiceResponse(record({ ...invoice00030, due_date: future }));

    expect(mapped.status).toBe('sent');
    expect(isChaseableInvoice(mapped)).toBe(true);
  });

  it('preserves sent for an unpaid invoice whose balance_due is zero', () => {
    const mapped = mapInvoiceResponse(
      record({ status: 'sent', is_paid: false, total_amount: '314.85', amount_paid: '0.00', balance_due: 0, due_date: future }),
    );

    expect(mapped.status).toBe('sent');
    expect(mapped.balance).toBeCloseTo(314.85, 2);
  });

  it('preserves sent when balance_due is absent entirely', () => {
    const mapped = mapInvoiceResponse(
      record({ status: 'sent', is_paid: false, total_amount: '106.00', amount_paid: '0.00', balance_due: undefined, due_date: future }),
    );

    expect(mapped.status).toBe('sent');
    expect(mapped.balance).toBeCloseTo(106, 2);
  });
});

describe('mapInvoiceResponse — paid is asserted only from authoritative fields', () => {
  it('maps a genuinely paid invoice to paid and stops chasing it', () => {
    const mapped = mapInvoiceResponse(
      record({ id: 77, invoice_number: 'Invoice 00031', status: 'paid', is_paid: true, total_amount: '350.00', amount_paid: '350.00', balance_due: 0, paid_at: '2026-06-29T14:33:02.000000Z' }),
    );

    expect(mapped.status).toBe('paid');
    expect(isChaseableInvoice(mapped)).toBe(false);
  });

  it('treats payments covering the total as paid even when status lags', () => {
    const mapped = mapInvoiceResponse(
      record({ status: 'sent', is_paid: false, total_amount: '200.00', amount_paid: '200.00', due_date: past }),
    );

    expect(mapped.status).toBe('paid');
    expect(isChaseableInvoice(mapped)).toBe(false);
  });

  it('honours the is_paid flag on its own', () => {
    const mapped = mapInvoiceResponse(
      record({ status: 'sent', is_paid: true, total_amount: '120.00', amount_paid: '0.00', due_date: past }),
    );

    expect(mapped.status).toBe('paid');
    expect(isChaseableInvoice(mapped)).toBe(false);
  });

  it('keeps a reported $0.00 invoice settled', () => {
    const mapped = mapInvoiceResponse(
      record({ id: 99, invoice_number: 'Invoice 00033', status: 'paid', is_paid: true, total_amount: '0.00', amount_paid: '0.00' }),
    );

    expect(mapped.status).toBe('paid');
    expect(isChaseableInvoice(mapped)).toBe(false);
  });

  it('keeps an overpaid invoice settled with zero balance and exposes refund credit due', () => {
    const mapped = mapInvoiceResponse(
      record({ status: 'paid', is_paid: true, total_amount: '100.00', amount_paid: '175.00', balance_due: 0 }),
    );

    expect(mapped.status).toBe('paid');
    expect(mapped.balance).toBe(0);
    expect(mapped.overpaymentAmount).toBe(75);
    expect(mapped.overpayment_amount).toBe(75);
    expect(isChaseableInvoice(mapped)).toBe(false);
  });

  it('preserves the canonical server overpayment when supplied', () => {
    const mapped = mapInvoiceResponse(
      record({ status: 'paid', total_amount: '100.00', amount_paid: '100.00', overpayment_amount: '25.50' }),
    );

    expect(mapped.overpaymentAmount).toBe(25.5);
  });
});

describe('mapInvoiceResponse — partial and overdue stay reminder-eligible', () => {
  it('keeps a part-paid invoice partial with the remaining balance', () => {
    const mapped = mapInvoiceResponse(
      record({ status: 'partial', is_paid: false, total_amount: '500.00', amount_paid: '150.00', balance_due: 0, due_date: future }),
    );

    expect(mapped.status).toBe('partial');
    expect(mapped.balance).toBeCloseTo(350, 2);
    expect(isChaseableInvoice(mapped)).toBe(true);
  });

  it('upgrades an outstanding past-due invoice to overdue', () => {
    const mapped = mapInvoiceResponse(
      record({ status: 'sent', is_paid: false, total_amount: '979.44', amount_paid: '0.00', balance_due: 0, due_date: past }),
    );

    expect(mapped.status).toBe('overdue');
    expect(isChaseableInvoice(mapped)).toBe(true);
  });

  it('keeps an invoice pending through the end of its due calendar day', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 7, 31, 12).getTime());
    const mapped = mapInvoiceResponse(
      record({ status: 'sent', is_paid: false, total_amount: '90.00', due_date: '2026-08-31' }),
    );

    expect(mapped.status).toBe('sent');
    nowSpy.mockRestore();
  });

  it('prefers a positive reported balance_due over the derived one', () => {
    const mapped = mapInvoiceResponse(
      record({ status: 'partial', is_paid: false, total_amount: '400.00', amount_paid: '0.00', balance_due: 125.5, due_date: future }),
    );

    expect(mapped.balance).toBeCloseTo(125.5, 2);
    expect(mapped.status).toBe('partial');
  });
});

describe('mapInvoiceResponse — incomplete payloads', () => {
  it('does not relabel an unpaid invoice as paid when no total is reported', () => {
    const mapped = mapInvoiceResponse(record({ status: 'sent', is_paid: false, total_amount: undefined, total: undefined, amount: undefined }));

    expect(mapped.status).toBe('sent');
    expect(mapped.status).not.toBe('paid');
  });

  it('falls back to pending when the payload carries no status at all', () => {
    const mapped = mapInvoiceResponse(record({ status: undefined, is_paid: false, total_amount: '90.00', amount_paid: '0.00', due_date: future }));

    expect(mapped.status).toBe('pending');
    expect(isChaseableInvoice(mapped)).toBe(true);
  });

  it('does not treat a missing amount_paid as full payment', () => {
    const mapped = mapInvoiceResponse(record({ status: 'sent', is_paid: false, total_amount: '250.00', amount_paid: undefined, due_date: future }));

    expect(mapped.status).toBe('sent');
    expect(mapped.balance).toBeCloseTo(250, 2);
  });
});

describe('mapInvoiceResponse — payout identity', () => {
  it('preserves role and payee for role-aware downloads', () => {
    const mapped = mapInvoiceResponse(record({
      role: 'photographer',
      photographer: { id: 44, name: 'Pat Photographer', email: 'pat@example.test' },
      status: 'sent',
      total_amount: '125.00',
      due_date: future,
    }));

    expect(mapped.role).toBe('photographer');
    expect(mapped.payee?.name).toBe('Pat Photographer');
  });
});

describe('mapInvoiceMutationResponse — affected shoot refresh contract', () => {
  it('preserves unique affected shoot ids from the mutation envelope', () => {
    const result = mapInvoiceMutationResponse({
      invoice: record({ id: 88, total_amount: '120.00', status: 'sent', due_date: future }),
      affected_shoot_ids: [12, '13', 12, null],
    });

    expect(result.invoice.id).toBe('88');
    expect(result.affectedShootIds).toEqual(['12', '13']);
  });

  it('keeps compatibility with an unwrapped invoice payload', () => {
    const result = mapInvoiceMutationResponse(
      record({ id: 89, total_amount: '75.00', status: 'sent', due_date: future }) as unknown as Record<string, unknown>,
    );

    expect(result.invoice.id).toBe('89');
    expect(result.affectedShootIds).toEqual([]);
  });
});
