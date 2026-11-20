import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeeklyInvoice, WeeklyInvoiceReviewQueueResponse } from '@/services/invoiceService';
import { fetchAdminInvoiceReviewDetail, fetchAdminInvoiceReviewQueue } from '@/services/invoiceService';
import { downloadInvoicesPdf } from '@/utils/invoiceDownloads';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/invoiceService', () => ({
  fetchAdminInvoiceReviewQueue: vi.fn(), fetchAdminInvoiceReviewDetail: vi.fn(), approveWeeklyInvoice: vi.fn(),
  adminRejectWeeklyInvoice: vi.fn(), downloadInvoiceCsv: vi.fn(),
}));
vi.mock('@/utils/invoiceDownloads', () => ({ downloadInvoicePdf: vi.fn(), downloadInvoicesPdf: vi.fn() }));
vi.mock('@/utils/accountingExports', () => ({ exportRowsAsCsv: vi.fn(), exportRowsAsExcel: vi.fn(), exportRowsAsPdf: vi.fn() }));
vi.mock('@/components/invoices/InvoiceApprovalDialog', () => ({ InvoiceApprovalDialog: () => null }));
vi.mock('./PayoutReportPanel', () => ({ PayoutReportPanel: () => null }));
vi.mock('./InvoiceDateFilterToolbar', () => ({
  InvoiceDateFilterToolbar: ({ onBulkPdf }: { onBulkPdf: () => void }) => <button onClick={onBulkPdf}>Bulk PDF</button>,
}));
vi.mock('./InvoiceReviewWorkspaceParts', () => ({ EmptyQueueState: () => null, DetailShell: () => null }));

import { PhotographerInvoiceReviewWorkspace } from './PhotographerInvoiceReviewWorkspace';

const queueRow = {
  id: 5, role: 'salesRep', salesRep: { id: 9, name: 'Sam Rep', email: 'sam@example.test' }, approval_status: 'pending_approval',
  total_amount: 100, amount_paid: 0, billing_period_start: '2026-04-05', billing_period_end: '2026-04-11', created_at: '2026-04-12', status: 'draft',
} as WeeklyInvoice;
const detail = {
  ...queueRow,
  items: [
    { id: 1, invoice_id: 5, shoot_id: 7, type: 'charge', quantity: 1, unit_amount: 100, total_amount: 100, description: 'Shoot #7 - 1234 Main St', client_name: 'Jane Smith' },
    { id: 2, invoice_id: 5, type: 'payment', quantity: 1, unit_amount: 500, total_amount: 500, description: 'Client receipt' },
  ],
} as WeeklyInvoice;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchAdminInvoiceReviewQueue).mockResolvedValue({ data: [queueRow], total: 1, current_page: 1, last_page: 1, summary: { invoice_count: 1, total_amount: 100, needs_review_count: 1, approved_count: 0, returned_count: 0 } } as WeeklyInvoiceReviewQueueResponse);
  vi.mocked(fetchAdminInvoiceReviewDetail).mockResolvedValue(detail);
});
afterEach(cleanup);

describe('payout review PDF downloads', () => {
  it('loads each selected invoice lines so the PDF lists addresses with their clients', async () => {
    render(<PhotographerInvoiceReviewWorkspace role="salesRep" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select invoice W-5 for export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bulk PDF' }));

    await waitFor(() => expect(downloadInvoicesPdf).toHaveBeenCalled());
    const [documents] = vi.mocked(downloadInvoicesPdf).mock.calls[0] as unknown as [Array<WeeklyInvoice>];
    expect(documents).toHaveLength(1);
    expect(documents[0].items).toEqual([expect.objectContaining({ description: 'Shoot #7 - 1234 Main St', client_name: 'Jane Smith' })]);
    expect(documents[0].total_amount).toBe(100);
  });
});
