import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { listingStudioClient, studioCheckoutUrl, studioImageBlob } from './listingStudioClientService';

vi.mock('./api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe('Studio private API boundary', () => {
  it('uses the same quote, funding and idempotency key for an order retry', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { order: { id: 'order' }, created: false, nextAction: { type: 'await_processing' } } } });
    await listingStudioClient.createOrder('quote', 'credits', 'stable-key');
    expect(apiClient.post).toHaveBeenCalledWith('/listing-studio/client/orders', { quoteId: 'quote', fundingMethod: 'credits' }, { headers: { 'Idempotency-Key': 'stable-key' } });
  });
  it('requests previews through authenticated relative routes, as blobs', async () => {
    const blob = new Blob(['image'], { type: 'image/jpeg' }); vi.mocked(apiClient.get).mockResolvedValue({ data: blob });
    const controller = new AbortController();
    expect(await listingStudioClient.preview('owned-order', 'original', controller.signal)).toBe(blob);
    expect(apiClient.get).toHaveBeenCalledWith('/listing-studio/client/orders/owned-order/preview', expect.objectContaining({ responseType: 'blob', params: { variant: 'original' }, signal: controller.signal }));
  });
  it('rejects HTML and empty responses instead of treating them as photos', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: new Blob(['<html>'], { type: 'text/html' }) }).mockResolvedValueOnce({ data: new Blob([], { type: 'image/jpeg' }) });
    await expect(studioImageBlob('/private')).rejects.toThrow('not available');
    await expect(studioImageBlob('/private')).rejects.toThrow('not available');
  });
});
describe('Studio checkout navigation', () => {
  it.each(['https://checkout.stripe.com/c/pay/cs_test_example', 'https://billing.stripe.com/p/session/test_example'])('allows a pinned Stripe destination: %s', url => expect(studioCheckoutUrl(url)).toBe(url));
  it.each(['http://checkout.stripe.com/c/pay/example', 'https://checkout.stripe.com.evil.test/', 'https://example.test/', 'javascript:alert(1)', 'https://name:password@checkout.stripe.com/', 'https://checkout.stripe.com:8443/'])('rejects an unexpected destination: %s', url => expect(() => studioCheckoutUrl(url)).toThrow());
});
