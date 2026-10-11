import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it } from 'vitest';
import type { WeeklyInvoice, WeeklyInvoiceItem } from '@/services/invoiceService';
import { PayoutBasisSummary, PayoutReconciliationSummary } from './PayoutReconciliationSummary';

afterEach(cleanup);
it('separates pending work from invoice amount and preserves before/after corrections', () => {
  render(<PayoutReconciliationSummary invoice={{ role: 'photographer', total_amount: 851.4,
    payout_review: { before_total: 716.4, submitted_total: 851.4, reconciliation: {
      pending_count: 2, pending_total: 135, pending_lines: [{ shoot_id: 2427, amount: 56.25, address: '4610 Old Court Road', work_date: '2026-10-10', service_name: '25 Flash', reason: 'Awaiting submission' }], unallocated_count: 0,
    } },
  } as WeeklyInvoice} />);
  expect(screen.getByText(/2 shoots pending photographer completion/)).toHaveTextContent('$135.00');
  expect(screen.getByText('Current invoice')).toHaveTextContent('$851.40');
  expect(screen.getByText('Before corrections')).toHaveTextContent('$716.40');
  expect(screen.getByText(/4610 Old Court Road/)).toBeInTheDocument();
});
it('shows a saved package and a reviewed correction without silently changing its basis', () => {
  render(<PayoutBasisSummary item={{ total_amount: 89.55, meta: { late_work: true,
    payout_basis: { service_name: '25 HDR', booked_price: 175, photo_count: 25, unit_pay: 78.75, quantity: 1, pay_type: 'percent', percent: 45 },
  } } as WeeklyInvoiceItem} />);
  expect(screen.getByText(/Booked 25 HDR/)).toHaveTextContent('$175.00');
  expect(screen.getByText(/45% of booked price/)).toBeInTheDocument();
  expect(screen.getByText(/Invoice correction/)).toHaveTextContent('$78.75 → reviewed line $89.55');
  expect(screen.getByText(/Earlier-week work/)).toBeInTheDocument();
});
