export type ClientBillingSource = 'invoice' | 'shoot_balance';
export type ClientBillingBucket = 'due_now' | 'upcoming' | 'paid';
export type ClientBillingStatus = 'paid' | 'pending' | 'overdue';

export interface ClientBillingBucketSummary {
  amount: number;
  count: number;
}

export interface ClientBillingSummary {
  dueNow: ClientBillingBucketSummary;
  upcoming: ClientBillingBucketSummary;
  paid: ClientBillingBucketSummary;
  paymentRequiredToReleaseCount: number;
}

export interface ClientBillingItemRow {
  id?: string | number;
  description?: string;
  quantity?: number;
  unit_amount?: number;
  total_amount?: number;
  type?: string;
  shoot_id?: number | string | null;
  meta?: Record<string, unknown> | null;
}

export interface ClientBillingShootRef {
  id?: number | string;
  client_id?: number | null;
  photographer_id?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  status?: string | null;
  workflow_status?: string | null;
  scheduled_date?: string | null;
  client?: {
    id?: number | string;
    name?: string;
    email?: string;
  } | null;
  photographer?: {
    id?: number | string;
    name?: string;
  } | null;
  location?: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    fullAddress?: string | null;
  } | null;
}

export interface ClientBillingItem {
  id: string;
  source: ClientBillingSource;
  sourceLabel: string;
  invoiceId?: number | null;
  shootId?: number | null;
  number?: string | null;
  property: string;
  issueDate?: string | null;
  dueDate?: string | null;
  amount: number;
  amountPaid: number;
  balance: number;
  status: ClientBillingStatus;
  rawStatus?: string | null;
  bucket: ClientBillingBucket;
  paymentRequiredToRelease: boolean;
  paymentMethod?: string | null;
  paymentDetails?: Record<string, unknown> | null;
  client?: string;
  clientId?: number | null;
  photographer?: string | null;
  photographerId?: number | null;
  services?: string[];
  items?: ClientBillingItemRow[];
  shoot?: ClientBillingShootRef | null;
  shoots?: ClientBillingShootRef[];
  notes?: string | null;
  paidAt?: string | null;
}

export interface ClientBillingResponse {
  summary: ClientBillingSummary;
  items: ClientBillingItem[];
}
