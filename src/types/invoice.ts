import type { PaymentDetails } from "@/utils/paymentUtils";

export interface InvoiceParty {
  id?: number | string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

export interface InvoiceLocation {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  fullAddress?: string;
  full?: string;
  [key: string]: unknown;
}

export interface InvoiceShootRef {
  id?: number | string;
  client_id?: number;
  photographer_id?: number;
  client?: InvoiceParty | null;
  photographer?: InvoiceParty | null;
  location?: InvoiceLocation | null;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  [key: string]: unknown;
}

export interface InvoiceItem {
  id?: number | string;
  description?: string;
  quantity?: number;
  unit_amount?: number;
  total_amount?: number;
  type?: string;
  shoot_id?: number | string;
  meta?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface InvoiceData {
  id: string;
  number: string;
  client: string;
  property: string;
  date: string;
  dueDate: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  services: string[];
  paymentMethod: string;
  paymentDetails?: PaymentDetails;
  invoiceNumber?: string;
  client_id?: number;
  photographer?: string;
  photographer_id?: number;
  salesRep?: string;
  sales_rep_id?: number;
  amountPaid?: number;
  balance?: number;
  subtotal?: number;
  tax?: number;
  total?: number;
  issueDate?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  createdAt?: string;
  paidAt?: string;
  shootsCount?: number;
  shoot_id?: number;
  shoot?: InvoiceShootRef;
  shoots?: InvoiceShootRef[];
  items?: InvoiceItem[];
  notes?: string;
}

export type InvoiceViewDialogItem = InvoiceItem & {
  meta?: {
    extra_description?: string;
    service_name?: string;
    photographer_name?: string;
    source?: string;
    waived_due_to_cancellation?: boolean;
    cancelled_service_charge?: boolean;
    original_amount?: number;
    cancellation_fee?: boolean;
    [key: string]: unknown;
  } | null;
};

export type InvoiceViewDialogInvoice = Omit<
  Partial<InvoiceData>,
  | "id"
  | "number"
  | "client"
  | "photographer"
  | "shoot"
  | "shoots"
  | "items"
  | "paymentMethod"
  | "paymentDetails"
  | "paidAt"
> & {
  id?: string | number;
  invoice_number?: string | number;
  number?: string;
  client?: string | InvoiceParty | null;
  photographer?: string | InvoiceParty | null;
  shoot?: InvoiceShootRef | null;
  shoots?: InvoiceShootRef[];
  items?: InvoiceViewDialogItem[];
  paymentMethod?: string;
  payment_method?: string;
  paymentDetails?: PaymentDetails;
  payment_details?: PaymentDetails;
  paidAt?: string | null;
  paid_at?: string | null;
  issue_date?: string;
  due_date?: string;
  amount_paid?: number | string;
};
