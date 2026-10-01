import { apiClient } from './api';

export type ListingStudioRequestType = 'signup' | 'call' | 'change';
export type ListingStudioStatus = 'pending' | 'approved' | 'declined' | 'completed';
export interface ListingStudioContact {
  id?: number;
  name: string;
  email: string;
  phone?: string | null;
  company_name?: string | null;
}
export interface ListingStudioCatalog {
  plans: { code: string; name: string; reference_price_usd: number | null }[];
  services: { code: string; name: string }[];
}
export interface ListingStudioRequest {
  id: number;
  type: ListingStudioRequestType;
  status: ListingStudioStatus;
  client_id: number | null;
  client: ListingStudioContact | null;
  contact: ListingStudioContact;
  plan_code: string | null;
  services: string[];
  details: string | null;
  phone: string | null;
  preferred_time: string | null;
  review_note: string | null;
  reviewed_by: { id: number; name: string } | null;
  reviewed_at: string | null;
  created_at: string;
  submitted_by: { id: number; name: string } | null;
}
export interface ListingStudioRequestInput {
  type: ListingStudioRequestType;
  client_id?: number;
  custom_client?: ListingStudioContact;
  plan_code?: string;
  services?: string[];
  details?: string;
  phone?: string;
  preferred_time?: string;
  idempotency_key: string;
}
export interface ListingStudioRequestPage {
  data: ListingStudioRequest[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
}

export interface ListingStudioSubscription {
  id: number;
  client_id: number | null;
  client: Pick<ListingStudioContact, 'id' | 'name' | 'email'> | null;
  customer: { name: string | null; email: string | null };
  plan_code: 'starter' | 'pro' | 'studio' | null;
  plan_name: string | null;
  status: string;
  sync_status: 'synced' | 'needs_attention' | 'awaiting_payment';
  attention_reason: string | null;
  amount_cents: number | null;
  currency: string | null;
  billing_interval: string | null;
  billing_interval_count: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  latest_invoice_status: string | null;
  last_paid_at: string | null;
  account_created: boolean;
  account_setup_status: 'pending' | 'sent' | 'needs_attention' | null;
  account_setup_attention: string | null;
  latest_refund: { status: string; amount_cents: number; currency: string; created_at: string } | null;
  credits: {
    currency: 'usd';
    available_cents: number;
    earned_cents: number;
    used_cents: number;
    expires_at: string | null;
    monthly_allowance_cents: number;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ListingStudioSubscriptionPage {
  data: ListingStudioSubscription[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
}

export const listingStudioService = {
  async catalog(): Promise<ListingStudioCatalog> {
    return (await apiClient.get('/listing-studio/catalog')).data.data;
  },
  async clients(search: string): Promise<ListingStudioContact[]> {
    return (await apiClient.get('/listing-studio/clients', { params: { q: search } })).data.data;
  },
  async requests(page = 1): Promise<ListingStudioRequestPage> {
    return (await apiClient.get('/listing-studio/requests', { params: { page } })).data;
  },
  async subscriptions(page = 1, q = '', status = ''): Promise<ListingStudioSubscriptionPage> {
    return (await apiClient.get('/listing-studio/subscriptions', { params: { page, q, status } })).data;
  },
  async create(input: ListingStudioRequestInput): Promise<ListingStudioRequest> {
    return (await apiClient.post('/listing-studio/requests', input)).data.data;
  },
  async review(id: number, input: { status: Exclude<ListingStudioStatus, 'pending'>; review_note?: string }): Promise<ListingStudioRequest> {
    return (await apiClient.patch(`/listing-studio/requests/${id}`, input)).data.data;
  },
};

export const listingStudioError = (error: unknown): string => {
  const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  return Object.values(response?.errors ?? {}).flat()[0] || response?.message || 'Unable to save your request. Please try again.';
};
