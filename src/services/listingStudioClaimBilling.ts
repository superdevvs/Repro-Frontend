import { apiClient } from './api';
import type { StudioAccount, StudioCatalog, StudioCheckout } from '@/types/listingStudioClient';

export interface StudioClaimBilling {
  account: StudioAccount; catalog: StudioCatalog;
  pendingCheckout: { planCode: string; status: string; requestKey: string; expiresAt: string | null } | null;
  confirmationEmail: { status: string; sentAt: string | null } | null;
}
interface Envelope<T> { success: boolean; data: T }
const root = '/listing-studio/trials/billing';

/** Same account/financial services, narrowly available on the verification-exempt claim page. */
export const listingStudioClaimBilling = {
  async summary(signal?: AbortSignal) { return (await apiClient.get<Envelope<StudioClaimBilling>>(root, { signal })).data.data; },
  async checkout(planCode: string, key: string) { return (await apiClient.post<Envelope<StudioCheckout>>(`${root}/subscription-checkout`, { planCode }, { headers: { 'Idempotency-Key': key } })).data.data; },
  async portal() { return (await apiClient.post<Envelope<StudioCheckout>>(`${root}/portal`)).data.data; },
};
