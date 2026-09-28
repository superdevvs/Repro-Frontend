import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OverviewCards } from './OverviewCards';
import { PaymentsSummary } from './PaymentsSummary';
import { invoicePaidAmount, invoiceLastPaymentDate } from '@/utils/invoicePayments';
import { mapInvoiceResponse } from '@/services/invoiceService.mapper';
import type { InvoiceApiRecord } from '@/services/invoiceService.types';

afterEach(cleanup);
const invoice = (overrides: Partial<InvoiceApiRecord>) => mapInvoiceResponse({
  id: 1, status: 'pending', total_amount: 185, amount_paid: 60, balance_due: 125,
  due_date: null, issue_date: new Date().toISOString(), payment_method: 'legacy_import',
  client: 'Imported client', ...overrides,
});

describe('Accounting imported and partial payments', () => {
  it('keeps existing sent invoices in outstanding totals when no due date was assigned', () => {
    render(<OverviewCards invoices={[invoice({status:'sent', amount_paid:0, balance_due:185})]} />);
    expect(screen.getByText('$185')).toBeTruthy();
  });

  it('counts partial cash received while retaining the unpaid balance', () => {
    render(<OverviewCards invoices={[invoice({}), invoice({id: 2, status:'paid', total_amount:100, amount_paid:100, balance_due:0})]} />);
    expect(screen.getAllByText('$160')).toHaveLength(2);
    expect(screen.getByText('$125')).toBeTruthy();
    expect(screen.getByText('Payments on 2 invoices in last 30 days')).toBeTruthy();
  });
  it('shows partial payments in the payment summary and only the overdue remainder', () => {
    render(<PaymentsSummary invoices={[invoice({status:'overdue'})]} />);
    expect(screen.getAllByText('$60').length).toBeGreaterThan(0);
    expect(screen.getByText('$125')).toBeTruthy();
    expect(screen.getByText('32% of invoiced amount paid')).toBeTruthy();
  });
  it('does not treat an explicit zero payment as cash collected', () => {
    expect(invoicePaidAmount(invoice({status:'paid', amount_paid:0}))).toBe(0);
  });
  it('retains the historical partial payment date without marking the invoice paid', () => {
    const mapped=invoice({payment_details:{last_payment_at:'2026-09-22T04:00:00Z'}});
    expect(mapped.status).toBe('pending');
    expect(invoiceLastPaymentDate(mapped)).toBe('2026-09-22T04:00:00Z');
  });
});
