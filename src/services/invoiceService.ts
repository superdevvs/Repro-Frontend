import { API_BASE_URL } from '@/config/env';
import { InvoiceData, InvoiceItem, InvoiceParty, InvoiceShootRef } from '@/utils/invoiceUtils';
import type { PaymentDetails } from '@/utils/paymentUtils';

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken') || localStorage.getItem('token');
};

const buildHeaders = () => {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

type InvoiceApiRecord = {
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
  is_paid?: boolean;
  status?: string;
  shoot?: InvoiceShootRef | null;
  property?: string;
  items?: InvoiceItem[];
  services?: string[];
  client?: string | InvoiceParty | null;
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

const mapInvoiceResponse = (invoice: InvoiceApiRecord, fallbackId?: string | number): InvoiceData => {
  const fallbackDate = new Date().toISOString().split('T')[0];
  const issueDate = invoice.issue_date || invoice.billing_period_start || invoice.created_at || fallbackDate;
  const dueDate = invoice.due_date || invoice.billing_period_end || issueDate;
  const subtotal = toNumber(invoice.subtotal ?? invoice.subtotal_amount, 0);
  const tax = toNumber(invoice.tax ?? invoice.tax_amount ?? invoice.sales_tax, 0);
  const baseAmount = toNumber(invoice.total_amount ?? invoice.total ?? invoice.amount ?? subtotal + tax);
  const amountPaid = toNumber(invoice.amount_paid ?? invoice.paid_amount);
  const balance = toNumber(invoice.balance_due, baseAmount - amountPaid);
  const invoiceNumber = String(invoice.invoice_number ?? invoice.invoiceNumber ?? invoice.id ?? fallbackId ?? '');
  const isPaid = invoice.is_paid || (invoice.status || '').toLowerCase() === 'paid';
  const overdue = !isPaid && dueDate && new Date(dueDate) < new Date();
  const normalizedStatus = isPaid
    ? 'paid'
    : overdue
      ? 'overdue'
      : (invoice.status || 'pending').toLowerCase();

  const shoot = invoice.shoot;
  const clientRecord = typeof invoice.client === 'object' && invoice.client ? invoice.client : null;
  const photographerRecord = typeof invoice.photographer === 'object' && invoice.photographer ? invoice.photographer : null;
  const salesRepRecord = typeof invoice.salesRep === 'object' && invoice.salesRep ? invoice.salesRep : null;
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
      : clientRecord?.name || shoot?.client?.name || invoice.client_name || 'Unknown Client',
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
    shootsCount: toNumber(invoice.shoots_count, Array.isArray(invoice.shoots) ? invoice.shoots.length : 0),
    shoot_id: toOptionalNumber(invoice.shoot_id),
    shoot,
    shoots: invoice.shoots,
    property,
    services,
    items: invoice.items,
  };
};

export interface FetchInvoicesParams {
  page?: number;
  per_page?: number;
  paid?: boolean;
  start?: string;
  end?: string;
  photographer_id?: number;
}

export interface InvoiceResponse {
  data: InvoiceData[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/**
 * Fetch invoices from the API with role-based filtering
 */
export const fetchInvoices = async (params: FetchInvoicesParams = {}): Promise<InvoiceResponse> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());
  if (params.paid !== undefined) queryParams.append('paid', params.paid.toString());
  if (params.start) queryParams.append('start', params.start);
  if (params.end) queryParams.append('end', params.end);
  if (params.photographer_id) queryParams.append('photographer_id', params.photographer_id.toString());

  const url = `${API_BASE_URL}/api/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  const response = await fetch(url, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('You do not have permission to view invoices');
    }
    throw new Error(`Failed to fetch invoices: ${response.statusText}`);
  }

  const json = await response.json();
  
  // Transform API response to match InvoiceData format
  const invoices: InvoiceData[] = (json.data || []).map((invoice: InvoiceApiRecord) => mapInvoiceResponse(invoice));

  return {
    data: invoices,
    current_page: json.current_page || 1,
    last_page: json.last_page || 1,
    per_page: json.per_page || json.data?.length || 15,
    total: json.total || invoices.length,
  };
};

/**
 * Mark an invoice as paid
 */
export const markInvoiceAsPaid = async (
  invoiceId: string | number,
  data: {
    amount_paid?: number;
    paid_at?: string;
    payment_method?: string;
    payment_details?: PaymentDetails | null;
  }
): Promise<InvoiceData> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${invoiceId}/mark-paid`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('You do not have permission to mark invoices as paid');
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to mark invoice as paid: ${response.statusText}`);
  }

  const json = await response.json();
  const invoice = json.data || json;

  return mapInvoiceResponse(invoice, invoiceId);
};

export const addInvoiceMiscItem = async (
  invoiceId: string | number,
  payload: { description: string; amount: number; quantity?: number }
): Promise<InvoiceData> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${invoiceId}/misc-items`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('You do not have permission to update invoices');
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to add misc item: ${response.statusText}`);
  }

  const json = await response.json();
  const invoice = json.invoice || json.data || json;
  return mapInvoiceResponse(invoice, invoiceId);
};

export const removeInvoiceMiscItem = async (
  invoiceId: string | number,
  itemId: string | number
): Promise<InvoiceData> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/admin/invoices/${invoiceId}/misc-items/${itemId}`,
    {
      method: 'DELETE',
      headers: buildHeaders(),
    }
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('You do not have permission to update invoices');
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to remove misc item: ${response.statusText}`);
  }

  const json = await response.json();
  const invoice = json.invoice || json.data || json;
  return mapInvoiceResponse(invoice, invoiceId);
};

// ---- Photographer / Sales Rep Invoice Management ----

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

/**
 * Fetch weekly invoices for the authenticated photographer
 */
export const fetchPhotographerInvoices = async (params: { page?: number; per_page?: number } = {}): Promise<{
  data: WeeklyInvoice[];
  current_page: number;
  last_page: number;
  total: number;
}> => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());

  const url = `${API_BASE_URL}/api/photographer/invoices${queryParams.toString() ? `?${queryParams}` : ''}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch photographer invoices');
  }

  return response.json();
};

/**
 * Fetch weekly invoices for the authenticated sales rep
 */
export const fetchSalesRepInvoices = async (params: { page?: number; per_page?: number } = {}): Promise<{
  data: WeeklyInvoice[];
  current_page: number;
  last_page: number;
  total: number;
}> => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());

  const url = `${API_BASE_URL}/api/salesrep/invoices${queryParams.toString() ? `?${queryParams}` : ''}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch sales rep invoices');
  }

  return response.json();
};

/**
 * Get a single weekly invoice detail (photographer or sales rep)
 */
export const fetchWeeklyInvoiceDetail = async (invoiceId: number, role: 'photographer' | 'salesRep'): Promise<WeeklyInvoice> => {
  const prefix = role === 'photographer' ? 'photographer' : 'salesrep';
  const url = `${API_BASE_URL}/api/${prefix}/invoices/${invoiceId}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch invoice detail');
  }

  return response.json();
};

/**
 * Add expense to a weekly invoice
 */
export const addWeeklyInvoiceExpense = async (
  invoiceId: number,
  role: 'photographer' | 'salesRep',
  data: { description: string; amount: number; quantity?: number }
): Promise<{ message: string; item: WeeklyInvoiceItem; invoice: WeeklyInvoice }> => {
  const prefix = role === 'photographer' ? 'photographer' : 'salesrep';
  const response = await fetch(`${API_BASE_URL}/api/${prefix}/invoices/${invoiceId}/expenses`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to add expense');
  }

  return response.json();
};

/**
 * Remove expense from a weekly invoice
 */
export const removeWeeklyInvoiceExpense = async (
  invoiceId: number,
  itemId: number,
  role: 'photographer' | 'salesRep'
): Promise<{ message: string; invoice: WeeklyInvoice }> => {
  const prefix = role === 'photographer' ? 'photographer' : 'salesrep';
  const response = await fetch(`${API_BASE_URL}/api/${prefix}/invoices/${invoiceId}/expenses/${itemId}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to remove expense');
  }

  return response.json();
};

/**
 * Add a charge (service line) to a weekly invoice. Currently photographer-only.
 */
export const addWeeklyInvoiceCharge = async (
  invoiceId: number,
  role: 'photographer' | 'salesRep',
  data: { description: string; amount: number; quantity?: number; shoot_id?: number },
): Promise<{ message: string; item: WeeklyInvoiceItem; invoice: WeeklyInvoice }> => {
  if (role !== 'photographer') {
    throw new Error('Adding service lines is only supported for photographers.');
  }
  const response = await fetch(`${API_BASE_URL}/api/photographer/invoices/${invoiceId}/charges`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to add service');
  }

  return response.json();
};

/**
 * Remove a charge (service line) from a weekly invoice. Photographer-only.
 */
export const removeWeeklyInvoiceCharge = async (
  invoiceId: number,
  itemId: number,
  role: 'photographer' | 'salesRep',
): Promise<{ message: string; invoice: WeeklyInvoice }> => {
  if (role !== 'photographer') {
    throw new Error('Removing service lines is only supported for photographers.');
  }
  const response = await fetch(`${API_BASE_URL}/api/photographer/invoices/${invoiceId}/charges/${itemId}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to remove service');
  }

  return response.json();
};

/**
 * Update a single line item on a weekly invoice (description / amount / quantity).
 * Photographer-only.
 */
export const updateWeeklyInvoiceItem = async (
  invoiceId: number,
  itemId: number,
  role: 'photographer' | 'salesRep',
  data: { description?: string; amount?: number; quantity?: number },
): Promise<{ message: string; item: WeeklyInvoiceItem; invoice: WeeklyInvoice }> => {
  if (role !== 'photographer') {
    throw new Error('Editing line items is only supported for photographers.');
  }
  const response = await fetch(`${API_BASE_URL}/api/photographer/invoices/${invoiceId}/items/${itemId}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to update line item');
  }

  return response.json();
};

/**
 * Reject a weekly invoice
 */
export const rejectWeeklyInvoice = async (
  invoiceId: number,
  role: 'photographer' | 'salesRep',
  reason?: string
): Promise<{ message: string; invoice: WeeklyInvoice }> => {
  const prefix = role === 'photographer' ? 'photographer' : 'salesrep';
  const response = await fetch(`${API_BASE_URL}/api/${prefix}/invoices/${invoiceId}/reject`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to reject invoice');
  }

  return response.json();
};

/**
 * Submit a weekly invoice for approval
 */
export const submitWeeklyInvoiceForApproval = async (
  invoiceId: number,
  role: 'photographer' | 'salesRep',
  notes?: string
): Promise<{ message: string; invoice: WeeklyInvoice }> => {
  const prefix = role === 'photographer' ? 'photographer' : 'salesrep';
  const response = await fetch(`${API_BASE_URL}/api/${prefix}/invoices/${invoiceId}/submit-for-approval`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ notes }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to submit invoice for approval');
  }

  return response.json();
};

// ---- Admin Invoice Approval ----

/**
 * Fetch invoices pending approval (admin)
 */
export const fetchPendingApprovalInvoices = async (params: { page?: number; per_page?: number } = {}): Promise<{
  data: WeeklyInvoice[];
  current_page: number;
  last_page: number;
  total: number;
}> => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());

  const url = `${API_BASE_URL}/api/admin/invoices/pending-approval${queryParams.toString() ? `?${queryParams}` : ''}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch pending invoices');
  }

  return response.json();
};

export const fetchAdminInvoiceReviewQueue = async (params: {
  role?: 'photographer' | 'salesRep';
  approval_status?: 'pending_approval' | 'approved' | 'accounts_approved' | 'rejected';
  search?: string;
  start?: string;
  end?: string;
  page?: number;
  per_page?: number;
} = {}): Promise<WeeklyInvoiceReviewQueueResponse> => {
  const queryParams = new URLSearchParams();

  if (params.role) queryParams.append('role', params.role);
  if (params.approval_status) queryParams.append('approval_status', params.approval_status);
  if (params.search) queryParams.append('search', params.search);
  if (params.start) queryParams.append('start', params.start);
  if (params.end) queryParams.append('end', params.end);
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());

  const url = `${API_BASE_URL}/api/admin/invoices/review-queue${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch admin invoice review queue');
  }

  return response.json();
};

export const fetchAdminInvoiceReviewDetail = async (invoiceId: number): Promise<WeeklyInvoice> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${invoiceId}/review-detail`, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch invoice review detail');
  }

  const payload = await response.json();
  return payload.data;
};

/**
 * Approve a weekly invoice (admin)
 */
export const approveWeeklyInvoice = async (
  invoiceId: number,
  warningOverrideReason?: string
): Promise<{ message: string; invoice: WeeklyInvoice }> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${invoiceId}/approve`, {
    method: 'POST',
    headers: buildHeaders(),
    body: warningOverrideReason ? JSON.stringify({ warning_override_reason: warningOverrideReason }) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to approve invoice');
  }

  return response.json();
};

/**
 * Reject a weekly invoice (admin)
 */
export const adminRejectWeeklyInvoice = async (
  invoiceId: number,
  reason: string
): Promise<{ message: string; invoice: WeeklyInvoice }> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${invoiceId}/reject`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to reject invoice');
  }

  return response.json();
};

// ---- Payout Report ----

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

/**
 * Fetch payout report data
 */
export const fetchPayoutReport = async (params: {
  start?: string;
  end?: string;
  role?: 'all' | 'photographer' | 'salesRep' | 'editor';
} = {}): Promise<PayoutReport> => {
  const queryParams = new URLSearchParams();
  if (params.start) queryParams.append('start', params.start);
  if (params.end) queryParams.append('end', params.end);
  if (params.role) queryParams.append('role', params.role);

  const url = `${API_BASE_URL}/api/admin/payout-report${queryParams.toString() ? `?${queryParams}` : ''}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch payout report');
  }

  return response.json();
};

/**
 * Download payout report as CSV
 */
export const downloadPayoutReport = async (params: {
  start?: string;
  end?: string;
  role?: 'all' | 'photographer' | 'salesRep' | 'editor';
} = {}): Promise<void> => {
  const queryParams = new URLSearchParams();
  if (params.start) queryParams.append('start', params.start);
  if (params.end) queryParams.append('end', params.end);
  if (params.role) queryParams.append('role', params.role);

  const url = `${API_BASE_URL}/api/admin/payout-report/download${queryParams.toString() ? `?${queryParams}` : ''}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    throw new Error('Failed to download payout report');
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'payout-report.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
};

export const sendPayoutReport = async (params: {
  start?: string;
  end?: string;
  role?: 'all' | 'photographer' | 'salesRep' | 'editor';
} = {}): Promise<{ message: string; sent_count: number }> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/payout-report/send`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to send payout report');
  }

  return response.json();
};

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

export const fetchAdminEditorEarnings = async (params: {
  status?: 'paid' | 'unpaid';
  search?: string;
  start?: string;
  end?: string;
  service_type?: string;
} = {}): Promise<EditorEarningsAdminResponse> => {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.search) queryParams.append('search', params.search);
  if (params.start) queryParams.append('start', params.start);
  if (params.end) queryParams.append('end', params.end);
  if (params.service_type) queryParams.append('service_type', params.service_type);

  const response = await fetch(
    `${API_BASE_URL}/api/admin/editors/earnings${queryParams.toString() ? `?${queryParams}` : ''}`,
    { headers: buildHeaders() },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch editor earnings');
  }

  return response.json();
};

export const fetchAdminEditorEarningsDetail = async (
  editorId: number,
  params: { status?: 'paid' | 'unpaid'; start?: string; end?: string; service_type?: string } = {},
): Promise<EditorEarningsDetail> => {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.start) queryParams.append('start', params.start);
  if (params.end) queryParams.append('end', params.end);
  if (params.service_type) queryParams.append('service_type', params.service_type);

  const response = await fetch(
    `${API_BASE_URL}/api/admin/editors/${editorId}/earnings-detail${queryParams.toString() ? `?${queryParams}` : ''}`,
    { headers: buildHeaders() },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch editor earnings detail');
  }

  const payload = await response.json();
  return payload.data;
};

export const markAdminEditorPayoutsPaid = async (payoutIds: number[]) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/editors/payouts/mark-paid`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ payout_ids: payoutIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to mark editor earnings paid');
  }

  return response.json();
};

export const sendAdminEditorReport = async (params: { start?: string; end?: string } = {}) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/editors/reports/send`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to send editor report');
  }

  return response.json();
};

export const fetchSelfEditorEarnings = async (params: {
  status?: 'paid' | 'unpaid';
  start?: string;
  end?: string;
  service_type?: string;
} = {}): Promise<EditorEarningsDetail> => {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.start) queryParams.append('start', params.start);
  if (params.end) queryParams.append('end', params.end);
  if (params.service_type) queryParams.append('service_type', params.service_type);

  const response = await fetch(
    `${API_BASE_URL}/api/editor/earnings${queryParams.toString() ? `?${queryParams}` : ''}`,
    { headers: buildHeaders() },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch editor earnings');
  }

  const payload = await response.json();
  return payload.data;
};

export const sendSelfEditorReport = async (params: { start?: string; end?: string } = {}) => {
  const response = await fetch(`${API_BASE_URL}/api/editor/reports/send`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to send editor report');
  }

  return response.json();
};
