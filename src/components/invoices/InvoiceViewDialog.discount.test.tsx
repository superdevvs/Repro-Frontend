import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InvoiceViewDialog } from './InvoiceViewDialog';
import type { InvoiceViewDialogInvoice } from '@/types/invoice';

const mocks = vi.hoisted(() => ({ text: vi.fn(), save: vi.fn(), addPage: vi.fn() }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ can: () => false }) }));
vi.mock('@/components/layout/Logo', () => ({ Logo: () => <span>Company logo</span> }));
vi.mock('jspdf', () => ({ jsPDF: class {
  internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
  text = mocks.text; save = mocks.save; addPage = mocks.addPage;
  setFont() {} setFontSize() {} setTextColor() {} setFillColor() {} setDrawColor() {} setLineWidth() {} rect() {} line() {} addImage() {}
  splitTextToSize(value: string) { return [value]; }
} }));

const invoice: InvoiceViewDialogInvoice = {
  id: 42, number: 'INV-42', client: 'Example Client', status: 'pending',
  subtotal: 80, tax: 4.8, total: 84.8,
  pricing_breakdown: { discount_amount: 30, subtotal_before_discount: 110 },
  items: [
    { id: 1, description: 'Photography', quantity: 1, unit_amount: 120, total_amount: 120 },
    { id: 2, description: 'Manual invoice credit', quantity: 1, unit_amount: -10, total_amount: -10, type: 'expense', meta: { source: 'admin_misc', bills_client: true } },
  ],
};

describe('invoice discount display', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No logo in test'))); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('shows the saved 10% discount on the reported invoice', () => {
    render(<InvoiceViewDialog isOpen onClose={vi.fn()} invoice={{
      ...invoice, subtotal: 279, tax: 14.79, total: 293.79,
      pricing_breakdown: { discount_amount: 31, subtotal_before_discount: 310 },
      items: [{ description: 'Full shoot', quantity: 1, unit_amount: 310, total_amount: 310 }],
    }} />);
    expect(screen.getByText('Discount:').parentElement).toHaveTextContent('-$31.00');
    expect(screen.getByText('Subtotal before discount:').parentElement).toHaveTextContent('$310.00');
    expect(screen.getByText('Subtotal after discount:').parentElement).toHaveTextContent('$279.00');
    expect(screen.getByText('Total Due:').parentElement).toHaveTextContent('$293.79');
  });

  it('shows the saved shoot discount without subtracting the manual credit or discount twice', () => {
    render(<InvoiceViewDialog isOpen onClose={vi.fn()} invoice={invoice} />);
    expect(screen.getByText('Discount:').parentElement).toHaveTextContent('-$30.00');
    expect(screen.getByText('Subtotal before discount:').parentElement).toHaveTextContent('$110.00');
    expect(screen.getByText('Subtotal after discount:').parentElement).toHaveTextContent('$80.00');
    expect(screen.getByText('Total Due:').parentElement).toHaveTextContent('$84.80');
    expect(screen.getByText('Manual invoice credit')).toBeInTheDocument();
  });

  it('includes the same discount breakdown and authoritative total in the downloaded PDF', async () => {
    render(<InvoiceViewDialog isOpen onClose={vi.fn()} invoice={invoice} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download as PDF' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('INV-42.pdf'));
    const text = mocks.text.mock.calls.map(([value]) => value);
    expect(text).toContain('DISCOUNT:');
    expect(text).toContain('-$30.00');
    expect(text).toContain('SUBTOTAL BEFORE DISCOUNT:');
    expect(text).toContain('$110.00');
    expect(text).toContain('SUBTOTAL AFTER DISCOUNT:');
    expect(text).toContain('$80.00');
    expect(text).toContain('$84.80');
    expect(text).not.toContain('$54.80');
  });

  it.each(['pricingBreakdown', 'pricing_breakdown'] as const)('exports the reported invoice using %s', async (key) => {
    render(<InvoiceViewDialog isOpen onClose={vi.fn()} invoice={{
      ...invoice, pricing_breakdown: undefined, subtotal: 279, tax: 14.79, total: 293.79,
      [key]: { discount_amount: 31, subtotal_before_discount: 310 },
      items: [{ description: 'Full shoot', quantity: 1, unit_amount: 310, total_amount: 310 }],
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download as PDF' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('INV-42.pdf'));
    const text = mocks.text.mock.calls.map(([value]) => value);
    expect(text.filter((value) => value === 'DISCOUNT:')).toHaveLength(1);
    expect(text).toContain('-$31.00');
    expect(text).toContain('$279.00');
    expect(text).toContain('$293.79');
    expect(text).not.toContain('$262.79');
  });

  it.each([-31, 25])('displays a saved pricing adjustment of %s with its original sign in the view and PDF', async (adjustment) => {
    const formatAmount = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    render(<InvoiceViewDialog isOpen onClose={vi.fn()} invoice={{
      ...invoice, subtotal: 310 + adjustment, tax: 0, total: 310 + adjustment,
      pricing_breakdown: { discount_amount: 0, subtotal_before_discount: 310, pricing_adjustment_amount: adjustment },
      items: [{ description: 'Full shoot', quantity: 1, unit_amount: 310, total_amount: 310 }],
    }} />);
    expect(screen.queryByText('Discount:')).not.toBeInTheDocument();
    expect(screen.getByText('Pricing adjustment:').parentElement).toHaveTextContent(formatAmount(adjustment));
    expect(screen.getByText('Subtotal before adjustments:').parentElement).toHaveTextContent('$310.00');
    expect(screen.getByText('Total Due:').parentElement).toHaveTextContent(formatAmount(310 + adjustment));
    fireEvent.click(screen.getByRole('button', { name: 'Download as PDF' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    const text = mocks.text.mock.calls.map(([value]) => value);
    expect(text).toContain('PRICING ADJUSTMENT:');
    expect(text).toContain(formatAmount(adjustment));
    expect(text).toContain(formatAmount(310 + adjustment));
    expect(text).not.toContain('DISCOUNT:');
  });

  it.each([
    ['net', 'Item amounts already include their shoot discounts.'],
    ['mixed', 'Some item amounts already include shoot discounts.'],
  ] as const)('clarifies %s item amounts in both the dialog and PDF', async (basis, note) => {
    render(<InvoiceViewDialog isOpen onClose={vi.fn()} invoice={{
      ...invoice, subtotal: 279, tax: 14.79, total: 293.79,
      pricing_breakdown: { discount_amount: 31, subtotal_before_discount: 310, line_amount_basis: basis },
      items: [{ description: 'Full shoot (discounted)', quantity: 1, unit_amount: 279, total_amount: 279 }],
    }} />);
    expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.getByText('Total Due:').parentElement).toHaveTextContent('$293.79');
    fireEvent.click(screen.getByRole('button', { name: 'Download as PDF' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.text.mock.calls.flatMap(([value]) => value)).toContain(note);
  });
});
