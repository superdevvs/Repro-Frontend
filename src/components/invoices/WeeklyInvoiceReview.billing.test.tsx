import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { WeeklyInvoice } from '@/services/invoiceService';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn(), csv: vi.fn(), role: 'salesRep' }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: mocks.role, user: { id: '1' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/shootsContextState', () => ({ useShoots: () => ({ shoots: [] }) }));
vi.mock('@/services/invoiceService', () => ({ fetchPhotographerInvoices: mocks.fetch, fetchSalesRepInvoices: mocks.fetch, addWeeklyInvoiceExpense: vi.fn(), removeWeeklyInvoiceExpense: vi.fn(), submitWeeklyInvoiceChangesForApproval: vi.fn(), submitWeeklyInvoiceForApproval: vi.fn() }));
vi.mock('@/utils/accountingExports', () => ({ exportRowsAsCsv: mocks.csv, exportRowsAsExcel: vi.fn(), exportRowsAsPdf: vi.fn() }));
vi.mock('@/utils/invoiceDownloads', () => ({ downloadInvoicesPdf: vi.fn() }));
vi.mock('@/components/invoices/InvoiceApprovalDialog', () => ({ InvoiceApprovalDialog: () => null }));
vi.mock('@/components/accounting/InvoiceDateFilterToolbar', () => ({ InvoiceDateFilterToolbar: ({ selectedCount, onExport }: { selectedCount: number; onExport: (format: string) => void }) => <div><span>{selectedCount} selected</span><button onClick={() => onExport('csv')}>Export CSV</button></div> }));
import { WeeklyInvoiceReview } from './WeeklyInvoiceReview';

const invoice = (id: number, overrides: Partial<WeeklyInvoice> = {}): WeeklyInvoice => ({ id, billing_period_start: `2026-09-${String(id * 2).padStart(2, '0')}`, billing_period_end: `2026-09-${String(id * 2 + 1).padStart(2, '0')}`, total_amount: id * 10, amount_paid: 0, status: 'sent', approval_status: 'pending', created_at: '2026-09-01', items: [], ...overrides });
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'salesRep'; mocks.fetch.mockResolvedValue({ data: [1, 2, 3, 4, 5].map((id) => invoice(id)), current_page: 1, last_page: 1, total: 5 }); });

describe('weekly billing workspace', () => {
  it.each([
    ['photographer', 'Shoots', '1'],
    ['salesRep', 'Commission Lines', '2'],
  ])('counts %s detail correctly when one shoot has two charge lines', async (role, label, expected) => {
    mocks.role = role;
    mocks.fetch.mockResolvedValue({ data: [invoice(122, {
      billing_period_start: '2026-09-13', billing_period_end: '2026-09-19', total_amount: 123.75,
      items: [
        { id: 308, invoice_id: 122, type: 'charge', shoot_id: 89, quantity: 1, unit_amount: 78.75, total_amount: 78.75, description: '25 HDR Photos' },
        { id: 309, invoice_id: 122, type: 'charge', shoot_id: 89, quantity: 1, unit_amount: 45, total_amount: 45, description: '10 Exterior HDR Photos' },
      ],
    })], current_page: 1, last_page: 1, total: 1 });
    render(<WeeklyInvoiceReview />);
    const countLabel = await screen.findByText(label);
    expect(within(countLabel.parentElement!).getByText(expected)).toBeInTheDocument();
    expect(screen.getByText('25 HDR Photos')).toBeInTheDocument();
    expect(screen.getByText('10 Exterior HDR Photos')).toBeInTheDocument();
  });

  it('paginates history while keeping selected exports across pages', async () => {
    render(<WeeklyInvoiceReview />);
    await screen.findByRole('heading', { name: 'Commission reviews' });
    expect(screen.getByText('1–3 of 5')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Next weekly review page' }));
    expect(screen.getByText('4–5 of 5')).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(mocks.csv).toHaveBeenCalled());
    expect(mocks.csv.mock.calls[0][2]).toHaveLength(1);
  });
  it('blocks review and expense edits on a paid invoice even when approval is pending', async () => {
    mocks.fetch.mockResolvedValue({ data: [invoice(1, { is_paid: true, status: 'paid' })], current_page: 1, last_page: 1, total: 1 });
    render(<WeeklyInvoiceReview />);
    await screen.findByText('This invoice has been paid and is locked.');
    expect(screen.queryByRole('button', { name: 'Review & submit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Adjustment' })).not.toBeInTheDocument();
  });
  it('respects a server edit lock on a pending invoice', async () => {
    mocks.fetch.mockResolvedValue({ data: [invoice(1, { can_edit: false })], current_page: 1, last_page: 1, total: 1 });
    render(<WeeklyInvoiceReview />);
    await screen.findByRole('heading', { name: 'Commission reviews' });
    expect(screen.queryByRole('button', { name: 'Edit & submit changes' })).not.toBeInTheDocument();
  });
});
