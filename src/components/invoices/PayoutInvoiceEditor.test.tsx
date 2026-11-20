import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import type { WeeklyInvoice } from '@/services/invoiceService';

const editorInvoice = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/services/payoutInvoiceEditorService', () => ({
  fetchPayoutEditor: vi.fn(async () => ({ invoice: editorInvoice.current })),
  removePayoutInvoiceItem: vi.fn(),
  savePayoutInvoiceItem: vi.fn(),
}));
vi.mock('@/services/invoiceService', () => ({ approveWeeklyInvoice: vi.fn(), submitWeeklyInvoiceForApproval: vi.fn() }));

import { PayoutInvoiceEditor } from './PayoutInvoiceEditor';

afterEach(cleanup);

// W-5950: the photographer saved a line correction, but never submitted it.
const savedButNotSubmitted = {
  id: 5950, role: 'photographer', approval_status: 'pending', status: 'draft', can_edit: true,
  billing_period_start: '2026-11-08', billing_period_end: '2026-11-14', total_amount: 448.55, amount_paid: 0, is_paid: false, paid_at: null,
  items: [], unresolved_warnings: [{ code: 'payout_basis_changed', message: '200 York Street: The booked service / payout basis changed. Verify the agreed package before approval.' }],
  payout_review: { revision: 1, has_changes: true, label: 'Awaiting photographer', changes: [{ summary: 'Payee update on payout invoice.' }] },
} as unknown as WeeklyInvoice;

const renderEditor = (role: 'photographer' | 'admin') => {
  editorInvoice.current = savedButNotSubmitted;
  render(<PayoutInvoiceEditor open invoice={savedButNotSubmitted} role={role} onClose={() => {}} onInvoiceChange={() => {}} onComplete={() => {}} />);
};

it('tells the payee that saved changes have not reached accounts and why Submit is disabled', async () => {
  renderEditor('photographer');
  const submit = await screen.findByRole('button', { name: 'Submit changes' });
  expect(submit).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Not submitted yet');
  expect(screen.getByRole('status')).toHaveTextContent('Write an explanation of your changes above to enable Submit changes');
  expect(screen.queryByText('Accounts verification required')).not.toBeInTheDocument();
  expect(screen.getByText('Accounts will check this after you submit')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Explanation of changes (required)'), { target: { value: 'Travel was 60 miles each way; agreed $35.' } });
  await waitFor(() => expect(submit).toBeEnabled());
  expect(screen.getByRole('status')).toHaveTextContent('Press Submit changes to send them to accounts');
});

it('keeps the accounts wording for accounts reviewers', async () => {
  renderEditor('admin');
  expect(await screen.findByRole('button', { name: 'Approve amount' })).toBeEnabled();
  expect(screen.getByText('Accounts verification required')).toBeInTheDocument();
  expect(screen.queryByText(/Not submitted yet/)).not.toBeInTheDocument();
});
