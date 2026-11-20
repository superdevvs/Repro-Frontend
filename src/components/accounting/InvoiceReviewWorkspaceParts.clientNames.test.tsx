import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeeklyInvoice } from '@/services/invoiceService';

vi.mock('./InvoiceAccountsNote', () => ({ InvoiceAccountsNote: () => null }));
vi.mock('@/components/invoices/PayoutReconciliationSummary', () => ({
  PayoutReconciliationSummary: () => null,
  PayoutBasisSummary: () => null,
}));

import { DetailShell } from './InvoiceReviewWorkspaceParts';

afterEach(cleanup);

const salesRepInvoice = {
  id: 77, role: 'salesRep', billing_period_start: '2026-04-05', billing_period_end: '2026-04-11',
  total_amount: 140, amount_paid: 0, status: 'draft', approval_status: 'pending_approval', created_at: '2026-04-12',
  salesRep: { id: 5, name: 'Sam Rep', email: 'sam@example.test' },
  items: [
    { id: 1, invoice_id: 77, shoot_id: 7, type: 'charge', quantity: 1, unit_amount: 100, total_amount: 100,
      description: 'Shoot #7 - 1234 Main St (Commission 10% on $1,000.00)', client_name: 'Jane Smith' },
    { id: 2, invoice_id: 77, shoot_id: 8, type: 'charge', quantity: 1, unit_amount: 40, total_amount: 40,
      description: 'Shoot #8 - 9 Oak Ave (Commission 10% on $400.00)' },
  ],
  shoots: [
    { id: 7, address: '1234 Main St', scheduled_date: '2026-04-06', client: { id: 1, name: 'Jane Smith', email: '' } },
    { id: 8, address: '9 Oak Ave', scheduled_date: '2026-04-07', client: { id: 2, name: 'Older Invoice Client', email: '' } },
  ],
} as WeeklyInvoice;

describe('payout review detail lines', () => {
  it('shows each sales rep line client under its address, including lines generated before names were stored', () => {
    render(<DetailShell invoice={salesRepInvoice} detailLoading={false} onApprove={vi.fn()} onReturn={vi.fn()} role="salesRep" />);

    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('1234 Main St');
    expect(table).toHaveTextContent('Client: Jane Smith');
    expect(table).toHaveTextContent('9 Oak Ave');
    expect(table).toHaveTextContent('Client: Older Invoice Client');
  });
});
