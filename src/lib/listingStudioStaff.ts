const requestId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isStudioPaymentRequestId = (value?: string): value is string => Boolean(value && requestId.test(value));
export const studioManagedScope = (actorId: string, clientId: string) => ['studio-managed-client', actorId, clientId] as const;
export const studioManagedActionScope = (actorId: string, clientId: string) => 'staff:' + actorId + ':client:' + clientId;

/** Only an owned application review URL may be exposed by the staff UI. */
export function studioPaymentRequestUrl(value: string, id: string): string {
  if (!isStudioPaymentRequestId(id)) throw new Error('The payment request link is not valid.');
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || url.username || url.password || url.search || url.hash
      || url.pathname !== '/listing-studio/payment-requests/' + id) {
    throw new Error('The payment request link could not be verified. Refresh this request before sharing it.');
  }
  return url.href;
}

export function studioClientPaymentUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['checkout.stripe.com', 'invoice.stripe.com'].includes(url.hostname) || url.username || url.password || url.port) {
    throw new Error('The payment link could not be verified. Refresh this request before continuing.');
  }
  return url.href;
}
