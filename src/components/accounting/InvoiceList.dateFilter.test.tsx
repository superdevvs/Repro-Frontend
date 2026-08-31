import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import type { InvoiceDateFilter } from '@/utils/invoiceDateFilters';
import type { InvoiceData } from '@/utils/invoiceUtils';
import { InvoiceList } from './InvoiceList';

interface MockToolbarProps {
  onFilterChange: (filter: InvoiceDateFilter) => void;
  resultCount: number;
}

vi.mock('@/components/accounting/InvoiceDateFilterToolbar', () => ({
  InvoiceDateFilterToolbar: ({ onFilterChange, resultCount }: MockToolbarProps) => (
    <div aria-label="Test invoice date toolbar">
      <span data-testid="filtered-result-count">{resultCount}</span>
      <button
        type="button"
        onClick={() => onFilterChange({
          preset: 'custom',
          customRange: { startDate: '2026-09-01', endDate: '2026-09-01' },
        })}
      >
        Filter September 1
      </button>
    </div>
  ),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

afterEach(() => cleanup());

const makeInvoice = (overrides: Partial<InvoiceData>): InvoiceData => ({
  id: 'invoice',
  number: 'BASE',
  client: 'Example Client',
  property: '100 Main Street',
  date: '2026-08-01',
  dueDate: '2026-08-15',
  amount: 100,
  status: 'pending',
  services: [],
  paymentMethod: 'N/A',
  ...overrides,
});

describe('InvoiceList date-filter integration', () => {
  it('keeps a weekly invoice whose billing period overlaps the selected day', async () => {
    const user = userEvent.setup();
    const crossingPeriod = makeInvoice({
      id: 'crossing',
      number: 'CROSSING',
      date: '2026-08-30',
      billingPeriodStart: '2026-08-30',
      billingPeriodEnd: '2026-09-05',
    });
    const augustOnly = makeInvoice({
      id: 'august-only',
      number: 'AUGUST',
      date: '2026-08-20',
      billingPeriodStart: '2026-08-20',
      billingPeriodEnd: '2026-08-26',
    });
    const pointInvoice = makeInvoice({
      id: 'point',
      number: 'POINT',
      date: '2026-09-01',
    });

    render(
      <InvoiceList
        data={{ invoices: [crossingPeriod, augustOnly, pointInvoice] }}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDownload={vi.fn()}
        onPay={vi.fn()}
        onSendReminder={vi.fn()}
      />,
    );

    expect(screen.getByTestId('filtered-result-count')).toHaveTextContent('3');
    expect(screen.getByText('#CROSSING')).toBeInTheDocument();
    expect(screen.getByText('#AUGUST')).toBeInTheDocument();
    expect(screen.getByText('#POINT')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter September 1' }));

    expect(screen.getByTestId('filtered-result-count')).toHaveTextContent('2');
    expect(screen.getByText('#CROSSING')).toBeInTheDocument();
    expect(screen.getByText('#POINT')).toBeInTheDocument();
    expect(screen.queryByText('#AUGUST')).not.toBeInTheDocument();
  });
});
