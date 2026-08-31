import type { InvoiceShootRef } from '@/utils/invoiceUtils';
import type { InvoiceItem, InvoiceParty } from '@/utils/invoiceUtils';
import type { PaymentDetails } from '@/utils/paymentUtils';

export type InvoiceApiRecord = {
  id?: string | number;
  invoice_number?: string | number;
  invoiceNumber?: string | number;
  issue_date?: string;
  billing_period_start?: string;
  created_at?: string;
  due_date?: string;
  billing_period_end?: string;
  subtotal?: number | string;
  subtotal_amount?: number | string;
  tax?: number | string;
  tax_amount?: number | string;
  sales_tax?: number | string;
  total_amount?: number | string;
  total?: number | string;
  amount?: number | string;
  amount_paid?: number | string;
  paid_amount?: number | string;
  balance_due?: number | string;
  overpayment_amount?: number | string;
  overpaymentAmount?: number | string;
  is_paid?: boolean;
  status?: string;
  shoot?: InvoiceShootRef | null;
  property?: string;
  items?: InvoiceItem[];
  services?: string[];
  client?: string | InvoiceParty | null;
  clientProfile?: InvoiceParty | null;
  client_profile?: InvoiceParty | null;
  client_name?: string;
  client_id?: number | string;
  photographer?: string | InvoiceParty | null;
  photographer_name?: string;
  photographer_id?: number | string;
  salesRep?: string | InvoiceParty | null;
  sales_rep_name?: string;
  sales_rep_id?: number | string;
  period_start?: string;
  period_end?: string;
  paid_at?: string;
  payment_method?: string;
  paymentMethod?: string;
  payment_details?: PaymentDetails;
  paymentDetails?: PaymentDetails;
  notes?: string;
  shoots_count?: number | string;
  shoot_id?: number | string;
  shoots?: InvoiceShootRef[];
  [key: string]: unknown;
};

export interface WeeklyInvoice {
  id: number;
  role?: 'photographer' | 'salesRep';
  photographer_id?: number;
  sales_rep_id?: number;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  approval_status: string;
  can_edit?: boolean;
  edit_locked_reason?: string | null;
  is_paid?: boolean;
  paid_at?: string | null;
  rejection_reason?: string;
  modification_notes?: string;
  notes?: string;
  approved_at?: string;
  rejected_at?: string;
  modified_at?: string;
  modified_by?: number;
  approved_by?: number;
  rejected_by?: number;
  last_activity_at?: string;
  created_at: string;
  payee?: WeeklyInvoiceActor | null;
  photographer?: WeeklyInvoiceActor | null;
  salesRep?: WeeklyInvoiceActor | null;
  modifiedBy?: WeeklyInvoiceActor | null;
  approvedBy?: WeeklyInvoiceActor | null;
  rejectedBy?: WeeklyInvoiceActor | null;
  warningOverrideBy?: WeeklyInvoiceActor | null;
  shoot_count?: number;
  charge_count?: number;
  expense_count?: number;
  items?: WeeklyInvoiceItem[];
  shoots?: WeeklyInvoiceReviewShoot[];
  timeline?: WeeklyInvoiceTimelineEvent[];
  approval_snapshot?: Record<string, unknown> | null;
  unresolved_warnings?: WeeklyInvoiceWarning[];
  warning_override_reason?: string | null;
  warning_override_at?: string | null;
  audit_events?: WeeklyInvoiceAuditEvent[];
}

export interface WeeklyInvoiceItem {
  id: number;
  invoice_id: number;
  shoot_id?: number;
  type: 'charge' | 'expense' | 'payment';
  description: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
  recorded_at?: string;
  meta?: Record<string, unknown> | null;
}

export interface WeeklyInvoiceActor {
  id: number;
  name: string;
  email: string;
  role?: string;
}

export interface WeeklyInvoiceTimelineEvent {
  key: string;
  label: string;
  timestamp: string;
  actor?: WeeklyInvoiceActor | null;
  reason?: string | null;
}

export interface WeeklyInvoiceWarning {
  code?: string;
  severity?: string;
  message?: string;
  shoot_id?: number | string | null;
  metadata?: Record<string, unknown> | null;
}

export interface WeeklyInvoiceAuditEvent {
  id: number;
  event: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  actor?: WeeklyInvoiceActor | null;
}

export interface WeeklyInvoiceReviewShoot extends InvoiceShootRef {
  completed_at?: string;
  scheduled_date?: string;
  total_quote?: number;
  photographer_paid_at?: string | null;
  sales_rep_paid_at?: string | null;
}

export interface WeeklyInvoiceReviewQueueSummary {
  invoice_count: number;
  total_amount: number;
  needs_review_count: number;
  approved_count: number;
  returned_count: number;
}

export interface WeeklyInvoiceReviewQueueResponse {
  data: WeeklyInvoice[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  summary: WeeklyInvoiceReviewQueueSummary;
}

export interface PayoutSummary {
  id: number;
  name: string;
  email: string;
  role: string;
  shoot_count: number;
  service_count?: number;
  gross_total: number;
  average_value: number;
  commission_rate?: number | null;
  commission_total?: number | null;
  unpaid_amount?: number | null;
  paid_amount?: number | null;
}

export interface PayoutReport {
  role?: 'all' | 'photographer' | 'salesRep' | 'editor';
  period: { start: string; end: string };
  photographers: PayoutSummary[];
  editors: PayoutSummary[];
  sales_reps: PayoutSummary[];
  totals: {
    photographer_count: number;
    photographer_total: number;
    editor_count: number;
    editor_total: number;
    sales_rep_count: number;
    sales_rep_commission_total: number;
  };
}

export interface EditorEarningsSummaryRow {
  editor: WeeklyInvoiceActor;
  status: 'paid' | 'unpaid';
  service_count: number;
  shoot_count: number;
  total_earned: number;
  unpaid_amount: number;
  paid_amount: number;
  latest_completed_at?: string | null;
}

export interface EditorEarningsLineItem {
  id: number;
  shoot_id: number;
  service_id?: number | null;
  service_name: string;
  quantity_snapshot: number;
  rate_snapshot: number;
  payout_amount: number;
  completed_at?: string | null;
  is_paid: boolean;
  paid_at?: string | null;
  payout_batch_id?: string | null;
  client?: WeeklyInvoiceActor | null;
  shoot?: {
    id: number;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    scheduled_date?: string | null;
  } | null;
  paid_by?: WeeklyInvoiceActor | null;
}

export interface EditorEarningsDetail {
  editor: WeeklyInvoiceActor;
  period: { start?: string | null; end?: string | null };
  summary: {
    service_count: number;
    shoot_count: number;
    total_earned: number;
    unpaid_amount: number;
    paid_amount: number;
    latest_completed_at?: string | null;
  };
  current_rates: {
    photo_edit_rate: number;
    video_edit_rate: number;
    floorplan_rate: number;
    virtual_staging_rate: number;
    other_rate: number;
    service_rates: Array<{
      service_id?: string | number | null;
      service_name: string;
      rate: number;
    }>;
  };
  line_items: EditorEarningsLineItem[];
  timeline: Array<{
    id: number;
    label: string;
    timestamp?: string | null;
    service_name: string;
    actor?: WeeklyInvoiceActor | null;
  }>;
}

export interface EditorEarningsAdminResponse {
  period: { start?: string | null; end?: string | null };
  data: EditorEarningsSummaryRow[];
  summary: {
    editor_count: number;
    service_count: number;
    total_earned: number;
    unpaid_amount: number;
    paid_amount: number;
  };
}
