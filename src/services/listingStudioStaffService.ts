import { apiClient } from './api';
import type { StudioCatalog, StudioFundingMethod, StudioOrderCreation, StudioQuote, StudioQuoteInput, StudioUpload } from '@/types/listingStudioClient';
import type { StudioManagedAccount, StudioManagedClients, StudioBillingRequest, StudioBillingRequestInput, StudioBillingRequests, StudioSubscriptionActionInput, StudioSubscriptionActionResult, StudioManagedOrder, StudioManagedOrdersPage } from '@/types/listingStudioStaff';

interface Envelope<T> { success: boolean; data: T }
const root = '/listing-studio/staff/clients';
const clientPath = (id: string) => root + '/' + encodeURIComponent(id);
const idempotency = (key: string) => ({ headers: { 'Idempotency-Key': key } });

export const listingStudioStaff = {
  async clients(q = '', page = 1, signal?: AbortSignal) {
    const query = q.trim();
    return (await apiClient.get<Envelope<StudioManagedClients>>(root, { params: { ...(query ? { q: query } : {}), page }, signal })).data.data;
  },
  async account(clientId: string, signal?: AbortSignal) { return (await apiClient.get<Envelope<StudioManagedAccount>>(clientPath(clientId) + '/account', { signal })).data.data; },
  async catalog(clientId: string, signal?: AbortSignal) { return (await apiClient.get<Envelope<StudioCatalog>>(clientPath(clientId) + '/catalog', { signal })).data.data; },
  async orders(clientId: string, page = 1, signal?: AbortSignal) { return (await apiClient.get<Envelope<StudioManagedOrdersPage>>(clientPath(clientId) + '/orders', { params: { page, perPage: 12 }, signal })).data.data; },
  async order(clientId: string, orderId: string, signal?: AbortSignal) { return (await apiClient.get<Envelope<{ order: StudioManagedOrder }>>(clientPath(clientId) + '/orders/' + encodeURIComponent(orderId), { signal })).data.data.order; },
  async upload(clientId: string, file: File, key: string) {
    const form = new FormData(); form.append('photo', file);
    return (await apiClient.post<Envelope<{ upload: StudioUpload }>>(clientPath(clientId) + '/uploads', form, idempotency(key))).data.data.upload;
  },
  async quote(clientId: string, input: StudioQuoteInput) { return (await apiClient.post<Envelope<{ quote: StudioQuote }>>(clientPath(clientId) + '/quotes', input)).data.data.quote; },
  async createOrder(clientId: string, quoteId: string, fundingMethod: StudioFundingMethod, key: string) { return (await apiClient.post<Envelope<StudioOrderCreation>>(clientPath(clientId) + '/orders', { quoteId, fundingMethod, ...(fundingMethod === 'credits' ? { creditConsent: true } : {}) }, idempotency(key))).data.data; },
  async requests(clientId: string, page = 1, signal?: AbortSignal) { return (await apiClient.get<Envelope<StudioBillingRequests>>(clientPath(clientId) + '/billing-requests', { params: { page }, signal })).data.data; },
  async request(clientId: string, id: string, signal?: AbortSignal) { return (await apiClient.get<Envelope<{ request: StudioBillingRequest }>>(clientPath(clientId) + '/billing-requests/' + encodeURIComponent(id), { signal })).data.data.request; },
  async createRequest(clientId: string, input: StudioBillingRequestInput, key: string) { return (await apiClient.post<Envelope<{ request: StudioBillingRequest; created: boolean }>>(clientPath(clientId) + '/billing-requests', input, idempotency(key))).data.data; },
  async emailRequest(clientId: string, id: string, key: string) { return (await apiClient.post<Envelope<{ request: StudioBillingRequest; delivery: { status: string; created: boolean } }>>(clientPath(clientId) + '/billing-requests/' + encodeURIComponent(id) + '/email', {}, idempotency(key))).data.data; },
  async cancelRequest(clientId: string, id: string, key: string) { return (await apiClient.post<Envelope<{ request: StudioBillingRequest }>>(clientPath(clientId) + '/billing-requests/' + encodeURIComponent(id) + '/cancel', {}, idempotency(key))).data.data.request; },
  async subscriptionAction(clientId: string, input: StudioSubscriptionActionInput, key: string) { return (await apiClient.post<Envelope<StudioSubscriptionActionResult>>(clientPath(clientId) + '/subscription-actions', input, idempotency(key))).data.data; },
};
