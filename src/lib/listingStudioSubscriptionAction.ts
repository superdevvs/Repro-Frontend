import type { StudioSubscriptionActionInput } from '@/types/listingStudioStaff';
export interface PendingStudioSubscriptionAction { input: StudioSubscriptionActionInput; key: string }
const storageKey = (scope: string) => 'repro:listing-studio:subscription-action:' + scope;
export function readStudioSubscriptionAction(scope: string): PendingStudioSubscriptionAction | null {
  try { const value = JSON.parse(sessionStorage.getItem(storageKey(scope)) ?? 'null') as PendingStudioSubscriptionAction | null; return value && typeof value.key === 'string' && /^[0-9a-f-]{36}$/i.test(value.key) && ['schedule_downgrade', 'cancel_renewal', 'undo_cancel', 'undo_downgrade'].includes(value.input?.action) ? value : null; } catch { return null; }
}
export function beginStudioSubscriptionAction(scope: string, input: StudioSubscriptionActionInput): PendingStudioSubscriptionAction {
  const existing = readStudioSubscriptionAction(scope); if (existing) return existing;
  const value = { input, key: crypto.randomUUID() }; sessionStorage.setItem(storageKey(scope), JSON.stringify(value)); return value;
}
export function forgetStudioSubscriptionAction(scope: string) { try { sessionStorage.removeItem(storageKey(scope)); } catch { /* Existing key safely replays the accepted operation. */ } }
