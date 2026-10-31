import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { listingStudioStaff } from './listingStudioStaffService';
import { listingStudioPaymentRequests } from './listingStudioPaymentRequestService';
vi.mock('./api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: { request: {}, order: {} } } }); vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { request: {}, order: {}, upload: {} } } }); });
describe('explicit beneficiary billing API', () => {
  it('reads the selected client account with cancellation support', async () => { const signal = new AbortController().signal; await listingStudioStaff.account('42', signal); expect(apiClient.get).toHaveBeenCalledWith('/listing-studio/staff/clients/42/account', { signal }); });
  it('adds explicit credit consent only for delegated credit-funded orders', async () => {
    await listingStudioStaff.createOrder('42', 'quote-id', 'credits', 'same-key');
    expect(apiClient.post).toHaveBeenLastCalledWith('/listing-studio/staff/clients/42/orders', { quoteId: 'quote-id', fundingMethod: 'credits', creditConsent: true }, { headers: { 'Idempotency-Key': 'same-key' } });
    await listingStudioStaff.createOrder('42', 'quote-id', 'card', 'same-key');
    expect(apiClient.post).toHaveBeenLastCalledWith('/listing-studio/staff/clients/42/orders', { quoteId: 'quote-id', fundingMethod: 'card' }, { headers: { 'Idempotency-Key': 'same-key' } });
  });
  it('creates only a local request and does not accept an arbitrary email recipient', async () => {
    await listingStudioStaff.createRequest('42', { kind: 'subscription_purchase', planCode: 'pro' }, 'request-key');
    expect(apiClient.post).toHaveBeenLastCalledWith('/listing-studio/staff/clients/42/billing-requests', { kind: 'subscription_purchase', planCode: 'pro' }, { headers: { 'Idempotency-Key': 'request-key' } });
    await listingStudioStaff.emailRequest('42', 'request-id', 'email-key');
    expect(apiClient.post).toHaveBeenLastCalledWith('/listing-studio/staff/clients/42/billing-requests/request-id/email', {}, { headers: { 'Idempotency-Key': 'email-key' } });
  });
  it('keeps client approval on the own-client endpoint and sends the exact scoped review', async () => { const approval = { reviewId: 'review-id', confirmationToken: 'review-token', acceptCharges: true as const }; await listingStudioPaymentRequests.confirm('request-id', approval); expect(apiClient.post).toHaveBeenLastCalledWith('/listing-studio/client/billing-requests/request-id/confirm', approval); });
  it('sends subscription management through a stable action key', async () => { await listingStudioStaff.subscriptionAction('42', { action: 'schedule_downgrade', planCode: 'starter' }, 'action-key'); expect(apiClient.post).toHaveBeenLastCalledWith('/listing-studio/staff/clients/42/subscription-actions', { action: 'schedule_downgrade', planCode: 'starter' }, { headers: { 'Idempotency-Key': 'action-key' } }); });
});
