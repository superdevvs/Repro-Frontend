import type { ShootData } from '@/types/shoots';
import type { InvoiceData, InvoiceViewDialogInvoice } from '@/types/invoice';
import type { ClientBillingInvoiceViewData } from '@/services/clientBillingService';

export type ViewableInvoice = InvoiceData | ClientBillingInvoiceViewData;

export type ShootWithLegacyEditorFields = ShootData & {
  editor_id?: string | number | null;
  editorId?: string | number | null;
};

export const toAccountingNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const parseAccountingInvoiceDate = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatAccountingApiDate = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildSalesRepSummaryWindow = (daysWindow: number) => {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (daysWindow - 1));
  return {
    startDate: formatAccountingApiDate(startDate),
    endDate: formatAccountingApiDate(endDate),
  };
};

const getInvoiceWindowDate = (invoice: InvoiceData) => {
  const legacyInvoice = invoice as InvoiceData & Record<string, unknown>;
  const candidates = invoice.status === 'paid'
    ? [
        invoice.paidAt,
        legacyInvoice.paid_at,
        legacyInvoice.updated_at,
        legacyInvoice.updatedAt,
        invoice.issueDate,
        invoice.date,
        invoice.createdAt,
        legacyInvoice.created_at,
      ]
    : [
        invoice.dueDate,
        invoice.issueDate,
        invoice.date,
        invoice.createdAt,
        legacyInvoice.created_at,
      ];

  for (const candidate of candidates) {
    const parsed = parseAccountingInvoiceDate(candidate);
    if (parsed) return parsed;
  }
  return null;
};

export const isInvoiceInDaysWindow = (invoice: InvoiceData, daysWindow: number) => {
  const invoiceDate = getInvoiceWindowDate(invoice);
  if (!invoiceDate) return true;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (daysWindow - 1));
  return invoiceDate >= start && invoiceDate <= end;
};

export const toInvoiceViewDialogInvoice = (invoice: ViewableInvoice): InvoiceViewDialogInvoice => {
  if (!('amountPaid' in invoice)) return invoice;

  const mapShoot = (shoot: ClientBillingInvoiceViewData['shoot']) => shoot
    ? {
        id: shoot.id,
        client_id: shoot.client_id ?? undefined,
        photographer_id: shoot.photographer_id ?? undefined,
        address: shoot.address ?? undefined,
        city: shoot.city ?? undefined,
        state: shoot.state ?? undefined,
        zip: shoot.zip ?? undefined,
        location: shoot.location
          ? {
              address: shoot.location.address ?? undefined,
              city: shoot.location.city ?? undefined,
              state: shoot.location.state ?? undefined,
              zip: shoot.location.zip ?? undefined,
              fullAddress: shoot.location.fullAddress ?? undefined,
            }
          : null,
        client: shoot.client
          ? { id: shoot.client.id, name: shoot.client.name, email: shoot.client.email }
          : null,
        photographer: shoot.photographer
          ? { id: shoot.photographer.id, name: shoot.photographer.name }
          : null,
      }
    : null;

  return {
    ...invoice,
    items: invoice.items?.map((item) => ({
      ...item,
      meta: item.meta ? { ...item.meta } : null,
    })),
    shoot: mapShoot(invoice.shoot),
    shoots: invoice.shoots?.map(mapShoot).filter(Boolean) as InvoiceViewDialogInvoice['shoots'],
  };
};
