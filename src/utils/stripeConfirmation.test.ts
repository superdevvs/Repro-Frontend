import { describe, expect, it } from 'vitest';

import {
  getStripeConfirmationFailureMessage,
  isStripeSessionPaymentRecorded,
  isStripeSessionRefundedAsStale,
  isStripeConfirmationPending,
  readStripeConfirmation,
} from './stripeConfirmation';

describe('isStripeSessionPaymentRecorded', () => {
  it('accepts processed and already-recorded paid outcomes for the expected session', () => {
    expect(isStripeSessionPaymentRecorded({
      outcome: 'processed',
      session_payment_status: 'paid',
      payment_recorded: true,
      session_id: 'cs_expected',
    }, 'cs_expected')).toBe(true);

    expect(isStripeSessionPaymentRecorded({
      outcome: 'already_processed',
      session_payment_status: 'paid',
      payment_recorded: true,
      session_id: 'cs_expected',
    }, 'cs_expected')).toBe(true);
  });

  it('rejects an unpaid response even when Stripe supplied a positive session amount', () => {
    expect(isStripeSessionPaymentRecorded({
      outcome: 'unpaid',
      session_payment_status: 'unpaid',
      payment_recorded: false,
      reconciled: false,
      session_id: 'cs_expected',
      last_payment_amount: 200.39,
    }, 'cs_expected')).toBe(false);
  });

  it('rejects a successful-looking response for a different or missing session', () => {
    const result = {
      outcome: 'processed',
      session_payment_status: 'paid',
      payment_recorded: true,
      session_id: 'cs_other',
    } as const;

    expect(isStripeSessionPaymentRecorded(result, 'cs_expected')).toBe(false);
    expect(isStripeSessionPaymentRecorded(result, null)).toBe(false);
  });

  it('supports a reconciled response from the legacy contract only for the exact session', () => {
    expect(isStripeSessionPaymentRecorded({
      reconciled: true,
      session_id: 'cs_expected',
    }, 'cs_expected')).toBe(true);
    expect(isStripeSessionPaymentRecorded({
      reconciled: false,
      session_id: 'cs_expected',
      last_payment_amount: 100,
    }, 'cs_expected')).toBe(false);
  });

  it('does not report a stale refunded charge as payment success', () => {
    const result = {
      outcome: 'refunded_stale',
      session_payment_status: 'paid',
      payment_recorded: true,
      payment_refunded: true,
      session_id: 'cs_expected',
      message: 'Balance changed; the charge was refunded.',
    } as const;

    expect(isStripeSessionPaymentRecorded(result, 'cs_expected')).toBe(false);
    expect(isStripeSessionRefundedAsStale(result, 'cs_expected')).toBe(true);
    expect(getStripeConfirmationFailureMessage(result, 'cs_expected', 'fallback'))
      .toBe('Balance changed; the charge was refunded.');
  });
});

describe('shared confirmation recovery contract', () => {
  it.each(['busy', 'pending', 'unpaid', 'not_found', 'failed'])('keeps %s recoverable only for the same checkout', outcome => {
    const result = { outcome, session_id: 'cs_expected', session_payment_status: 'paid', payment_recorded: false };
    expect(isStripeConfirmationPending(result, 'cs_expected')).toBe(true);
    expect(isStripeConfirmationPending(result, 'cs_other')).toBe(false);
    expect(isStripeSessionPaymentRecorded(result, 'cs_expected')).toBe(false);
  });

  it.each(['expired', 'cancelled', 'canceled', 'declined'])('does not call a paid session %s before its payment is reconciled', outcome => {
    expect(isStripeConfirmationPending({ outcome, session_id: 'cs_expected', session_payment_status: 'paid' }, 'cs_expected')).toBe(true);
    expect(isStripeConfirmationPending({ outcome, session_id: 'cs_expected', session_payment_status: 'unpaid' }, 'cs_expected')).toBe(false);
  });

  it('keeps transport uncertainty recoverable without accepting a missing session as proof', () => {
    expect(isStripeConfirmationPending(null, 'cs_expected')).toBe(true);
    expect(isStripeConfirmationPending(null, null)).toBe(false);
    expect(isStripeConfirmationPending({ outcome: 'confirmation_rejected' }, 'cs_expected')).toBe(false);
    expect(isStripeSessionPaymentRecorded(null, 'cs_expected')).toBe(false);
  });

  it.each([null, [], 'unavailable', { session_id: 'cs_expected', outcome: {} },
    { session_id: 'cs_expected', payment_recorded: 'true' }, { session_id: 'cs_expected', return_to: {} },
    { reconciled: true, payment_recorded: true }])('rejects malformed confirmation payloads (%j)', value => {
    expect(readStripeConfirmation(value)).toBeNull();
  });

  it('preserves the receipt payload while validating the shared proof fields', () => {
    const value = { session_id: 'cs_expected', outcome: 'already_processed', session_payment_status: 'paid', payment_recorded: true, shoot: { id: 42 } };
    expect(readStripeConfirmation(value)).toBe(value);
    expect(isStripeSessionPaymentRecorded(readStripeConfirmation(value), 'cs_expected')).toBe(true);
  });
});
