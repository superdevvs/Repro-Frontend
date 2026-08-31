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
});
