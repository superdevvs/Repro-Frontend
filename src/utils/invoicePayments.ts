import type { InvoiceData } from '@/types/invoice';

export const invoicePaidAmount = (invoice: InvoiceData): number => {
  const value = invoice.amountPaid ?? (invoice.status === 'paid' ? invoice.amount : 0);
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
};

export const invoiceLastPaymentDate = (invoice: InvoiceData): string | undefined => {
  const details = invoice.paymentDetails as Record<string, unknown> | undefined;
  const date = invoice.paidAt || details?.last_payment_at;
  return typeof date === 'string' && date ? date : undefined;
};
