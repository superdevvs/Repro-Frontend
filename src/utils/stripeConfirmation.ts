export type StripeConfirmationOutcome =
  | 'processed'
  | 'already_processed'
  | 'unpaid'
  | 'mismatch'
  | 'busy'
  | 'not_found'
  | 'refunded_stale';

export type StripeConfirmationResult = {
  reconciled?: boolean | null;
  outcome?: StripeConfirmationOutcome | string | null;
  session_payment_status?: string | null;
  payment_recorded?: boolean | null;
  session_id?: string | null;
  last_payment_amount?: number | string | null;
  return_to?: string | null;
  payment_status?: string | null;
  remaining_balance?: number | string | null;
  total_paid?: number | string | null;
  payment_refunded?: boolean | null;
  message?: string | null;
};

/** Validate the common confirmation contract before interpreting a response. */
export function readStripeConfirmation(value: unknown): StripeConfirmationResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.session_id !== 'string'
    || ['outcome', 'session_payment_status', 'message', 'return_to'].some(key => record[key] != null && typeof record[key] !== 'string')
    || ['payment_recorded', 'payment_refunded', 'reconciled'].some(key => record[key] != null && typeof record[key] !== 'boolean')) return null;
  return record as StripeConfirmationResult;
}

/** A processing error is not proof that Stripe failed to collect a payment. */
export function isStripeConfirmationPending(
  result: StripeConfirmationResult | null | undefined,
  expectedSessionId: string | null | undefined,
): boolean {
  if (!expectedSessionId) return false;
  if (!result) return true;
  if (result.session_id !== expectedSessionId) return false;
  const outcome = typeof result.outcome === 'string' ? result.outcome.toLowerCase() : '';
  const paymentStatus = typeof result.session_payment_status === 'string' ? result.session_payment_status.toLowerCase() : '';
  return ['busy', 'pending', 'unpaid', 'not_found', 'failed'].includes(outcome)
    || (paymentStatus === 'paid' && ['expired', 'cancelled', 'canceled', 'declined'].includes(outcome))
    || (outcome === 'declined' && paymentStatus !== 'unpaid');
}

const RECORDED_OUTCOMES = new Set<StripeConfirmationOutcome>([
  'processed',
  'already_processed',
]);

/**
 * A positive amount or a lower aggregate shoot balance is not proof that this
 * Checkout Session paid successfully. Only accept an outcome tied to the exact
 * session the frontend created.
 */
export const isStripeSessionPaymentRecorded = (
  confirmation: StripeConfirmationResult | null | undefined,
  expectedSessionId: string | null | undefined,
): boolean => {
  if (!confirmation || !expectedSessionId || confirmation.session_id !== expectedSessionId) {
    return false;
  }

  const outcome = (confirmation.outcome ?? '').toString().toLowerCase();
  const sessionPaymentStatus = (confirmation.session_payment_status ?? '').toString().toLowerCase();
  const hasRecordedOutcome = RECORDED_OUTCOMES.has(outcome as StripeConfirmationOutcome);

  if (sessionPaymentStatus) {
    return sessionPaymentStatus === 'paid'
      && confirmation.payment_recorded === true
      && hasRecordedOutcome;
  }

  // Compatibility with the pre-outcome backend contract. This is safe for the
  // first processor because reconciliation only succeeds for a paid session.
  return confirmation.reconciled === true;
};

export const isStripeSessionRefundedAsStale = (
  confirmation: StripeConfirmationResult | null | undefined,
  expectedSessionId: string | null | undefined,
): boolean => Boolean(
  confirmation
  && expectedSessionId
  && confirmation.session_id === expectedSessionId
  && confirmation.outcome?.toString().toLowerCase() === 'refunded_stale'
  && confirmation.payment_refunded === true,
);

export const getStripeConfirmationFailureMessage = (
  confirmation: StripeConfirmationResult | null | undefined,
  expectedSessionId: string | null | undefined,
  fallback: string,
): string => {
  if (isStripeSessionRefundedAsStale(confirmation, expectedSessionId)) {
    return confirmation?.message
      || 'The invoice balance changed while Checkout was open, so the Stripe charge was refunded. Refresh before paying the current balance.';
  }

  return fallback;
};
