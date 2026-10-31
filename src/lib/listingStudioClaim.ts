export const LISTING_STUDIO_CLAIM_PATH = '/listing-studio/claim';
const STORAGE_KEY = 'listing-studio.pending-claim';
let memoryToken: string | null = null;

/** Run before dashboard providers or the router inspect an external handoff. */
export function captureListingStudioClaimLocation(): void {
  if (window.location.pathname !== LISTING_STUDIO_CLAIM_PATH) return;
  if (window.location.hash) rememberListingStudioClaim(window.location.hash);
  if (window.location.hash || window.location.search) {
    window.history.replaceState(window.history.state, '', LISTING_STUDIO_CLAIM_PATH);
  }
}

export function rememberListingStudioClaim(hash: string): void {
  const value = hash.replace(/^#/, '');
  // Accept the plain fragment and the named form used by website handoffs.
  const token = value.startsWith('token=') ? new URLSearchParams(value).get('token') : value;
  if (!token || !/^[A-Za-z0-9_-]{32,512}$/.test(token)) {
    const previous = readListingStudioClaim();
    if (previous) forgetListingStudioClaim(previous);
    return;
  }
  memoryToken = token;
  try { sessionStorage.setItem(STORAGE_KEY, token); } catch { /* Same-tab navigation still works without storage. */ }
}

export function readListingStudioClaim(): string | null {
  try { return sessionStorage.getItem(STORAGE_KEY) || memoryToken; } catch { return memoryToken; }
}

export function forgetListingStudioClaim(token: string): void {
  if (memoryToken === token) memoryToken = null;
  try {
    if (sessionStorage.getItem(STORAGE_KEY) === token) sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* Storage can be disabled in private browsers. */ }
}
