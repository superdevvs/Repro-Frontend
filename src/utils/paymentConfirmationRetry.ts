import type { StripeConfirmationResult } from './stripeConfirmation';

export const PAYMENT_CONFIRMATION_MAX_ATTEMPTS = 6;
export const PAYMENT_CONFIRMATION_RETRY_DELAY_MS = 2000;

const retryableOutcomes = new Set(['busy', 'unpaid', 'pending', 'not_found']);

function waitForRetry(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, PAYMENT_CONFIRMATION_RETRY_DELAY_MS);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

/** Retry the same checkout while Stripe and the webhook finish recording it. */
export async function confirmPaymentReturnWithRetry<T extends StripeConfirmationResult>(
  confirm: () => Promise<T | null>,
  sessionId: string,
  signal: AbortSignal,
): Promise<T | null> {
  let confirmation: T | null = null;
  for (let attempt = 0; attempt < PAYMENT_CONFIRMATION_MAX_ATTEMPTS && !signal.aborted; attempt += 1) {
    confirmation = await confirm();
    const retryable = !confirmation || (
      confirmation.session_id === sessionId
      && retryableOutcomes.has(confirmation.outcome?.toLowerCase() ?? '')
    );
    if (!retryable || attempt === PAYMENT_CONFIRMATION_MAX_ATTEMPTS - 1 || signal.aborted) break;
    await waitForRetry(signal);
  }
  return confirmation;
}
