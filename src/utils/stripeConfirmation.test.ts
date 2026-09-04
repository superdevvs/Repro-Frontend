import { describe, expect, it } from 'vitest';

import {
  getStripeConfirmationFailureMessage,
  isStripeSessionPaymentRecorded,
  isStripeSessionRefundedAsStale,
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
