import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), download: vi.fn(), send: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/invoiceService', () => ({ fetchPayoutReport: mocks.fetch, downloadPayoutReport: mocks.download, sendPayoutReport: mocks.send }));
vi.mock('@/components/ui/date-range-picker', () => ({ DateRangePicker: () => <button>Local payout dates</button> }));
vi.mock('./PayoutReportResults', () => ({ PayoutReportResults: () => <p>Report results</p> }));
import { PayoutReportPanel } from './PayoutReportPanel';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockImplementation(async ({ start, end }) => ({ period: { start: start || '2026-10-04', end: end || '2026-10-10' }, photographers: [], sales_reps: [], editors: [], totals: {} }));
  mocks.download.mockResolvedValue(undefined);
  mocks.send.mockResolvedValue({ message: 'Queued', sent_count: 0 });
});
afterEach(cleanup);
describe('Payout report inherited Home dates', () => {
  it('keeps the exact selected range on load, CSV export, sending and a date change', async () => {
    const actions = vi.fn();
    const { rerender } = render(<PayoutReportPanel role="photographer" registerActions={actions} reportingRange={{ startDate: '2026-09-10', endDate: '2026-10-09' }} />);
    await screen.findByText('Report results');
    expect(screen.queryByRole('button', { name: 'Local payout dates' })).not.toBeInTheDocument();
    expect(mocks.fetch).toHaveBeenLastCalledWith({ role: 'photographer', start: '2026-09-10', end: '2026-10-09', exact_range: true });
    await act(async () => { await actions.mock.lastCall![0].download(); });
    expect(mocks.download).toHaveBeenLastCalledWith({ role: 'photographer', start: '2026-09-10', end: '2026-10-09', exact_range: true });
    await act(async () => { await actions.mock.lastCall![0].send(); });
    expect(mocks.send).toHaveBeenLastCalledWith({ role: 'photographer', start: '2026-09-10', end: '2026-10-09', exact_range: true });
    rerender(<PayoutReportPanel role="photographer" registerActions={actions} reportingRange={{ startDate: '2026-10-01', endDate: '2026-10-09' }} />);
    await waitFor(() => expect(mocks.fetch).toHaveBeenLastCalledWith({ role: 'photographer', start: '2026-10-01', end: '2026-10-09', exact_range: true }));
  });
  it('preserves the dedicated payout workspace date controls and weekly default', async () => {
    render(<PayoutReportPanel role="salesRep" />);
    await screen.findByText('Report results');
    expect(screen.getByRole('button', { name: 'Local payout dates' })).toBeInTheDocument();
    expect(mocks.fetch).toHaveBeenLastCalledWith({ role: 'salesRep', exact_range: false });
  });
});
