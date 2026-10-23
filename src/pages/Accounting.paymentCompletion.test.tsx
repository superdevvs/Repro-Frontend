import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvoicePaymentCompletePayload } from '@/components/invoices/PaymentDialog';
import AccountingPage from './Accounting';

const mocks = vi.hoisted(() => ({
  invoice: { id: 'invoice-1', number: 'INV-1', status: 'sent', amount: 100, amountPaid: 0, balance: 100, shoot_id: 42, items: [] },
  markPaid: vi.fn(), refresh: vi.fn(), toast: vi.fn(), refetch: vi.fn(), completion: vi.fn(),
  query: { data: undefined as unknown, isLoading: false, error: null },
}));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'superadmin', user: { id: 7, role: 'superadmin' } }) }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: vi.fn() }));
vi.mock('@/services/api', () => ({ getImpersonatedUserId: () => null }));
vi.mock('@/services/invoiceService', () => ({
  fetchInvoices: vi.fn(), markInvoiceAsPaid: mocks.markPaid, downloadInvoiceCsv: vi.fn(), sendInvoicePaymentReminder: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ ...mocks.query, refetch: mocks.refetch }) }));
vi.mock('@/realtime/realtimeRefreshBus', () => ({ registerInvoicesRefresh: () => () => undefined, triggerInvoicesRefresh: mocks.refresh }));
vi.mock('@/hooks/useClientBilling', () => ({ useClientBilling: () => ({ data: null, loading: false, error: null }) }));
vi.mock('@/hooks/useSalesRepSummary', () => ({ useSalesRepSummary: () => ({ data: null, loading: false, error: null, refresh: vi.fn() }) }));
vi.mock('@/context/shootsContextState', () => ({ useShoots: () => ({ shoots: [], isInitialLoading: false }) }));
vi.mock('@/components/accounting/AccountingHeader', () => ({ AccountingHeader: () => null }));
vi.mock('@/components/accounting/AccountingDateRangeControl', () => ({ AccountingDateRangeControl: () => null }));
vi.mock('@/components/accounting/AccountingHome', () => ({ AccountingHome: ({ invoices }: { invoices: ReactNode }) => <>{invoices}</> }));
vi.mock('@/components/accounting/InvoiceList', () => ({ InvoiceList: ({ onPay }: { onPay: (invoice: typeof mocks.invoice) => void }) =>
  <button onClick={() => onPay(mocks.invoice)}>Pay invoice</button> }));
vi.mock('@/components/invoices/PaymentDialog', () => ({ PaymentDialog: ({ isOpen, onPaymentComplete }: {
  isOpen: boolean; onPaymentComplete: (payload: InvoicePaymentCompletePayload) => Promise<void>;
}) => isOpen ? <div role="dialog" aria-label="Payment dialog">
  {['stripe', 'cash'].map(method => <button key={method} onClick={() => {
    const promise = onPaymentComplete({ invoiceId: 'invoice-1', paymentMethod: method, amount: 25,
      paymentDate: '2026-10-23', paymentDetails: { notes: 'Manual test receipt' } });
    mocks.completion(promise);
    void promise.catch(() => undefined);
  }}>Complete {method}</button>)}
</div> : null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.markPaid.mockReset();
  mocks.refresh.mockReset();
  mocks.query.data = { data: [mocks.invoice], total: 1 };
  mocks.markPaid.mockResolvedValue({ ...mocks.invoice, amountPaid: 25, balance: 75 });
});
afterEach(() => cleanup());

async function openPayment() {
  await act(async () => { render(<MemoryRouter><AccountingPage /></MemoryRouter>); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pay invoice' })); });
  expect(await screen.findByRole('dialog', { name: 'Payment dialog' })).toBeInTheDocument();
}

describe('Accounting payment completion', () => {
  it('refreshes an already confirmed Stripe payment without posting a second invoice payment', async () => {
    await openPayment();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Complete stripe' })); });
    await expect(mocks.completion.mock.calls[0][0]).resolves.toBeUndefined();
    expect(mocks.markPaid).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Payment dialog' })).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Failed' }));
  });

  it('does not issue a manual-payment request or a Payment Failed notice if post-Stripe refresh throws', async () => {
    mocks.refresh.mockImplementation(() => { throw new Error('refresh unavailable'); });
    await openPayment();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Complete stripe' })); });
    await expect(mocks.completion.mock.calls[0][0]).rejects.toThrow('refresh unavailable');
    expect(mocks.markPaid).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Failed' }));
    expect(screen.queryByRole('dialog', { name: 'Payment dialog' })).not.toBeInTheDocument();
  });

  it('preserves the manual-payment amount, details, date and stable operation key', async () => {
    await openPayment();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Complete cash' })); });
    expect(mocks.markPaid).toHaveBeenCalledWith('invoice-1', {
      amount_paid: 25, paid_at: '2026-10-23', payment_method: 'cash',
      payment_details: { notes: 'Manual test receipt' }, operation_key: expect.any(String),
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Payment dialog' })).not.toBeInTheDocument();
  });

  it('keeps a genuinely failed manual payment visible and propagates its failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.markPaid.mockRejectedValue(new Error('Manual payment was rejected'));
    try {
      await openPayment();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Complete cash' })); });
      await expect(mocks.completion.mock.calls[0][0]).rejects.toThrow('Manual payment was rejected');
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Failed', description: 'Manual payment was rejected' }));
      expect(mocks.refresh).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Payment dialog' })).toBeInTheDocument();
    } finally { consoleError.mockRestore(); }
  });
});
