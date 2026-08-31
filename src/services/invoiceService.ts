import { API_BASE_URL } from '@/config/env';
import type { InvoiceData } from '@/utils/invoiceUtils';
import type { PaymentDetails } from '@/utils/paymentUtils';
import type {
  EditorEarningsAdminResponse,
  EditorEarningsDetail,
  InvoiceApiRecord,
  PayoutReport,
  WeeklyInvoice,
  WeeklyInvoiceItem,
  WeeklyInvoiceReviewQueueResponse,
} from './invoiceService.types';
import {
  mapInvoiceMutationResponse,
  mapInvoiceResponse,
  type InvoiceMutationResult,
} from './invoiceService.mapper';

export {
  mapInvoiceMutationResponse,
  mapInvoiceResponse,
  type InvoiceMutationResult,
} from './invoiceService.mapper';

export type {
  EditorEarningsAdminResponse,
  EditorEarningsDetail,
  EditorEarningsLineItem,
  EditorEarningsSummaryRow,
  PayoutReport,
  PayoutSummary,
  WeeklyInvoice,
  WeeklyInvoiceActor,
  WeeklyInvoiceAuditEvent,
  WeeklyInvoiceItem,
  WeeklyInvoiceReviewQueueResponse,
  WeeklyInvoiceReviewQueueSummary,
  WeeklyInvoiceReviewShoot,
  WeeklyInvoiceTimelineEvent,
  WeeklyInvoiceWarning,
} from './invoiceService.types';

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

const sanitizeDownloadFilename = (value: string): string | null => {
  const basename = value
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.split('')
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 || /[<>:"/\\|?*]/.test(character) ? '-' : character;
    })
    .join('')
    .replace(/^\.+/, '')
    .trim();

  return basename || null;
};

/**
 * Read both RFC 5987 `filename*=` and legacy `filename=` response headers.
 * The returned basename is safe to pass to an anchor's `download` property.
 */
export const parseContentDispositionFilename = (header: string | null): string | null => {
  if (!header) return null;

  const encodedMatch = /(?:^|;)\s*filename\*\s*=\s*([^;]+)/i.exec(header);
  if (encodedMatch) {
    const encodedValue = encodedMatch[1].trim().replace(/^"|"$/g, '');
    const rfc5987Match = /^[^']*'[^']*'(.*)$/.exec(encodedValue);
    const valueToDecode = rfc5987Match?.[1] ?? encodedValue;
    try {
      const decoded = sanitizeDownloadFilename(decodeURIComponent(valueToDecode));
      if (decoded) return decoded;
    } catch {
      const undecoded = sanitizeDownloadFilename(valueToDecode);
      if (undecoded) return undecoded;
    }
  }

  const quotedMatch = /(?:^|;)\s*filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(header);
  const unquotedMatch = /(?:^|;)\s*filename\s*=\s*([^;]+)/i.exec(header);
  const fallback = quotedMatch?.[1].replace(/\\"/g, '"') ?? unquotedMatch?.[1].trim();
  return fallback ? sanitizeDownloadFilename(fallback) : null;
};

const readInvoiceDownloadError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.clone().json() as { message?: unknown; error?: unknown };
    const message = typeof payload.message === 'string'
      ? payload.message
      : typeof payload.error === 'string'
        ? payload.error
        : '';
    if (message.trim()) return message.trim();
  } catch {
    // The endpoint may return plain text for proxy or framework-level errors.
  }

  try {
    const text = await response.text();
    if (text.trim()) return text.trim();
  } catch {
    // Fall through to the status-based message below.
  }

  return response.statusText || 'Unable to download this invoice.';
};

/**
 * Download the authenticated user's authorized invoice as the server-generated
 * CSV. Resolves with the actual saved filename so callers can report success.
 */
export const downloadInvoiceCsv = async (invoiceId: string | number): Promise<string> => {
  const normalizedId = String(invoiceId).trim();
  if (!normalizedId) {
    throw new Error('An invoice ID is required to download an invoice.');
  }

  const response = await fetch(`${API_BASE_URL}/api/invoices/${encodeURIComponent(normalizedId)}/download`, {
    headers: {
      ...buildHeaders(),
      Accept: 'text/csv, application/json',
    },
  });

  if (!response.ok) {
    throw new Error(await readInvoiceDownloadError(response));
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('The downloaded invoice file was empty.');
  }

  const headerFilename = parseContentDispositionFilename(response.headers.get('content-disposition'));
  const fallbackReference = sanitizeDownloadFilename(normalizedId) || 'invoice';
  const baseFilename = headerFilename || `invoice-${fallbackReference}.csv`;
  const filename = /\.csv$/i.test(baseFilename) ? baseFilename : `${baseFilename}.csv`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  return filename;
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

/**
 * Send a payment reminder for an invoice.
 *
 * Sales reps hit their own prefixed route; admins, superadmins and editing
 * managers share the admin one. The backend delegates to the same sender the
 * scheduled reminder sweep uses, so a manual reminder is identical to an
 * automatic one and is recorded the same way.
 */
export const sendInvoicePaymentReminder = async (
  invoiceId: string | number,
  options: { asSalesRep?: boolean } = {}
): Promise<{ message: string; sent_at?: string }> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const prefix = options.asSalesRep ? 'salesrep' : 'admin';
  const response = await fetch(
    `${API_BASE_URL}/api/${prefix}/invoices/${invoiceId}/send-reminder`,
    {
      method: 'POST',
      headers: buildHeaders(),
    }
  );

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('You do not have permission to send payment reminders');
    }
    // 422 carries a specific, user-meaningful reason (already paid, no contact
    // details, not linked to a shoot) — surface it rather than a generic failure.
    throw new Error(json.message || `Failed to send reminder: ${response.statusText}`);
  }

  return json;
};

export const addInvoiceMiscItem = async (
  invoiceId: string | number,
  payload: { description: string; amount: number; quantity?: number; bills_client?: boolean; charge_type?: string; dedupe_key?: string; shoot_id?: string | number }
): Promise<InvoiceMutationResult> => {
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
  return mapInvoiceMutationResponse(json, invoiceId);
};

export const removeInvoiceMiscItem = async (
  invoiceId: string | number,
  itemId: string | number
): Promise<InvoiceMutationResult> => {
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
  return mapInvoiceMutationResponse(json, invoiceId);
};

export const updateInvoiceMiscItem = async (
  invoiceId: string | number,
  itemId: string | number,
  payload: { description: string; amount: number; quantity?: number; bills_client?: boolean; charge_type?: string; shoot_id?: string | number }
): Promise<InvoiceMutationResult> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/admin/invoices/${invoiceId}/misc-items/${itemId}`,
    {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('You do not have permission to update invoices');
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to update misc item: ${response.statusText}`);
  }

  const json = await response.json();
  return mapInvoiceMutationResponse(json, invoiceId);
};

// ---- Photographer / Sales Rep Invoice Management ----

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

/**
 * Submit a payee-edited weekly invoice to the same admin review queue.
 * "Rejected" is reserved for an invoice an admin has returned to the payee.
 */
export const submitWeeklyInvoiceChangesForApproval = async (
  invoiceId: number,
  role: 'photographer' | 'salesRep',
  changeSummary: string,
): Promise<{ message: string; invoice: WeeklyInvoice }> =>
  submitWeeklyInvoiceForApproval(invoiceId, role, changeSummary);

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
