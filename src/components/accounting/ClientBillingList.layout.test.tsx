import * as React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { ClientBillingList } from './ClientBillingList';
import type { ClientBillingItem } from '@/types/clientBilling';
import { exportRowsAsCsv } from '@/utils/accountingExports';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/utils/accountingExports', () => ({ exportRowsAsCsv: vi.fn(), exportRowsAsExcel: vi.fn(), exportRowsAsPdf: vi.fn() }));
vi.mock('@/components/ui/date-range-picker', () => ({ DateRangePicker: ({ onChange }: { onChange: (value: { startDate: string; endDate: string }) => void }) => <button onClick={() => onChange({ startDate: '2026-09-02', endDate: '2026-09-03' })}>Choose test range</button> }));

const makeItem = (index: number, extra: Partial<ClientBillingItem> = {}): ClientBillingItem => ({
  id: `invoice-${index}`, invoiceId: index, source: 'invoice', sourceLabel: 'Invoice', number: `INV-${index}`,
  property: `Property ${index}`, issueDate: `2026-09-${String(index).padStart(2, '0')}`,
  amount: 150, amountPaid: 50, balance: 100, status: 'pending', bucket: 'due_now', paymentRequiredToRelease: false, ...extra,
});
beforeEach(() => vi.clearAllMocks());

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.scrollIntoView) proto.scrollIntoView = vi.fn();
  if (!proto.hasPointerCapture) proto.hasPointerCapture = vi.fn(() => false);
  if (!proto.setPointerCapture) proto.setPointerCapture = vi.fn();
  if (!proto.releasePointerCapture) proto.releasePointerCapture = vi.fn();
});

afterEach(() => cleanup());

describe('ClientBillingList controls layout', () => {
  it('groups filters and exports together and keeps the empty pagination controls accurate', () => {
    render(<ClientBillingList items={[]} onView={vi.fn()} />);

    const toolbar = screen.getByRole('group', { name: 'Billing controls' });
    expect(toolbar).toContainElement(screen.getByRole('tablist'));
    expect(toolbar).toContainElement(screen.getByRole('combobox', { name: 'Filter billing items by date' }));
    expect(within(toolbar).getByRole('button', { name: 'Export billing items' })).toBeDisabled();
    expect(screen.getByText('0 billing items')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous billing page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next billing page' })).toBeDisabled();
  });

  it('renders a complimentary receipt as no payment required rather than paid', () => {
    const item: ClientBillingItem = {
      id: 'invoice-44',
      source: 'invoice',
      sourceLabel: 'Invoice',
      documentType: 'complimentary_receipt',
      paymentRequired: false,
      property: '10 Main Street',
      amount: 0,
      amountPaid: 0,
      balance: 0,
      status: 'no_payment_required',
      bucket: 'no_payment_required',
      paymentRequiredToRelease: false,
    };

    render(<ClientBillingList items={[item]} onView={vi.fn()} onPay={vi.fn()} />);

    expect(screen.getByText('Complimentary receipt')).toBeInTheDocument();
    expect(screen.getAllByText('No payment required').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Pay / })).not.toBeInTheDocument();
  });

  it('keeps selections across pages and exports selected records across all pages', async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 12 }, (_, i) => makeItem(i + 1));
    const onDownloadMultiple = vi.fn();
    render(<ClientBillingList items={items} onView={vi.fn()} onDownloadMultiple={onDownloadMultiple} />);
    expect(screen.getByText('1–5 of 12 billing items')).toBeInTheDocument();
    expect(screen.queryByText('#INV-6')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select invoice INV-1' }));
    await user.click(screen.getByRole('button', { name: 'Next billing page' }));
    expect(screen.getByText('6–10 of 12 billing items')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select invoice INV-6' }));
    await user.click(screen.getByRole('button', { name: 'Selected billing statements' }));
    expect(onDownloadMultiple).toHaveBeenCalledWith([items[0], items[5]]);
    await user.click(screen.getByRole('button', { name: 'Export billing items' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export CSV' }));
    expect(vi.mocked(exportRowsAsCsv).mock.calls[0][2].map((row) => row.reference)).toEqual(['INV-1', 'INV-6']);
    await user.click(screen.getByRole('button', { name: 'Previous billing page' }));
    expect(screen.getByRole('checkbox', { name: 'Select invoice INV-1' })).toBeChecked();
  });

  it('exports all filtered records rather than just the current page and resets pagination on filters', async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 7 }, (_, i) => makeItem(i + 1, i === 6 ? { bucket: 'paid', status: 'paid', balance: 0 } : {}));
    render(<ClientBillingList items={items} onView={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Export billing items' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export CSV' }));
    expect(vi.mocked(exportRowsAsCsv).mock.calls[0][2]).toHaveLength(7);
    await user.click(screen.getByRole('checkbox', { name: 'Select invoice INV-1' }));
    await user.click(screen.getByRole('button', { name: 'Next billing page' }));
    await user.click(screen.getByRole('tab', { name: /^Paid$/ }));
    expect(screen.getByText('1–1 of 1 billing items')).toBeInTheDocument();
    expect(screen.queryByText(/selected across all pages/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'All billing' }));
    expect(screen.getByRole('checkbox', { name: 'Select invoice INV-1' })).not.toBeChecked();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Billing items per page' }), '10');
    expect(screen.getByText('1–7 of 7 billing items')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next billing page' })).toBeDisabled();
  });

  it('filters by inclusive issue dates with due-date fallback and supports the same actions in cards', async () => {
    const user = userEvent.setup();
    const items = [makeItem(1), makeItem(2), makeItem(3, { issueDate: null, dueDate: '2026-09-03' }), makeItem(4)];
    const onView = vi.fn();
    const onPay = vi.fn();
    render(<ClientBillingList items={items} onView={onView} onPay={onPay} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter billing items by date' }), 'custom');
    await user.click(screen.getByRole('button', { name: 'Choose test range' }));
    expect(screen.getByText('1–2 of 2 billing items')).toBeInTheDocument();
    expect(screen.queryByText('#INV-1')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cards view' }));
    expect(screen.getByText('#INV-3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View invoice INV-3' }));
    expect(onView).toHaveBeenCalledWith(items[2]);
    await user.click(screen.getAllByRole('button', { name: 'Pay $100.00' })[0]);
    expect(onPay).toHaveBeenCalledWith(items[1]);
    await user.click(screen.getByRole('checkbox', { name: 'Select all filtered billing items' }));
    expect(screen.getByText('2 selected across all pages')).toBeInTheDocument();
  });

  it('preserves PDF downloads for shoot balances and permits CSV detail only for invoices', async () => {
    const user = userEvent.setup();
    const item = makeItem(1, { source: 'shoot_balance', sourceLabel: 'Shoot balance', invoiceId: null });
    const onDownload = vi.fn();
    render(<ClientBillingList items={[item]} onView={vi.fn()} onDownload={onDownload} />);
    await user.click(screen.getByRole('button', { name: 'Download invoice INV-1' }));
    expect(screen.getByRole('menuitem', { name: 'CSV detail' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('menuitem', { name: 'PDF statement' }));
    expect(onDownload).toHaveBeenCalledWith(item, 'pdf');
  });

  it('only offers payment for permitted outstanding balances and clamps after records disappear', async () => {
    const user = userEvent.setup();
    const items = [makeItem(1), makeItem(2, { paymentRequired: false }), makeItem(3, { bucket: 'paid', status: 'paid' }), makeItem(4, { balance: 0.01 }), makeItem(5), makeItem(6)];
    const { rerender } = render(<ClientBillingList items={items} onView={vi.fn()} onPay={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: 'Pay $100.00' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Next billing page' }));
    rerender(<ClientBillingList items={items.slice(0, 2)} onView={vi.fn()} onPay={vi.fn()} />);
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByText('#INV-1')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Billing items per page' }), { target: { value: '20' } });
    expect(screen.getByText('1–2 of 2 billing items')).toBeInTheDocument();
  });

  it('distinguishes due-now and upcoming buckets even when both payment statuses are pending', async () => {
    const user = userEvent.setup();
    render(<ClientBillingList items={[makeItem(1), makeItem(2, { bucket: 'upcoming' })]} onView={vi.fn()} />);
    const dueRow = screen.getByText('#INV-1').closest('tr')!;
    const upcomingRow = screen.getByText('#INV-2').closest('tr')!;
    expect(within(dueRow).getByText('Due now')).toBeInTheDocument();
    expect(within(upcomingRow).getByText('Upcoming')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cards view' }));
    expect(within(screen.getByText('#INV-1').closest('article')!).getByText('Due now')).toBeInTheDocument();
    expect(within(screen.getByText('#INV-2').closest('article')!).getByText('Upcoming')).toBeInTheDocument();
  });
});
