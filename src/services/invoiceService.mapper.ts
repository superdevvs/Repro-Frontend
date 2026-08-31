import { endOfDay } from 'date-fns';
import type { InvoiceData, InvoiceItem, InvoiceShootRef } from '@/utils/invoiceUtils';
import { parseInvoiceDateInput } from '@/utils/invoiceDateFilters';
import type { InvoiceApiRecord } from './invoiceService.types';

const buildFullAddress = (shoot?: InvoiceShootRef | null) => {
  if (!shoot) return '';
  const location = shoot?.location;
  const locationAddress = typeof location === 'object' ? location.address : undefined;
  const locationCity = typeof location === 'object' ? location.city : undefined;
  const locationState = typeof location === 'object' ? location.state : undefined;
  const locationZip = typeof location === 'object' ? location.zip : undefined;
  const locationFullAddress = typeof location === 'object'
    ? (location.fullAddress || location.full)
    : undefined;
  const addressParts = [
    locationAddress || shoot?.address,
    locationCity || shoot?.city,
    [locationState || shoot?.state, locationZip || shoot?.zip].filter(Boolean).join(' '),
  ].filter(Boolean);
  return locationFullAddress || (addressParts.length > 0 ? addressParts.join(', ') : '');
};

const toNumber = (value: string | number | undefined | null, fallback = 0): number => {
  const normalized = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;
  return Number.isFinite(normalized) ? normalized : fallback;
};

const toOptionalNumber = (value: string | number | undefined | null): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
};

export type InvoiceMutationResult = {
  invoice: InvoiceData;
  affectedShootIds: string[];
};

export const mapInvoiceMutationResponse = (
  payload: Record<string, unknown>,
  fallbackId?: string | number,
): InvoiceMutationResult => {
  const invoicePayload = (payload.invoice || payload.data || payload) as InvoiceApiRecord;
  const rawAffectedShootIds = payload.affected_shoot_ids ?? payload.affectedShootIds;
  const affectedShootIds = Array.isArray(rawAffectedShootIds)
    ? Array.from(new Set(
        rawAffectedShootIds
          .filter((id) => id !== null && id !== undefined && String(id).trim() !== '')
          .map((id) => String(id)),
      ))
    : [];

  return {
    invoice: mapInvoiceResponse(invoicePayload, fallbackId),
    affectedShootIds,
  };
};

/**
 * Exported for tests: the status/balance rules here decide whether an invoice can be
 * chased, so they are worth asserting against production-shaped payloads directly.
 */
export const mapInvoiceResponse = (invoice: InvoiceApiRecord, fallbackId?: string | number): InvoiceData => {
  const fallbackDate = new Date().toISOString().split('T')[0];
  const issueDate = invoice.issue_date || invoice.billing_period_start || invoice.created_at || fallbackDate;
  const dueDate = invoice.due_date || invoice.billing_period_end || issueDate;
  const subtotal = toNumber(invoice.subtotal ?? invoice.subtotal_amount, 0);
  const tax = toNumber(invoice.tax ?? invoice.tax_amount ?? invoice.sales_tax, 0);
  const baseAmount = toNumber(invoice.total_amount ?? invoice.total ?? invoice.amount ?? subtotal + tax);
  const amountPaid = toNumber(invoice.amount_paid ?? invoice.paid_amount);
  // `balance_due` may legitimately raise the outstanding figure, but a 0 or absent
  // value cannot settle an invoice: for client invoices the field is simply not
  // populated. Fall back to the authoritative total-minus-paid in that case.
  const reportedBalance = toNumber(invoice.balance_due, Number.NaN);
  const derivedBalance = baseAmount - amountPaid;
  const balance = Math.max(Number.isFinite(reportedBalance) && reportedBalance > 0.005
    ? reportedBalance
    : derivedBalance, 0);
  const reportedOverpayment = toNumber(invoice.overpayment_amount ?? invoice.overpaymentAmount, Number.NaN);
  const overpaymentAmount = Math.max(
    Number.isFinite(reportedOverpayment) ? reportedOverpayment : amountPaid - baseAmount,
    0,
  );
  const invoiceNumber = String(invoice.invoice_number ?? invoice.invoiceNumber ?? invoice.id ?? fallbackId ?? '');
  const rawStatus = String(invoice.status ?? '').trim().toLowerCase();

  // A $0.00 invoice is settled by definition and must never surface as Unpaid/Overdue —
  // but only when the total was actually reported. An incomplete payload carrying no
  // total at all is unknown, not zero, and must not be relabelled paid.
  const explicitTotal = invoice.total_amount ?? invoice.total ?? invoice.amount;
  const hasExplicitTotal = explicitTotal !== undefined && explicitTotal !== null && explicitTotal !== '';
  const isZeroValue = hasExplicitTotal && baseAmount <= 0.01;
  // Paid is only ever asserted from authoritative fields: the server's own status,
  // its is_paid flag, a zero-value invoice, or payments that actually cover the total.
  //
  // It is deliberately *not* inferred from the balance. `balance_due` belongs to the
  // weekly payout model and is returned as 0 for client invoices that still owe the
  // full amount, so treating a zero/absent balance as settled silently relabelled
  // every `sent` invoice as `paid` and removed its Send Reminder control.
  const settledByPayments = hasExplicitTotal && baseAmount > 0.01 && amountPaid + 0.005 >= baseAmount;
  // Boolean() rather than `=== true` so a truthy 1 from the API still counts, while
  // undefined/null/false correctly do not.
  const isPaid =
    rawStatus === 'paid'
    || Boolean(invoice.is_paid)
    || isZeroValue
    || settledByPayments;

  const hasOutstandingBalance = !isPaid && balance > 0.01;
  const parsedDueDate = parseInvoiceDateInput(dueDate);
  const overdue = hasOutstandingBalance
    && parsedDueDate !== null
    && endOfDay(parsedDueDate).getTime() < Date.now();
  const normalizedStatus = isPaid
    ? 'paid'
    : overdue
      ? 'overdue'
      : (rawStatus || 'pending');

  const shoot = invoice.shoot;
  const firstShootClient = Array.isArray(invoice.shoots)
    ? invoice.shoots.find((entry) => entry?.client)?.client ?? null
    : null;
  const clientRecord = typeof invoice.client === 'object' && invoice.client ? invoice.client : null;
  const clientProfile = invoice.clientProfile
    ?? invoice.client_profile
    ?? clientRecord
    ?? shoot?.client
    ?? firstShootClient
    ?? null;
  const photographerRecord = typeof invoice.photographer === 'object' && invoice.photographer ? invoice.photographer : null;
  const salesRepRecord = typeof invoice.salesRep === 'object' && invoice.salesRep ? invoice.salesRep : null;
  const explicitPayee = typeof invoice.payee === 'object' && invoice.payee ? invoice.payee : null;
  const normalizedRole = String(invoice.role || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  const payee = explicitPayee
    ?? (normalizedRole === 'salesrep' ? salesRepRecord : null)
    ?? (normalizedRole === 'photographer' ? photographerRecord : null);
  const fullAddress = buildFullAddress(shoot);
  const property =
    fullAddress ||
    invoice.property ||
    (typeof shoot?.location === 'string' ? shoot.location : '') ||
    'N/A';

  const services = Array.isArray(invoice.items)
    ? invoice.items
        .map((item: InvoiceItem) => item.description)
        .filter((description): description is string => Boolean(description))
    : invoice.services || [];

  return {
    id: String(invoice.id || fallbackId || ''),
    number: invoiceNumber,
    invoiceNumber,
    client: typeof invoice.client === 'string'
      ? invoice.client
      : clientProfile?.name || invoice.client_name || 'Unknown Client',
    clientProfile,
    client_id: toOptionalNumber(invoice.client_id ?? clientRecord?.id ?? shoot?.client_id),
    photographer: typeof invoice.photographer === 'string'
      ? invoice.photographer
      : photographerRecord?.name || shoot?.photographer?.name || invoice.photographer_name || 'Unassigned',
    photographer_id: toOptionalNumber(invoice.photographer_id ?? photographerRecord?.id ?? shoot?.photographer_id),
    salesRep: typeof invoice.salesRep === 'string' ? invoice.salesRep : salesRepRecord?.name || invoice.sales_rep_name,
    sales_rep_id: toOptionalNumber(invoice.sales_rep_id),
    amount: baseAmount,
    amountPaid,
    balance,
    overpaymentAmount,
    overpayment_amount: overpaymentAmount,
    subtotal,
    tax,
    total: baseAmount,
    status: (normalizedStatus as InvoiceData['status']) || 'pending',
    date: issueDate,
    dueDate,
    issueDate,
    billingPeriodStart: invoice.billing_period_start || invoice.period_start,
    billingPeriodEnd: invoice.billing_period_end || invoice.period_end,
    createdAt: invoice.created_at || fallbackDate,
    paidAt: invoice.paid_at,
    paymentMethod: invoice.payment_method || invoice.paymentMethod || 'N/A',
    paymentDetails: invoice.payment_details || invoice.paymentDetails || undefined,
    notes: invoice.notes || undefined,
    role: invoice.role,
    payee,
    shootsCount: toNumber(invoice.shoots_count, Array.isArray(invoice.shoots) ? invoice.shoots.length : 0),
    shoot_id: toOptionalNumber(invoice.shoot_id),
    shoot,
    shoots: invoice.shoots,
    property,
    services,
    items: invoice.items,
  };
};
