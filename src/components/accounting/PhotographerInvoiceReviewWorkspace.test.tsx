import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotographerInvoiceReviewWorkspace } from './PhotographerInvoiceReviewWorkspace';
import type { WeeklyInvoice, WeeklyInvoiceReviewQueueResponse } from '@/services/invoiceService';
import { fetchAdminInvoiceReviewQueue, fetchAdminInvoiceReviewDetail, approveWeeklyInvoice } from '@/services/invoiceService';

const mocks = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/invoiceService', () => ({
  fetchAdminInvoiceReviewQueue: vi.fn(), fetchAdminInvoiceReviewDetail: vi.fn(), approveWeeklyInvoice: vi.fn(),
  adminRejectWeeklyInvoice: vi.fn(), downloadInvoiceCsv: vi.fn(),
}));
vi.mock('@/utils/invoiceDownloads', () => ({ downloadInvoicePdf: vi.fn(), downloadInvoicesPdf: vi.fn() }));
vi.mock('@/utils/accountingExports', () => ({ exportRowsAsCsv: vi.fn(), exportRowsAsExcel: vi.fn(), exportRowsAsPdf: vi.fn() }));
vi.mock('@/components/invoices/InvoiceApprovalDialog', () => ({ InvoiceApprovalDialog: () => null }));
vi.mock('./PayoutReportPanel', () => ({ PayoutReportPanel: () => null }));
vi.mock('./InvoiceDateFilterToolbar', () => ({ InvoiceDateFilterToolbar: () => null }));
vi.mock('./InvoiceReviewWorkspaceParts', () => ({
  EmptyQueueState: () => <p>Empty queue</p>,
  DetailShell: ({ invoice, detailLoading, onApprove }: { invoice: WeeklyInvoice | null; detailLoading: boolean; onApprove: () => void }) =>
    detailLoading ? <p>Loading selected detail</p> : invoice ? <div><p>Selected detail {invoice.id}</p><button onClick={onApprove}>Approve selected</button></div> : <p>No selected detail</p>,
}));

const invoices = [
  { id: 1, photographer: { id: 11, name: 'Alice', email: 'alice@example.com' }, approval_status: 'pending_approval', total_amount: 100, billing_period_start: '2026-09-20', billing_period_end: '2026-09-26' },
  { id: 2, photographer: { id: 12, name: 'Bob', email: 'bob@example.com' }, approval_status: 'pending_approval', total_amount: 200, billing_period_start: '2026-09-20', billing_period_end: '2026-09-26' },
] as WeeklyInvoice[];
const response = { data: invoices, total: 2, current_page: 1, last_page: 1, summary: { invoice_count: 2, total_amount: 300, needs_review_count: 2, approved_count: 0, returned_count: 0 } } as WeeklyInvoiceReviewQueueResponse;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchAdminInvoiceReviewQueue).mockResolvedValue(response);
  vi.mocked(fetchAdminInvoiceReviewDetail).mockImplementation(async (id) => invoices.find((invoice) => invoice.id === id)!);
});
afterEach(cleanup);
describe('Accounts review queue', () => {
  it('omits the status parameter for All records and sends row-count changes to server pagination', async () => {
    render(<PhotographerInvoiceReviewWorkspace />);
    await screen.findByText('Selected detail 1');
    fireEvent.change(screen.getByRole('combobox', { name: 'Review status' }), { target: { value: 'all' } });
    await waitFor(() => expect(fetchAdminInvoiceReviewQueue).toHaveBeenLastCalledWith(expect.objectContaining({ approval_status: undefined, page: 1, per_page: 6 })));
    fireEvent.change(screen.getByRole('combobox', { name: 'Invoices per page' }), { target: { value: '12' } });
    await waitFor(() => expect(fetchAdminInvoiceReviewQueue).toHaveBeenLastCalledWith(expect.objectContaining({ per_page: 12, page: 1 })));
  });

  it('cannot approve the previous invoice while the next selected detail is loading or fails', async () => {
    let rejectDetail!: (error: Error) => void;
    const pending = new Promise<WeeklyInvoice>((_, reject) => { rejectDetail = reject; });
    vi.mocked(fetchAdminInvoiceReviewDetail).mockResolvedValueOnce(invoices[0]).mockReturnValueOnce(pending);
    render(<PhotographerInvoiceReviewWorkspace />);
    await screen.findByText('Selected detail 1');
    fireEvent.click(screen.getByRole('button', { name: /Bob/ }));
    expect(await screen.findByText('Loading selected detail')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve selected' })).not.toBeInTheDocument();
    await act(async () => rejectDetail(new Error('detail unavailable')));
    expect(await screen.findByText('No selected detail')).toBeInTheDocument();
    expect(approveWeeklyInvoice).not.toHaveBeenCalled();
  });
});
