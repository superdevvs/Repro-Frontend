import { describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { resolveInvoicePricingDisplay } from '@/utils/invoicePricingSummary';
import { writeInvoicePdfSummary } from './invoicePdfSummary';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const pricing = resolveInvoicePricingDisplay({
  subtotal: 279, tax: 14.79, total: 293.79,
  pricing_breakdown: { subtotal_before_discount: 310, discount_amount: 31 },
});

describe('invoice PDF summary layout', () => {
  it.each([60, 210])('keeps the discount, payment details and total above the footer from y=%s', (y) => {
    const doc = new jsPDF();
    const text = vi.spyOn(doc, 'text');
    writeInvoicePdfSummary(doc, {
      y, margin: 20, pricingRows: pricing.rows, total: pricing.total,
      itemAmountNote: 'Item amounts already include their shoot discounts.',
      isPaid: true, isComplimentaryReceipt: false, paidAmount: 300, overpaymentAmount: 6.21,
      paymentMethodLabel: 'Credit card', paymentBreakdown: 'Credit card $250.00 + Cash $50.00',
      paidAtLabel: '09/08/2026 10:00 AM', formatCurrency,
    });
    expect(doc.getNumberOfPages()).toBe(y === 60 ? 1 : 2);
    const calls = text.mock.calls;
    const labelIndex = calls.findIndex(([value]) => value === 'DISCOUNT:');
    expect(calls[labelIndex + 1][0]).toBe('-$31.00');
    expect(calls.find(([value]) => value === 'SUBTOTAL BEFORE DISCOUNT:')).toBeDefined();
    expect(calls.find(([value]) => value === '$293.79')).toBeDefined();
    expect(calls.find(([value]) => value === 'REFUND/CREDIT DUE:')).toBeDefined();
    expect(Math.max(...calls.map((call) => Number(call[2])))).toBeLessThan(doc.internal.pageSize.getHeight() - 45);
    const labelCall = calls[labelIndex];
    const valueCall = calls[labelIndex + 1];
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    expect(Number(labelCall[1]) + doc.getTextWidth('SUBTOTAL BEFORE DISCOUNT:')).toBeLessThan(Number(valueCall[1]) - doc.getTextWidth('$310.00'));
  });
});
