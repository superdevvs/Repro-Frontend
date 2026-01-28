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
  const invoices: InvoiceData[] = (json.data || []).map((invoice: any) => {
    const fallbackDate = new Date().toISOString().split('T')[0];
    const issueDate = invoice.issue_date || invoice.billing_period_start || invoice.created_at || fallbackDate;
    const dueDate = invoice.due_date || invoice.billing_period_end || issueDate;
    const baseAmount = parseFloat(invoice.total_amount || invoice.total || invoice.amount || '0');
    const amountPaid = parseFloat(invoice.amount_paid || invoice.paid_amount || '0');
    const balance = parseFloat(
      invoice.balance_due || String(baseAmount - (amountPaid || 0)) || '0'
    );
    const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber || String(invoice.id || '');
    const isPaid = invoice.is_paid || (invoice.status || '').toLowerCase() === 'paid';
    const overdue = !isPaid && dueDate && new Date(dueDate) < new Date();
    const normalizedStatus = isPaid
      ? 'paid'
      : overdue
        ? 'overdue'
        : (invoice.status || 'pending').toLowerCase();

    const shoot = invoice.shoot;
    const property =
      invoice.property ||
      shoot?.location?.fullAddress ||
      shoot?.address ||
      shoot?.location ||
      'N/A';

    const services = Array.isArray(invoice.items)
      ? invoice.items
          .filter((item: any) => item?.description)
          .map((item: any) => item.description)
      : invoice.services || [];

    return {
      id: String(invoice.id || ''),
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
      notes: invoice.notes || undefined,
      shootsCount: invoice.shoots_count || (Array.isArray(invoice.shoots) ? invoice.shoots.length : 0),
      shoot_id: invoice.shoot_id,
      shoot,
      property,
      services,
      items: invoice.items,
    };
  });

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
  data: { amount_paid?: number; paid_at?: string }
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

  const fallbackDate = new Date().toISOString().split('T')[0];
  const issueDate = invoice.issue_date || invoice.billing_period_start || invoice.created_at || fallbackDate;
  const dueDate = invoice.due_date || invoice.billing_period_end || issueDate;
  const baseAmount = parseFloat(invoice.total_amount || invoice.total || invoice.amount || '0');
  const amountPaid = parseFloat(invoice.amount_paid || invoice.paid_amount || '0');
  const balance = parseFloat(
    invoice.balance_due || String(baseAmount - (amountPaid || 0)) || '0'
  );
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber || String(invoice.id || invoiceId);
  const shoot = invoice.shoot;
  const property =
    invoice.property ||
    shoot?.location?.fullAddress ||
    shoot?.address ||
    shoot?.location ||
    'N/A';
  const services = Array.isArray(invoice.items)
    ? invoice.items
        .filter((item: any) => item?.description)
        .map((item: any) => item.description)
    : invoice.services || [];
  const status = invoice.is_paid ? 'paid' : (invoice.status || 'pending').toLowerCase();

  return {
    id: String(invoice.id || invoiceId),
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
    status: (status as InvoiceData['status']) || 'pending',
    date: issueDate,
    dueDate,
    issueDate,
    billingPeriodStart: invoice.billing_period_start || invoice.period_start,
    billingPeriodEnd: invoice.billing_period_end || invoice.period_end,
    createdAt: invoice.created_at || fallbackDate,
    paidAt: invoice.paid_at,
    paymentMethod: invoice.payment_method || invoice.paymentMethod || 'N/A',
    notes: invoice.notes || undefined,
    shootsCount: invoice.shoots_count || (Array.isArray(invoice.shoots) ? invoice.shoots.length : 0),
    shoot_id: invoice.shoot_id,
    shoot,
    property,
    services,
    items: invoice.items,
  };
};
