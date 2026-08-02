import { describe, expect, it } from 'vitest';

import {
  getShootDetailsPaymentBadge,
  getShootDetailsPaymentStatus,
} from './shootDetailsPresentation';

/**
 * Regression cover for the production closeout defect.
 *
 * `GET /api/shoots/{id}` returns no nested `payment` object — the canonical figures are
 * top-level `payment_status`, `total_quote`, `total_paid` and `payments`. The badge
 * helper used to call the summary with `{ payment }`, so it received an empty container,
 * `totalQuote` resolved to 0, and the "a zero-total shoot is settled" rule reported
 * **paid**. Shoot 61 on production showed three green "Paid" badges while the same page
 * displayed "Outstanding $746.77".
 *
 * The shoot 61 payload below is the real shape observed on production (2 Aug 2026).
 */

// GET /api/shoots/61 — note the deliberate absence of a `payment` key.
const shoot61 = {
  id: 61,
  payment_status: 'partial',
  total_quote: '1743.70',
  total_paid: 996.93,
  base_quote: '1645.00',
  tax_amount: '98.70',
  payments: [
    { id: 23, amount: '996.93', status: 'completed', payment_method: 'cash' },
  ],
};

describe('getShootDetailsPaymentStatus — production-shaped shoot 61', () => {
  it('reports partial, not paid, for a shoot with an outstanding balance', () => {
    expect(getShootDetailsPaymentStatus(shoot61)).toBe('partial');
  });

  it('renders the Partial badge label', () => {
    expect(getShootDetailsPaymentBadge(shoot61)?.label).toBe('Partial');
  });

  it('matches the Shoot History badge, which already read partial', () => {
    // Shoot History renders "Partial · $746.77" for this same shoot.
    const status = getShootDetailsPaymentStatus(shoot61);
    expect(status).toBe('partial');
    expect(status).not.toBe('paid');
  });
});

describe('getShootDetailsPaymentStatus — canonical states', () => {
  it('paid when payments cover the total', () => {
    expect(
      getShootDetailsPaymentStatus({
        payment_status: 'paid',
        total_quote: '350.00',
        total_paid: 350,
        payments: [{ id: 24, amount: '350.00', status: 'completed' }],
      }),
    ).toBe('paid');
  });

  it('unpaid when nothing has been paid', () => {
    expect(
      getShootDetailsPaymentStatus({
        payment_status: 'unpaid',
        total_quote: '475.94',
        total_paid: 0,
        payments: [],
      }),
    ).toBe('unpaid');
  });

  it('unpaid when every payment has been fully refunded', () => {
    expect(
      getShootDetailsPaymentStatus({
        payment_status: 'unpaid',
        total_quote: '300.00',
        total_paid: 0,
        payments: [
          { id: 1, amount: '300.00', status: 'completed', refunded_amount: '300.00' },
        ],
      }),
    ).toBe('unpaid');
  });

  it('nets a partial refund down rather than discarding the payment', () => {
    // $400 paid against a $500 shoot, $100 refunded -> $300 net, still partial.
    expect(
      getShootDetailsPaymentStatus({
        total_quote: '500.00',
        payments: [
          { id: 1, amount: '400.00', status: 'completed', refunded_amount: '100.00' },
        ],
      }),
    ).toBe('partial');
  });

  it('treats a zero-total shoot as settled', () => {
    expect(
      getShootDetailsPaymentStatus({
        payment_status: 'paid',
        total_quote: '0.00',
        total_paid: 0,
        payments: [],
      }),
    ).toBe('paid');
  });

  it('reports unknown — never paid — for a missing shoot, and renders no badge', () => {
    // A shoot still loading must not flash a green "Paid"; both consumers treat a
    // falsy badge as "render nothing".
    expect(getShootDetailsPaymentStatus(undefined)).toBeNull();
    expect(getShootDetailsPaymentStatus(null)).toBeNull();
    expect(getShootDetailsPaymentBadge(undefined)).toBeUndefined();
  });
});

describe('getShootDetailsPaymentStatus — legacy nested payment form', () => {
  it('still honours a nested payment object when one is supplied', () => {
    // Older callers/fixtures nest the figures; that path must keep working.
    expect(
      getShootDetailsPaymentStatus({
        payment: { total_quote: '1000.00', total_paid: 250, payment_status: 'partial' },
      }),
    ).toBe('partial');
  });
});
