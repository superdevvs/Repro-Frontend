import type { StudioBillingReview } from '@/types/listingStudioStaff';

export interface StudioRequestConfirmation { reviewId: string; confirmationToken: string; acceptCharges: true }
const key = (accountId: string, requestId: string) => 'repro:listing-studio:request-confirmation:' + accountId + ':' + requestId;
export function readStudioRequestConfirmation(accountId: string, requestId: string): StudioRequestConfirmation | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(accountId, requestId)) ?? 'null') as StudioRequestConfirmation | null;
    return value && typeof value.reviewId === 'string' && typeof value.confirmationToken === 'string' && value.confirmationToken.length > 0 && value.acceptCharges === true ? value : null;
  } catch { return null; }
}
export function rememberStudioRequestConfirmation(accountId: string, requestId: string, review: StudioBillingReview): StudioRequestConfirmation {
  const existing = readStudioRequestConfirmation(accountId, requestId); if (existing) return existing;
  const confirmation: StudioRequestConfirmation = { reviewId: review.reviewId, confirmationToken: review.confirmationToken, acceptCharges: true };
  sessionStorage.setItem(key(accountId, requestId), JSON.stringify(confirmation));
  return confirmation;
}
export function forgetStudioRequestConfirmation(accountId: string, requestId: string) {
  try { sessionStorage.removeItem(key(accountId, requestId)); } catch { /* Server checkout identity still prevents a duplicate charge. */ }
}
