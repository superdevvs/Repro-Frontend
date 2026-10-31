import { apiClient } from './api';
import type { StudioAccount, StudioCatalog, StudioCheckout, StudioFundingMethod, StudioOrder, StudioOrderCreation, StudioOrdersPage, StudioQuote, StudioQuoteInput, StudioTransactionsPage, StudioUpload } from '@/types/listingStudioClient';

interface Envelope<T> { success: boolean; data: T }
const root = '/listing-studio/client';
const orderPath = (id: string) => `${root}/orders/${encodeURIComponent(id)}`;
const idempotency = (key: string) => ({ headers: { 'Idempotency-Key': key } });

export const listingStudioClient = {
  async catalog() { return (await apiClient.get<Envelope<StudioCatalog>>(`${root}/catalog`)).data.data; },
  async account() { return (await apiClient.get<Envelope<StudioAccount>>(`${root}/account`)).data.data; },
  async orders(page = 1) { return (await apiClient.get<Envelope<StudioOrdersPage>>(`${root}/orders`, { params: { page, perPage: 12 } })).data.data; },
  async order(id: string) { return (await apiClient.get<Envelope<{ order: StudioOrder }>>(orderPath(id))).data.data.order; },
  async transactions(page = 1) { return (await apiClient.get<Envelope<StudioTransactionsPage>>(`${root}/transactions`, { params: { page, perPage: 20 } })).data.data; },
  async upload(file: File, key: string) {
    const form = new FormData(); form.append('photo', file);
    return (await apiClient.post<Envelope<{ upload: StudioUpload }>>(`${root}/uploads`, form, idempotency(key))).data.data.upload;
  },
  async quote(input: StudioQuoteInput) { return (await apiClient.post<Envelope<{ quote: StudioQuote }>>(`${root}/quotes`, input)).data.data.quote; },
  async createOrder(quoteId: string, fundingMethod: StudioFundingMethod, key: string) {
    return (await apiClient.post<Envelope<StudioOrderCreation>>(`${root}/orders`, { quoteId, fundingMethod }, idempotency(key))).data.data;
  },
  async checkout(id: string, key: string) { return (await apiClient.post<Envelope<StudioCheckout>>(`${orderPath(id)}/checkout`, {}, idempotency(key))).data.data; },
  async cancelOrder(id: string) { return (await apiClient.post<Envelope<{ order: StudioOrder; nextAction: { type: 'none' } }>>(`${orderPath(id)}/cancel`)).data.data.order; },
  async subscriptionCheckout(planCode: string, key: string) {
    return (await apiClient.post<Envelope<StudioCheckout>>(`${root}/subscription-checkout`, { planCode }, idempotency(key))).data.data;
  },
  async billingPortal() { return (await apiClient.post<Envelope<StudioCheckout>>(`${root}/billing-portal`)).data.data; },
  preview(id: string, variant: 'original' | 'result', signal?: AbortSignal) {
    return studioImageBlob(`${orderPath(id)}/preview`, { variant }, signal);
  },
  uploadPreview(id: string, signal?: AbortSignal) { return studioImageBlob(`${root}/uploads/${encodeURIComponent(id)}/preview`, undefined, signal); },
  async download(order: Pick<StudioOrder, 'id' | 'service'>) {
    const blob = await studioImageBlob(`${orderPath(order.id)}/download`);
    saveStudioBlob(blob, `listing-studio-${order.service}`);
  },
};

export async function studioImageBlob(path: string, params?: Record<string, string>, signal?: AbortSignal): Promise<Blob> {
  try {
    const blob = (await apiClient.get<Blob>(path, { responseType: 'blob', params, signal, headers: { Accept: 'image/jpeg, image/png, image/webp' } })).data;
    if (!(blob instanceof Blob) || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || !blob.size) throw new Error('This photo is not available.');
    return blob;
  } catch (error) {
    const response = (error as { response?: { data?: unknown } })?.response;
    if (response?.data instanceof Blob && response.data.type.includes('json')) {
      try { response.data = JSON.parse(await response.data.text()); } catch { /* Preserve the safe API fallback. */ }
    }
    throw error;
  }
}

export function saveStudioBlob(blob: Blob, name: string) {
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[blob.type];
  if (!extension || !blob.size) throw new Error('This photo is not available.');
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `${name}.${extension}`; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function studioCheckoutUrl(value: string | null | undefined): string {
  if (!value) throw new Error('Checkout is not ready. Refresh this order to check its status.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname) || url.username || url.password || url.port) {
    throw new Error('The payment link could not be verified. Please try again.');
  }
  return url.href;
}
