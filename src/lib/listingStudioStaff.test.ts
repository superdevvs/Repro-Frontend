import { beforeEach, describe, expect, it } from 'vitest';
import { studioClientPaymentUrl, studioManagedActionScope, studioPaymentRequestUrl } from './listingStudioStaff';
import { beginStudioSubscriptionAction, readStudioSubscriptionAction } from './listingStudioSubscriptionAction';
import { billingRequest } from '@/components/listing-studio/staff/staffFixtures.test-data';

beforeEach(() => sessionStorage.clear());
describe('billing context boundaries', () => {
  it('accepts only the exact same-origin request review route for sharing', () => {
    expect(studioPaymentRequestUrl(billingRequest.appUrl, billingRequest.id)).toBe(window.location.origin + billingRequest.appUrl);
    for (const value of ['https://checkout.stripe.com/c/pay/a', 'https://evil.test' + billingRequest.appUrl, billingRequest.appUrl + '?token=secret', '/listing-studio/payment-requests/22222222-2222-4222-8222-222222222222']) expect(() => studioPaymentRequestUrl(value, billingRequest.id)).toThrow();
  });
  it('allows only client checkout and invoice HTTPS hosts', () => {
    expect(studioClientPaymentUrl('https://checkout.stripe.com/c/pay/test')).toContain('checkout.stripe.com'); expect(studioClientPaymentUrl('https://invoice.stripe.com/i/test')).toContain('invoice.stripe.com');
    for (const url of ['http://invoice.stripe.com/i/a', 'https://invoice.stripe.com.evil.test/i/a', 'https://user@checkout.stripe.com/c/a', 'https://checkout.stripe.com:444/c/a']) expect(() => studioClientPaymentUrl(url)).toThrow();
  });
  it('keeps unresolved subscription actions tied to actor and beneficiary', () => {
    const scope = studioManagedActionScope('9', '42'); const original = beginStudioSubscriptionAction(scope, { action: 'cancel_renewal' });
    expect(beginStudioSubscriptionAction(scope, { action: 'schedule_downgrade', planCode: 'starter' })).toEqual(original);
    expect(readStudioSubscriptionAction(studioManagedActionScope('10', '42'))).toBeNull(); expect(readStudioSubscriptionAction(studioManagedActionScope('9', '43'))).toBeNull();
  });
});
