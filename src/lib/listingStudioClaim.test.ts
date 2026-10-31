import { afterEach, describe, expect, it } from 'vitest';
import { captureListingStudioClaimLocation, forgetListingStudioClaim, readListingStudioClaim, rememberListingStudioClaim } from './listingStudioClaim';

afterEach(() => {
  const token = readListingStudioClaim();
  if (token) forgetListingStudioClaim(token);
  window.history.replaceState(null, '', '/');
});

describe('early Listing Studio token capture', () => {
  it('removes the token before the router starts and retains the history entry state', () => {
    const token = 'e'.repeat(64);
    window.history.replaceState({ marker: true }, '', `/listing-studio/claim?source=website#${token}`);
    captureListingStudioClaimLocation();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/listing-studio/claim');
    expect(window.history.state).toEqual({ marker: true });
    expect(readListingStudioClaim()).toBe(token);
  });
  it('leaves unrelated route fragments unchanged', () => {
    window.history.replaceState(null, '', '/dashboard#guide');
    captureListingStudioClaimLocation();
    expect(window.location.hash).toBe('#guide');
    expect(readListingStudioClaim()).toBeNull();
  });
  it('cannot replay an older pending claim when a new handoff is malformed', () => {
    rememberListingStudioClaim(`#${'e'.repeat(64)}`);
    rememberListingStudioClaim('#bad');
    expect(readListingStudioClaim()).toBeNull();
  });
});
