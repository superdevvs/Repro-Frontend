import { afterEach, describe, expect, it } from 'vitest';
import { forgetStudioClaimCheckoutReturn, readStudioClaimCheckoutReturn, rememberStudioClaimCheckoutReturn } from './listingStudioClaimCheckout';
afterEach(forgetStudioClaimCheckoutReturn);
describe('safe billing return hint', () => {
  it.each(['returned', 'cancelled'])('retains only the exact %s hint', status => {
    rememberStudioClaimCheckoutReturn(`?checkout=${status}&token=secret&returnTo=https://evil.test`);
    expect(readStudioClaimCheckoutReturn()).toBe(status);
    expect(sessionStorage.getItem('listing-studio.billing-return')).toBe(status);
    forgetStudioClaimCheckoutReturn(); expect(readStudioClaimCheckoutReturn()).toBeNull();
  });
  it('ignores arbitrary payment and redirect claims', () => {
    rememberStudioClaimCheckoutReturn('?checkout=paid&plan=studio&credits=375&url=https://evil.test');
    expect(readStudioClaimCheckoutReturn()).toBeNull();
  });
});
