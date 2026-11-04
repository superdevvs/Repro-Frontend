type ReturnStatus = 'returned' | 'cancelled';
const key = 'listing-studio.billing-return';
let memoryStatus: ReturnStatus | null = null;

export function rememberStudioClaimCheckoutReturn(search: string) {
  const status = new URLSearchParams(search).get('checkout');
  if (status !== 'returned' && status !== 'cancelled') return;
  memoryStatus = status;
  try { sessionStorage.setItem(key, status); } catch { /* Only a display hint; payment evidence stays on the server. */ }
}
export function readStudioClaimCheckoutReturn(): ReturnStatus | null {
  let status: string | null = memoryStatus;
  try { status = sessionStorage.getItem(key) || status; } catch { /* Private browsing can disable storage. */ }
  return status === 'returned' || status === 'cancelled' ? status : null;
}
export function forgetStudioClaimCheckoutReturn() {
  memoryStatus = null;
  try { sessionStorage.removeItem(key); } catch { /* No financial effect. */ }
}
