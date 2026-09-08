import type { jsPDF } from 'jspdf';
import type { InvoicePricingSummaryRow } from '@/utils/invoicePricingSummary';

interface InvoicePdfSummaryOptions {
  y: number;
  margin: number;
  pricingRows: InvoicePricingSummaryRow[];
  itemAmountNote?: string | null;
  total: number;
  isPaid: boolean;
  isComplimentaryReceipt: boolean;
  paidAmount: number;
  overpaymentAmount: number;
  paymentMethodLabel: string;
  paymentBreakdown: string;
  paidAtLabel: string | null;
  formatCurrency: (amount: number) => string;
}

/** Keep the pricing and payment summary together above the final-page footer. */
export const writeInvoicePdfSummary = (doc: jsPDF, options: InvoicePdfSummaryOptions) => {
  const { margin, total, isPaid, isComplimentaryReceipt, paidAmount, overpaymentAmount, formatCurrency } = options;
  const valueX = doc.internal.pageSize.getWidth() - margin;
  const labelX = valueX - 78;
  const detailX = labelX + 34;
  const details: Array<{ label: string; lines: string[] }> = [];
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const addDetail = (label: string, value: string) => {
    details.push({ label, lines: doc.splitTextToSize(value, valueX - detailX) as string[] });
  };
  if (isPaid && options.paymentMethodLabel !== 'N/A') addDetail('METHOD:', options.paymentMethodLabel);
  if (isPaid && options.paymentBreakdown) addDetail('SPLIT:', options.paymentBreakdown);
  if (isPaid && options.paidAtLabel) addDetail('PAID ON:', options.paidAtLabel);
  const paymentRows = Number(isPaid && paidAmount > 0) + Number(overpaymentAmount > 0);
  const noteLines = options.itemAmountNote
    ? doc.splitTextToSize(options.itemAmountNote, valueX - margin) as string[] : [];
  const noteHeight = noteLines.length > 0 ? noteLines.length * 4 + 6 : 0;
  const summaryHeight = (options.pricingRows.length + paymentRows) * 8
    + details.reduce((height, row) => height + Math.max(8, row.lines.length * 5 + 3), 0) + noteHeight + 31;
  let y = options.y;
  if (y + summaryHeight > doc.internal.pageSize.getHeight() - 45) {
    doc.addPage();
    y = margin + 10;
  }
  if (noteLines.length > 0) {
    doc.setTextColor(60, 60, 60);
    doc.text(noteLines, margin, y);
    doc.setTextColor(0, 0, 0);
    y += noteHeight;
  }

  const writeCurrency = (label: string, value: string, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...color);
    doc.text(label, labelX, y);
    doc.text(value, valueX, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 8;
  };
  options.pricingRows.forEach((row) => writeCurrency(row.label.toUpperCase(), formatCurrency(row.amount)));
  if (isPaid && paidAmount > 0) writeCurrency('PRIOR PAYMENT:', `-${formatCurrency(paidAmount)}`, [0, 128, 0]);
  if (overpaymentAmount > 0) writeCurrency('REFUND/CREDIT DUE:', formatCurrency(overpaymentAmount), [180, 83, 9]);
  details.forEach(({ label, lines }) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(label, labelX, y);
    doc.setTextColor(0, 0, 0);
    doc.text(lines, detailX, y);
    y += Math.max(8, lines.length * 5 + 3);
  });

  doc.setDrawColor(180, 180, 180);
  doc.line(labelX, y - 1, valueX, y - 1);
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL:', labelX, y);
  doc.text(formatCurrency(total), valueX, y, { align: 'right' });
  y += 12;
  doc.text(isComplimentaryReceipt ? 'COMPLIMENTARY RECEIPT' : isPaid ? 'TOTAL PAYMENT' : 'TOTAL DUE', margin, y);
  doc.setFontSize(24);
  doc.setTextColor(isPaid ? 0 : 30, isPaid ? 128 : 64, isPaid ? 0 : 175);
  doc.text(formatCurrency(isComplimentaryReceipt ? 0 : isPaid ? paidAmount : total), margin, y + 12);
  doc.setTextColor(0, 0, 0);
};
