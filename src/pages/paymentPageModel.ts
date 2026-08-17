import { parseLocalYmd } from '@/utils/shootLocalDate';

export type ReceiptDetails = {
  payment_id?: number;
  number: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  provider: string;
  status: string;
  hosted_receipt_url?: string | null;
  receipt_url?: string | null;
  refund_status?: string | null;
  refunded_at?: string | null;
  refund_amount?: number | null;
};

export type ShootPaymentRecord = {
  id?: number;
  payment_id?: number;
  amount: number;
  status?: string;
  refunded_at?: string | null;
  refund_status?: string | null;
  stripe_payment_id?: string | null;
  stripe_session_id?: string | null;
  hosted_receipt_url?: string | null;
  receipt_url?: string | null;
};

export interface ShootDetails {
  id: number;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  scheduled_date?: string;
  time?: string;
  total_quote: number;
  base_quote: number;
  service_subtotal?: number;
  discount_type?: 'fixed' | 'percent' | 'percentage' | null;
  discount_value?: number | null;
  discount_amount?: number;
  discounted_subtotal?: number;
  tax_amount: number;
  invoice_adjustments_total?: number;
  invoiceAdjustmentsTotal?: number;
  order_total?: number;
  orderTotal?: number;
  services: Array<{ name: string; pivot?: { price: number; quantity: number } }>;
  client?: { name: string; email: string };
  payments?: ShootPaymentRecord[];
  amount_due?: number;
  receipt?: ReceiptDetails | null;
}

export type PaymentConfirmationResult = {
  last_payment_amount?: number | string | null;
  return_to?: string | null;
  receipt?: ReceiptDetails | null;
};

export interface EmbeddedCheckoutInstance {
  mount: (element: HTMLElement | string) => void;
  destroy: () => void;
}

export const AUTO_RETURN_DELAY_SECONDS = 8;
export const POPUP_CLOSE_DELAY_SECONDS = 5;

export function formatPaymentCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPaymentPaidAt(value?: string | null) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatPaymentScheduledAt(dateValue?: string, timeValue?: string) {
  if (!dateValue) return null;
  const date = parseLocalYmd(dateValue);
  if (Number.isNaN(date.getTime())) {
    return timeValue ? `${dateValue} at ${timeValue}` : dateValue;
  }
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return timeValue ? `${formattedDate} at ${timeValue}` : formattedDate;
}

export function resolvePaymentInvoiceAdjustmentsTotal(shoot?: ShootDetails | null) {
  if (!shoot) return 0;
  return Math.max(
    Number(shoot.invoice_adjustments_total ?? shoot.invoiceAdjustmentsTotal ?? 0) || 0,
    0,
  );
}
