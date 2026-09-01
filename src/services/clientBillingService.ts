import { apiClient } from '@/services/api';
import type {
  ClientBillingItem,
  ClientBillingResponse,
  ClientBillingSummary,
} from '@/types/clientBilling';

export interface ClientBillingInvoiceViewData {
  id: string;
  number: string;
  invoice_number?: string;
  client: string;
  client_id?: number | null;
  photographer?: string | null;
  property: string;
  date: string;
  dueDate: string;
  due_date?: string;
  amount: number;
  amountPaid: number;
  balance: number;
  status: 'paid' | 'pending' | 'overdue' | 'no_payment_required';
  documentType?: string | null;
  paymentRequired: boolean;
  subtotal: number;
  tax: number;
  total: number;
  services: string[];
  items: ClientBillingItem['items'];
  shoot?: ClientBillingItem['shoot'];
  shoots?: ClientBillingItem['shoots'];
  paymentMethod: string;
  paymentDetails?: Record<string, unknown> | null;
  paidAt?: string | null;
  notes?: string | null;
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const emptyClientBillingSummary: ClientBillingSummary = {
  dueNow: { amount: 0, count: 0 },
  upcoming: { amount: 0, count: 0 },
  paid: { amount: 0, count: 0 },
  noPaymentRequired: { amount: 0, count: 0 },
  paymentRequiredToReleaseCount: 0,
};

const normalizeItem = (item: ClientBillingItem): ClientBillingItem => {
  const noPaymentRequired = item.paymentRequired === false
    || item.documentType === 'complimentary_receipt'
    || item.status === 'no_payment_required'
    || item.bucket === 'no_payment_required';
  return {
    ...item,
    documentType: item.documentType ?? null,
    paymentRequired: noPaymentRequired ? false : item.paymentRequired ?? true,
    status: noPaymentRequired ? 'no_payment_required' : item.status,
    bucket: noPaymentRequired ? 'no_payment_required' : item.bucket,
    amount: toNumber(item.amount),
    amountPaid: toNumber(item.amountPaid),
    balance: toNumber(item.balance),
    services: Array.isArray(item.services) ? item.services : [],
    items: Array.isArray(item.items) ? item.items : [],
    shoots: Array.isArray(item.shoots) ? item.shoots : [],
  };
};

export const fetchClientBilling = async (): Promise<ClientBillingResponse> => {
  const response = await apiClient.get<ClientBillingResponse>('/client/billing');
  const data = response.data;

  return {
    summary: data.summary
      ? {
          dueNow: {
            amount: toNumber(data.summary.dueNow?.amount),
            count: toNumber(data.summary.dueNow?.count),
          },
          upcoming: {
            amount: toNumber(data.summary.upcoming?.amount),
            count: toNumber(data.summary.upcoming?.count),
          },
          paid: {
            amount: toNumber(data.summary.paid?.amount),
            count: toNumber(data.summary.paid?.count),
          },
          noPaymentRequired: {
            amount: toNumber(data.summary.noPaymentRequired?.amount),
            count: toNumber(data.summary.noPaymentRequired?.count),
          },
          paymentRequiredToReleaseCount: toNumber(data.summary.paymentRequiredToReleaseCount),
        }
      : emptyClientBillingSummary,
    items: Array.isArray(data.items) ? data.items.map(normalizeItem) : [],
  };
};

export const toClientBillingInvoiceViewData = (
  item: ClientBillingItem,
): ClientBillingInvoiceViewData => {
  const displayNumber =
    item.number ||
    (item.source === 'shoot_balance' && item.shootId != null
      ? `SHOOT-${item.shootId}`
      : item.id);

  return {
    id: item.id,
    number: displayNumber,
    invoice_number: item.number ?? undefined,
    client: item.client || 'Client',
    client_id: item.clientId ?? undefined,
    photographer: item.photographer ?? undefined,
    property: item.property,
    date: item.issueDate || item.dueDate || '',
    dueDate: item.dueDate || '',
    due_date: item.dueDate || undefined,
    amount: item.amount,
    amountPaid: item.amountPaid,
    balance: item.balance,
    status: item.status,
    documentType: item.documentType,
    paymentRequired: item.paymentRequired !== false,
    subtotal: item.amount,
    tax: 0,
    total: item.amount,
    services: item.services || [],
    items: item.items,
    shoot: item.shoot,
    shoots: item.shoots,
    paymentMethod: item.paymentMethod || 'N/A',
    paymentDetails: item.paymentDetails,
    paidAt: item.paidAt,
    notes: item.notes,
  };
};
