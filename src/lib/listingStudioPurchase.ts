import type { StudioFundingMethod } from '@/types/listingStudioClient';

export interface StudioPurchaseAttempt { accountId: string; quoteId: string; fundingMethod: StudioFundingMethod; key: string }
const prefix = 'repro:listing-studio:purchase:';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readStudioPurchase(accountId: string): StudioPurchaseAttempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(prefix + accountId) ?? 'null') as StudioPurchaseAttempt | null;
    return value && value.accountId === accountId && uuid.test(value.quoteId) && uuid.test(value.key)
      && (value.fundingMethod === 'credits' || value.fundingMethod === 'card') ? value : null;
  } catch { return null; }
}
export function beginStudioPurchase(accountId: string, quoteId: string, fundingMethod: StudioFundingMethod): StudioPurchaseAttempt {
  const pending = readStudioPurchase(accountId);
  if (pending) return pending;
  const attempt = { accountId, quoteId, fundingMethod, key: crypto.randomUUID() };
  // Fail before creating an order if refresh recovery cannot be persisted.
  sessionStorage.setItem(prefix + accountId, JSON.stringify(attempt));
  return attempt;
}
export function forgetStudioPurchase(accountId: string, key: string) {
  try { if (readStudioPurchase(accountId)?.key === key) sessionStorage.removeItem(prefix + accountId); } catch { /* A replay can still recover the settled order. */ }
}
export function studioActionKey(accountId: string, action: string): string {
  const storageKey = `repro:listing-studio:action:${accountId}:${action}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing && uuid.test(existing)) return existing;
  const key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); return key;
}
export function forgetStudioAction(accountId: string, action: string) {
  try { sessionStorage.removeItem(`repro:listing-studio:action:${accountId}:${action}`); } catch { /* Do not interrupt a completed checkout while clearing local state. */ }
}
