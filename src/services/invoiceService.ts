import { API_BASE_URL } from '@/config/env';
import { InvoiceData } from '@/utils/invoiceUtils';

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

const buildFullAddress = (shoot?: any) => {
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

const mapInvoiceResponse = (invoice: any, fallbackId?: string | number): InvoiceData => {
  const fallbackDate = new Date().toISOString().split('T')[0];
  const issueDate = invoice.issue_date || invoice.billing_period_start || invoice.created_at || fallbackDate;
  const dueDate = invoice.due_date || invoice.billing_period_end || issueDate;
  const baseAmount = parseFloat(invoice.total_amount || invoice.total || invoice.amount || '0');
  const amountPaid = parseFloat(invoice.amount_paid || invoice.paid_amount || '0');
  const balance = parseFloat(
    invoice.balance_due || String(baseAmount - (amountPaid || 0)) || '0'
  );
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber || String(invoice.id || fallbackId || '');
  const isPaid = invoice.is_paid || (invoice.status || '').toLowerCase() === 'paid';
  const overdue = !isPaid && dueDate && new Date(dueDate) < new Date();
  const normalizedStatus = isPaid
    ? 'paid'
    : overdue
      ? 'overdue'
      : (invoice.status || 'pending').toLowerCase();

  const shoot = invoice.shoot;
  const fullAddress = buildFullAddress(shoot);
  const property =
    fullAddress ||
    invoice.property ||
    (typeof shoot?.location === 'string' ? shoot.location : '') ||
    'N/A';

  const services = Array.isArray(invoice.items)
    ? invoice.items
        .filter((item: any) => item?.description)
        .map((item: any) => item.description)
    : invoice.services || [];

  return {
    id: String(invoice.id || fallbackId || ''),
    number: invoiceNumber,
    invoiceNumber,
    client: typeof invoice.client === 'string'
      ? invoice.client
      : invoice.client?.name || shoot?.client?.name || invoice.client_name || 'Unknown Client',
    client_id: invoice.client_id || invoice.client?.id || shoot?.client_id,
    photographer: invoice.photographer?.name || shoot?.photographer?.name || invoice.photographer_name || 'Unassigned',
    photographer_id: invoice.photographer_id || invoice.photographer?.id || shoot?.photographer_id,
    salesRep: invoice.salesRep?.name || invoice.sales_rep_name,
    sales_rep_id: invoice.sales_rep_id,
    amount: baseAmount,
    amountPaid,
    balance,
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
    shootsCount: invoice.shoots_count || (Array.isArray(invoice.shoots) ? invoice.shoots.length : 0),
    shoot_id: invoice.shoot_id,
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
  const invoices: InvoiceData[] = (json.data || []).map((invoice: any) => mapInvoiceResponse(invoice));

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
    payment_details?: Record<string, any> | null;
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
