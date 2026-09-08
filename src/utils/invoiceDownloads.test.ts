import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BRAND_EMAIL, BRAND_NAME, BRAND_PHONE } from '@/config/brand';
import type { InvoiceData } from '@/types/invoice';
import { downloadInvoicePdf, downloadInvoicesPdf, generateInvoicesPdf } from './invoiceDownloads';

const pdfMocks = vi.hoisted(() => ({
  addPage: vi.fn(),
  save: vi.fn(),
  text: vi.fn(),
}));

vi.mock('jspdf', () => {
  class MockJsPdf {
    private pageCount = 1;

    internal = {
      pageSize: {
        getWidth: () => 612,
        getHeight: () => 792,
      },
    };

    addPage() {
      this.pageCount += 1;
      pdfMocks.addPage();
      return this;
    }

    getNumberOfPages() {
      return this.pageCount;
    }

    save(fileName: string) {
      pdfMocks.save(fileName);
    }

    text(...args: unknown[]) {
      pdfMocks.text(...args);
      return this;
    }

    splitTextToSize(value: unknown) {
      return [String(value)];
    }

    setPage() { return this; }
    setTextColor() { return this; }
    setFont() { return this; }
    setFontSize() { return this; }
    setDrawColor() { return this; }
    setFillColor() { return this; }
    line() { return this; }
    rect() { return this; }
  }

  return { jsPDF: MockJsPdf };
});

const invoice = (overrides: Partial<InvoiceData> = {}): InvoiceData => ({
  id: '42',
  number: 'Invoice 00042',
  client: 'Ada Client',
  property: '42 Example Avenue',
  date: '2026-08-31',
  dueDate: '2026-09-15',
  amount: 150,
  subtotal: 140,
  tax: 10,
  amountPaid: 25,
  balance: 125,
  status: 'pending',
  services: ['Photography'],
  items: [{ description: 'Photography', quantity: 1, unit_amount: 140, total_amount: 140 }],
  paymentMethod: 'N/A',
  ...overrides,
});

const discountedInvoice = () => ({
  ...invoice({
    number: 'SYNTHETIC-115',
    client: 'Example Client',
    subtotal: 279,
    tax: 14.79,
    total: 293.79,
    amount: 293.79,
    amountPaid: 0,
    balance: 293.79,
    items: [{ description: 'Photography service', type: 'charge', quantity: 1, unit_amount: 310, total_amount: 310 }],
  }),
  pricing_breakdown: {
    subtotal_before_discount: 310,
    discount_amount: 31,
    pricing_adjustment_amount: 0,
    subtotal: 279,
    tax: 14.79,
    total: 293.79,
  },
});

const summaryAmount = (label: string): unknown => {
  const callIndex = pdfMocks.text.mock.calls.findIndex(([text]) => text === label);
  return callIndex < 0 ? undefined : pdfMocks.text.mock.calls[callIndex + 1]?.[0];
};

describe('invoice PDF downloads', () => {
  beforeEach(() => {
    pdfMocks.addPage.mockClear();
    pdfMocks.save.mockClear();
    pdfMocks.text.mockClear();
  });

  it('builds one branded document containing multiple invoices', async () => {
    await generateInvoicesPdf([
      invoice(),
      invoice({ id: '43', number: 'Invoice 00043', client: 'Grace Client' }),
    ]);

    expect(pdfMocks.addPage).toHaveBeenCalledTimes(1);
    const renderedText = pdfMocks.text.mock.calls.flat().map(String);
    expect(renderedText).toContain(BRAND_NAME);
    expect(renderedText).toContain(`Email: ${BRAND_EMAIL}`);
    expect(renderedText).toContain(`Phone: ${BRAND_PHONE}`);
    expect(renderedText).toContain('Ada Client');
    expect(renderedText).toContain('Grace Client');
    expect(renderedText).toContain('Photography');
  });

  it('saves a batch as one PDF and sanitizes a single invoice filename', async () => {
    await expect(downloadInvoicesPdf([invoice(), invoice({ id: '43' })], {
      fileName: 'August invoice batch.pdf',
    })).resolves.toBe('August-invoice-batch.pdf');
    expect(pdfMocks.save).toHaveBeenLastCalledWith('August-invoice-batch.pdf');

    await expect(downloadInvoicePdf(invoice({ number: 'Invoice / 00042' })))
      .resolves.toBe('invoice-Invoice-00042.pdf');
    expect(pdfMocks.save).toHaveBeenLastCalledWith('invoice-Invoice-00042.pdf');
  });

  it('rejects an empty batch instead of producing a blank PDF', async () => {
    await expect(generateInvoicesPdf([])).rejects.toThrow('Select at least one invoice');
  });

  it('labels photographer and sales-rep records as payout invoices', async () => {
    await generateInvoicesPdf([
      invoice({
        role: 'photographer',
        payee: { name: 'Pat Photographer', email: 'pat@example.test' },
        client: 'Wrong Client Label',
      }),
    ]);

    const renderedText = pdfMocks.text.mock.calls.flat().map(String);
    expect(renderedText).toContain('PAYOUT INVOICE');
    expect(renderedText).toContain('PAY TO');
    expect(renderedText).toContain('Pat Photographer');
    expect(renderedText).not.toContain('Wrong Client Label');
  });

  it('itemizes the saved shoot discount in an Accounting PDF without changing the payable total', async () => {
    await generateInvoicesPdf([discountedInvoice()]);

    expect(summaryAmount('Subtotal before discount')).toBe('$310.00');
    expect(summaryAmount('Discount')).toBe('-$31.00');
    expect(summaryAmount('Subtotal after discount')).toBe('$279.00');
    expect(summaryAmount('Tax')).toBe('$14.79');
    expect(summaryAmount('Total')).toBe('$293.79');
    expect(summaryAmount('Balance')).toBe('$293.79');
  });

  it('uses the mapped pricing breakdown in a bulk Accounting download', async () => {
    const { pricing_breakdown, ...source } = discountedInvoice();
    await downloadInvoicesPdf([invoice(), { ...source, pricingBreakdown: pricing_breakdown }]);

    expect(summaryAmount('Discount')).toBe('-$31.00');
    expect(pdfMocks.save).toHaveBeenCalledOnce();
    expect(pdfMocks.addPage).toHaveBeenCalledTimes(1);
  });

  it('preserves explicit signed credit lines without deducting them again from saved totals', async () => {
    const source = discountedInvoice();
    await generateInvoicesPdf([{
      ...source,
      items: [...source.items!, {
        description: 'Previously itemized discount', type: 'charge', quantity: 1, unit_amount: -31, total_amount: -31,
      }],
      pricing_breakdown: { ...source.pricing_breakdown, subtotal_before_discount: 279, discount_amount: 0 },
    }]);

    expect(pdfMocks.text.mock.calls.map(([text]) => text)).toContainEqual(['Previously itemized discount']);
    expect(pdfMocks.text.mock.calls.map(([text]) => text)).not.toContain('Discount');
    expect(summaryAmount('Subtotal')).toBe('$279.00');
    expect(summaryAmount('Total')).toBe('$293.79');
    expect(summaryAmount('Balance')).toBe('$293.79');
  });

  it('labels an unclassified saved reduction as a pricing adjustment', async () => {
    const source = discountedInvoice();
    await generateInvoicesPdf([{
      ...source,
      pricing_breakdown: { ...source.pricing_breakdown, discount_amount: 0, pricing_adjustment_amount: -31 },
    }]);

    expect(summaryAmount('Pricing adjustment')).toBe('-$31.00');
    expect(pdfMocks.text.mock.calls.map(([text]) => text)).not.toContain('Discount');
    expect(summaryAmount('Total')).toBe('$293.79');
  });

  it.each([
    ['net', 'Item amounts already include their shoot discounts.'],
    ['mixed', 'Some item amounts already include shoot discounts.'],
  ])('explains %s period line amounts before the saved discount summary', async (basis, note) => {
    const source = discountedInvoice();
    await generateInvoicesPdf([{
      ...source,
      items: [{ description: 'Shoot services', quantity: 1, unit_amount: 279, total_amount: 279 }],
      pricing_breakdown: { ...source.pricing_breakdown, line_amount_basis: basis },
    }]);

    const noteCall = pdfMocks.text.mock.calls.find(([text]) => Array.isArray(text) && text.includes(note));
    const summaryCall = pdfMocks.text.mock.calls.find(([text]) => text === 'Subtotal before discount');
    expect(noteCall).toBeDefined();
    expect(Number(summaryCall?.[2]) - Number(noteCall?.[2])).toBeGreaterThanOrEqual(19);
    expect(summaryAmount('Discount')).toBe('-$31.00');
    expect(summaryAmount('Total')).toBe('$293.79');
  });

  it('moves an expanded discount summary to the next page when it would reach the footer', async () => {
    const source = discountedInvoice();
    await generateInvoicesPdf([{
      ...source,
      items: Array.from({ length: 19 }, (_, index) => ({
        description: `Service ${index + 1}`, quantity: 1, unit_amount: 310 / 19, total_amount: 310 / 19,
      })),
    }]);

    expect(pdfMocks.addPage).toHaveBeenCalledTimes(1);
    expect(summaryAmount('Discount')).toBe('-$31.00');
    const balanceCall = pdfMocks.text.mock.calls.find(([text]) => text === 'Balance');
    expect(balanceCall?.[2]).toBeLessThan(728);
  });
});
