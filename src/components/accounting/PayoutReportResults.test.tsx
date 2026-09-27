import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { PayoutReport } from '@/services/invoiceService';
import { PayoutReportResults } from './PayoutReportResults';
import { getPayoutReportRows } from './payoutReportDisplay';

afterEach(cleanup);
const report = {
  photographers: Array.from({ length: 8 }, (_, index) => ({ id: index, name: `Photographer ${index}`, email: `p${index}@example.com`, shoot_count: 2, gross_total: 200, average_value: 100 })),
  editors: [],
  sales_reps: [{ id: 0, name: 'Sales representative', email: 'sales@example.com', shoot_count: 3, gross_total: 1000, commission_rate: 0, commission_total: 0 }],
} as unknown as PayoutReport;
describe('Payout report scope and navigation', () => {
  it('keeps role scope and actual commission totals without confusing gross revenue with payout', () => {
    expect(getPayoutReportRows(report, 'salesRep')).toHaveLength(1);
    expect(getPayoutReportRows(report, 'salesRep')[0]).toMatchObject({ payout: 0, commission_rate: 0 });
    expect(new Set(getPayoutReportRows(report, 'all').map((row) => row.key)).size).toBe(9);
  });
  it('paginates payees and searches all report rows without changing report totals', () => {
    render(<PayoutReportResults rows={getPayoutReportRows(report, 'photographer')} />);
    expect(screen.queryByRole('button', { name: 'Photographer 7' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next report page' }));
    expect(screen.getByRole('button', { name: 'Photographer 7' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search report payees' }), { target: { value: 'p7@' } });
    expect(screen.getByRole('button', { name: 'Photographer 7' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next report page' })).toBeDisabled();
    expect(screen.getByText('$1,600.00')).toBeInTheDocument();
  });
});
