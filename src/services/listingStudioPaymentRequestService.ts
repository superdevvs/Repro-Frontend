import { apiClient } from './api';
import type { StudioBillingConfirmation, StudioBillingRequest, StudioBillingRequestReview } from '@/types/listingStudioStaff';

interface Envelope<T> { success: boolean; data: T }
const path = (id: string) => '/listing-studio/client/billing-requests/' + encodeURIComponent(id);
export const listingStudioPaymentRequests = {
  async review(id: string, signal?: AbortSignal) { return (await apiClient.get<Envelope<StudioBillingRequestReview>>(path(id), { signal })).data.data; },
  async confirm(id: string, input: { reviewId: string; confirmationToken: string; acceptCharges: true }) { return (await apiClient.post<Envelope<StudioBillingConfirmation>>(path(id) + '/confirm', input)).data.data; },
  async cancel(id: string, key: string) { return (await apiClient.post<Envelope<{ request: StudioBillingRequest }>>(path(id) + '/cancel', {}, { headers: { 'Idempotency-Key': key } })).data.data.request; },
};
