import {
  BRAND_ADDRESS_LINES,
  BRAND_EMAIL,
  BRAND_NAME,
  BRAND_PHONE,
} from '@/config/brand';
import type {
  InvoiceItem,
  InvoiceParty,
  InvoiceShootRef,
} from '@/types/invoice';

type JsPdfDocument = import('jspdf').jsPDF;

/** Any normalized or API invoice-shaped object accepted by the PDF renderer. */
export type DownloadableInvoice = object;

export interface InvoicePdfDownloadOptions {
  fileName?: string;
}

type NormalizedInvoiceLine = {
  description: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
};

type NormalizedInvoice = {
  number: string;
  isPayout: boolean;
  clientName: string;
  clientEmail: string;
  property: string;
  issueDate: string;
  dueDate: string;
  status: string;
  lines: NormalizedInvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  balance: number;
  notes: string;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const toText = (value: unknown): string => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim();
};

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return '';
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toMoney = (value: unknown, fallback = 0): number => {
  const parsed = toOptionalNumber(value);
  return parsed === undefined ? fallback : parsed;
};

const formatCurrency = (value: unknown): string => currencyFormatter.format(toMoney(value));

const parseDate = (value: unknown): Date | null => {
  const text = toText(value);
  if (!text) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(text);
  const parsed = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(text);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value: unknown): string => {
  const parsed = parseDate(value);
  return parsed ? dateFormatter.format(parsed) : 'Not available';
};

const partyName = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  const party = toRecord(value) as InvoiceParty;
  return firstText(party.name, party.company, party.company_name);
};

const partyEmail = (value: unknown): string => {
  const party = toRecord(value) as InvoiceParty;
  return firstText(party.email);
};

const shootAddress = (value: unknown): string => {
  const shoot = toRecord(value) as InvoiceShootRef;
  const location = toRecord(shoot.location);
  const fullAddress = firstText(location.fullAddress, location.full);
  if (fullAddress) return fullAddress;

  const address = firstText(location.address, shoot.address);
  const city = firstText(location.city, shoot.city);
  const state = firstText(location.state, shoot.state);
  const zip = firstText(location.zip, shoot.zip);
  return [address, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
};

const normalizeItem = (value: unknown): NormalizedInvoiceLine | null => {
  const item = toRecord(value) as InvoiceItem & Record<string, unknown>;
  const meta = toRecord(item.meta);
  const description = firstText(
    item.description,
    meta.extra_description,
    meta.service_name,
    item.type,
  );
  if (!description) return null;

  const quantity = Math.max(1, toMoney(item.quantity, 1));
  const unitAmount = toOptionalNumber(item.unit_amount ?? item.unitAmount);
  const totalAmount = toOptionalNumber(item.total_amount ?? item.totalAmount);
  const resolvedTotal = totalAmount ?? ((unitAmount ?? 0) * quantity);
  const resolvedUnit = unitAmount ?? (quantity > 0 ? resolvedTotal / quantity : resolvedTotal);

  return {
    description,
    quantity,
    unitAmount: resolvedUnit,
    totalAmount: resolvedTotal,
  };
};

const normalizeInvoice = (invoice: DownloadableInvoice): NormalizedInvoice => {
  const source = invoice as unknown as Record<string, unknown>;
  const normalizedRole = firstText(source.role).toLowerCase().replace(/[\s_-]+/g, '');
  const isPayout = ['photographer', 'salesrep', 'salesrepresentative'].includes(normalizedRole);
  const payoutParty = source.payee
    ?? (normalizedRole === 'salesrep' ? source.salesRep ?? source.sales_rep : undefined)
    ?? (normalizedRole === 'photographer' ? source.photographer : undefined);
  const clientProfile = source.clientProfile ?? source.client_profile;
  const clientName = isPayout
    ? firstText(partyName(payoutParty), 'Payee')
    : firstText(
        partyName(source.client),
        partyName(clientProfile),
        source.client_name,
        'Client',
      );
  const clientEmail = isPayout
    ? partyEmail(payoutParty)
    : firstText(partyEmail(source.client), partyEmail(clientProfile));
  const number = firstText(
    source.number,
    source.invoiceNumber,
    source.invoice_number,
    source.id,
    'invoice',
  ).replace(/^#/, '');

  const totalHint = toOptionalNumber(source.total ?? source.amount ?? source.total_amount);
  const sourceItems = Array.isArray(source.items)
    ? source.items.map(normalizeItem).filter((item): item is NormalizedInvoiceLine => Boolean(item))
    : [];
  const services = Array.isArray(source.services)
    ? source.services.map(toText).filter(Boolean)
    : [];

  let lines = sourceItems;
  if (!lines.length && services.length) {
    const perService = (totalHint ?? 0) / services.length;
    lines = services.map((description) => ({
      description,
      quantity: 1,
      unitAmount: perService,
      totalAmount: perService,
    }));
  }
  if (!lines.length) {
    lines = [{
      description: 'Invoice services',
      quantity: 1,
      unitAmount: totalHint ?? 0,
      totalAmount: totalHint ?? 0,
    }];
  }

  const lineTotal = lines.reduce((sum, line) => sum + line.totalAmount, 0);
  const tax = toMoney(source.tax ?? source.tax_amount ?? source.sales_tax);
  const subtotal = toMoney(source.subtotal ?? source.subtotal_amount, lineTotal || Math.max((totalHint ?? 0) - tax, 0));
  const total = toMoney(source.total ?? source.amount ?? source.total_amount, subtotal + tax);
  const amountPaid = toMoney(source.amountPaid ?? source.amount_paid ?? source.paid_amount);
  const balance = Math.max(
    0,
    toMoney(source.balance ?? source.balance_due, total - amountPaid),
  );
  const primaryShoot = source.shoot;
  const firstShoot = Array.isArray(source.shoots) ? source.shoots[0] : undefined;

  return {
    number,
    isPayout,
    clientName,
    clientEmail,
    property: firstText(source.property, shootAddress(primaryShoot), shootAddress(firstShoot)),
    issueDate: formatDate(
      source.issueDate
      ?? source.issue_date
      ?? source.date
      ?? source.billingPeriodStart
      ?? source.billing_period_start
      ?? source.createdAt
      ?? source.created_at,
    ),
    dueDate: formatDate(
      source.dueDate
      ?? source.due_date
      ?? source.billingPeriodEnd
      ?? source.billing_period_end,
    ),
    status: firstText(source.status, 'pending').replace(/[_-]+/g, ' '),
    lines,
    subtotal,
    tax,
    total,
    amountPaid,
    balance,
    notes: firstText(source.notes),
  };
};

const sanitizeFilenamePart = (value: string): string => {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return sanitized || 'invoice';
};

const normalizePdfFilename = (value: string): string => {
  const withoutExtension = value.replace(/\.pdf$/i, '');
  return `${sanitizeFilenamePart(withoutExtension)}.pdf`;
};

const todayFileStamp = (): string => {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
};

const addBrandHeader = (
  doc: JsPdfDocument,
  invoice: NormalizedInvoice,
  continuation = false,
): number => {
  const margin = 42;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(BRAND_NAME, margin, margin);

  doc.setTextColor(70, 70, 70);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const brandLines = [
    ...BRAND_ADDRESS_LINES,
    `Phone: ${BRAND_PHONE}`,
    `Email: ${BRAND_EMAIL}`,
  ];
  brandLines.forEach((line, index) => doc.text(line, margin, margin + 13 + (index * 11)));

  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  const documentTitle = invoice.isPayout ? 'PAYOUT INVOICE' : 'INVOICE';
  doc.text(continuation ? `${documentTitle} (CONTINUED)` : documentTitle, pageWidth - margin, margin, { align: 'right' });
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.text(`#${invoice.number}`, pageWidth - margin, margin + 16, { align: 'right' });

  const headerBottom = Math.max(84, margin + 23 + (brandLines.length * 11));
  doc.setDrawColor(210, 218, 230);
  doc.line(margin, headerBottom, pageWidth - margin, headerBottom);
  return headerBottom + 18;
};

const addInvoiceDetails = (
  doc: JsPdfDocument,
  invoice: NormalizedInvoice,
  startY: number,
): number => {
  const margin = 42;
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightX = pageWidth - margin;

  doc.setTextColor(35, 35, 35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(invoice.isPayout ? 'PAY TO' : 'BILL TO', margin, startY);
  doc.text('INVOICE DETAILS', rightX - 152, startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(invoice.clientName, margin, startY + 15);
  let leftY = startY + 28;
  if (invoice.clientEmail) {
    doc.text(invoice.clientEmail, margin, leftY);
    leftY += 13;
  }
  if (invoice.property) {
    const propertyLines = doc.splitTextToSize(invoice.property, 260) as string[];
    doc.text(propertyLines, margin, leftY);
    leftY += propertyLines.length * 12;
  }

  const detailLabelX = rightX - 152;
  const detailValueX = rightX;
  const details = [
    [invoice.isPayout ? 'Period start' : 'Issued', invoice.issueDate],
    [invoice.isPayout ? 'Period end' : 'Due', invoice.dueDate],
    ['Status', invoice.status.toUpperCase()],
  ];
  details.forEach(([label, value], index) => {
    const y = startY + 15 + (index * 14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, detailLabelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, detailValueX, y, { align: 'right' });
  });

  return Math.max(leftY, startY + 58) + 12;
};

const addTableHeader = (doc: JsPdfDocument, y: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;

  doc.setFillColor(238, 243, 250);
  doc.rect(margin, y, pageWidth - (margin * 2), 22, 'F');
  doc.setTextColor(45, 55, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DESCRIPTION', margin + 8, y + 15);
  doc.text('QTY', 390, y + 15, { align: 'right' });
  doc.text('UNIT PRICE', 480, y + 15, { align: 'right' });
  doc.text('AMOUNT', pageWidth - margin - 8, y + 15, { align: 'right' });
  return y + 29;
};

const addFooter = (doc: JsPdfDocument): void => {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220, 225, 232);
    doc.line(42, pageHeight - 38, pageWidth - 42, pageHeight - 38);
    doc.setTextColor(105, 105, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${BRAND_NAME} | ${BRAND_EMAIL} | ${BRAND_PHONE}`, 42, pageHeight - 24);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 42, pageHeight - 24, { align: 'right' });
  }
};

const renderInvoice = (doc: JsPdfDocument, invoice: NormalizedInvoice): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentBottom = pageHeight - 64;

  let y = addBrandHeader(doc, invoice);
  y = addInvoiceDetails(doc, invoice, y);
  y = addTableHeader(doc, y);

  invoice.lines.forEach((line) => {
    const descriptionLines = doc.splitTextToSize(line.description, 295) as string[];
    const rowHeight = Math.max(22, (descriptionLines.length * 11) + 9);
    if (y + rowHeight > contentBottom) {
      doc.addPage();
      y = addBrandHeader(doc, invoice, true);
      y = addTableHeader(doc, y);
    }

    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(descriptionLines, margin + 8, y + 11);
    doc.text(String(line.quantity), 390, y + 11, { align: 'right' });
    doc.text(formatCurrency(line.unitAmount), 480, y + 11, { align: 'right' });
    doc.text(formatCurrency(line.totalAmount), pageWidth - margin - 8, y + 11, { align: 'right' });
    y += rowHeight;
    doc.setDrawColor(230, 233, 238);
    doc.line(margin, y, pageWidth - margin, y);
  });

  const summaryHeight = invoice.notes ? 122 : 94;
  if (y + summaryHeight > contentBottom) {
    doc.addPage();
    y = addBrandHeader(doc, invoice, true);
  } else {
    y += 16;
  }

  const summaryLabelX = pageWidth - margin - 138;
  const summaryValueX = pageWidth - margin;
  const summaryRows: Array<[string, number]> = [
    ['Subtotal', invoice.subtotal],
    ['Tax', invoice.tax],
    ['Total', invoice.total],
    ['Paid', invoice.amountPaid],
    ['Balance', invoice.balance],
  ];
  summaryRows.forEach(([label, amount], index) => {
    const rowY = y + (index * 15);
    const emphasized = label === 'Total' || label === 'Balance';
    doc.setFont('helvetica', emphasized ? 'bold' : 'normal');
    doc.setFontSize(emphasized ? 10 : 9);
    doc.setTextColor(45, 45, 45);
    doc.text(label, summaryLabelX, rowY);
    doc.text(formatCurrency(amount), summaryValueX, rowY, { align: 'right' });
  });

  if (invoice.notes) {
    const notesY = y + 82;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notes', margin, notesY);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(invoice.notes, 310) as string[];
    doc.text(noteLines.slice(0, 4), margin, notesY + 13);
  }
};

/**
 * Build one branded PDF document. Multiple invoices are placed in the same
 * document, with every invoice beginning on a fresh page.
 */
export const generateInvoicesPdf = async (
  invoices: ReadonlyArray<DownloadableInvoice>,
): Promise<JsPdfDocument> => {
  if (!invoices.length) {
    throw new Error('Select at least one invoice to download.');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  invoices.map(normalizeInvoice).forEach((invoice, index) => {
    if (index > 0) doc.addPage();
    renderInvoice(doc, invoice);
  });
  addFooter(doc);
  return doc;
};

/** Download one invoice as a branded PDF. Resolves with the saved filename. */
export const downloadInvoicePdf = async (
  invoice: DownloadableInvoice,
  options: InvoicePdfDownloadOptions = {},
): Promise<string> => {
  const source = invoice as unknown as Record<string, unknown>;
  const reference = firstText(source.number, source.invoiceNumber, source.invoice_number, source.id, 'invoice');
  const fileName = normalizePdfFilename(options.fileName || `invoice-${reference.replace(/^#/, '')}`);
  const doc = await generateInvoicesPdf([invoice]);
  doc.save(fileName);
  return fileName;
};

/** Download multiple invoices as one combined branded PDF. */
export const downloadInvoicesPdf = async (
  invoices: ReadonlyArray<DownloadableInvoice>,
  options: InvoicePdfDownloadOptions = {},
): Promise<string> => {
  const fileName = normalizePdfFilename(options.fileName || `invoices-${todayFileStamp()}`);
  const doc = await generateInvoicesPdf(invoices);
  doc.save(fileName);
  return fileName;
};
