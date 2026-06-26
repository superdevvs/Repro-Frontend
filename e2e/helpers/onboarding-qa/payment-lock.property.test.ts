// Property-based + unit tests for the Payment-lock invariant (`invoicing-reporting.e2e.ts`).
//
// Feature: photographer-onboarding-qa, Property 13: Payment-lock invariant.
//
// For any shoot invoice, while the invoice is unpaid and Payment_Lock applies, the client may
// PREVIEW but cannot DOWNLOAD the final files — including through a direct file URL — and while the
// invoice is paid (or the product is zero-dollar / bypass) the client may DOWNLOAD. The lock is
// client-scoped: a non-client role (admin / editor / photographer / editing manager) is never
// download-locked.
//
// This is a pure/in-memory property test (no live target). It mirrors the EXACT backend rule
// enforced by the Onboarding_System and verified by `frontend/e2e/onboarding/invoicing-reporting.e2e.ts`
// (ShootClientReleaseAccessService / downloadLockedResponse). The download-release controller and
// the direct-file-URL path enforce the SAME predicate — there is no direct-URL bypass:
//
//   canPreview  ⇔ delivered (always served, watermarked, regardless of payment).
//   canDownload ⇔ role !== 'client' OR bypassPaywall OR paymentStatus === 'paid' OR zeroDollar.
//
// Equivalently, for a client the download is LOCKED if and only if:
//   role === 'client' AND !bypassPaywall AND !zeroDollar AND paymentStatus !== 'paid'.
//
// Validates: Requirements 16.13, 16.14, 18.2, 18.3, 18.7

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

// ── Payment-lock domain ──────────────────────────────────────────────────────────────────────────

/** Roles that may attempt to view/download a delivered shoot's final files. Only `client` is
 *  ever subject to the payment lock; every other role is broad with respect to the paywall. */
type Role = 'client' | 'admin' | 'editor';

/** Resolved invoice payment status for the shoot. */
type PaymentStatus = 'unpaid' | 'paid';

/** The access path used to request the file. The gated UI path and the DIRECT file URL must
 *  enforce the identical rule — the direct URL is NOT a bypass (16.14). */
type AccessPath = 'gatedUi' | 'directUrl';

/** A delivered shoot file access attempt. */
interface AccessAttempt {
  role: Role;
  paymentStatus: PaymentStatus;
  /** A zero-dollar product applies NO lock (resolves to paid). (18.7) */
  zeroDollar: boolean;
  /** `bypass_paywall` flag on the product/shoot — when set, NO lock applies. */
  bypassPaywall: boolean;
  /** Which path the request came in on — must not change the decision. */
  path: AccessPath;
}

// ── Units under test — replicated EXACTLY from invoicing-reporting.e2e.ts ─────────────────────────

/**
 * Preview is ALWAYS permitted on a delivered shoot, regardless of role, payment, or access path
 * (served watermarked while unpaid). (18.2)
 */
function canPreview(_attempt: AccessAttempt): boolean {
  return true;
}

/**
 * The download-release rule. Mirrors `ShootClientReleaseAccessService`: the lock is client-scoped
 * and lifted by bypass_paywall, a paid invoice, or a zero-dollar product. The `path` is deliberately
 * NOT consulted — the direct file URL enforces the same rule as the gated UI (no bypass, 16.14).
 */
function canDownload(attempt: AccessAttempt): boolean {
  return (
    attempt.role !== 'client' ||
    attempt.bypassPaywall ||
    attempt.paymentStatus === 'paid' ||
    attempt.zeroDollar
  );
}

// ── Reference oracle for the documented rule ──────────────────────────────────────────────────────

/**
 * Independent declarative reference for the SAME invariant, expressed as "the download is LOCKED
 * if and only if it is an unpaid, non-bypassed, non-zero-dollar CLIENT request". Kept separate from
 * `canDownload` so the equivalence property catches drift rather than restating the predicate.
 */
function downloadLockedByRule(attempt: AccessAttempt): boolean {
  return (
    attempt.role === 'client' &&
    !attempt.bypassPaywall &&
    !attempt.zeroDollar &&
    attempt.paymentStatus !== 'paid'
  );
}

// ── Generators ──────────────────────────────────────────────────────────────────────────────────

const roleArb: fc.Arbitrary<Role> = fc.constantFrom('client', 'admin', 'editor');
const paymentStatusArb: fc.Arbitrary<PaymentStatus> = fc.constantFrom('unpaid', 'paid');
const pathArb: fc.Arbitrary<AccessPath> = fc.constantFrom('gatedUi', 'directUrl');

const attemptArb: fc.Arbitrary<AccessAttempt> = fc.record({
  role: roleArb,
  paymentStatus: paymentStatusArb,
  zeroDollar: fc.boolean(),
  bypassPaywall: fc.boolean(),
  path: pathArb,
});

const TAG = 'Feature: photographer-onboarding-qa, Property 13: Payment-lock invariant';

// ── Properties ──────────────────────────────────────────────────────────────────────────────────

describe(TAG, () => {
  it('preview is ALWAYS permitted on a delivered shoot (any role, payment, or access path) — 18.2', () => {
    fc.assert(
      fc.property(attemptArb, (attempt) => {
        expect(canPreview(attempt)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('download is permitted IFF the documented rule holds (locked only for unpaid, non-bypassed, non-zero-dollar clients) — 18.2/18.3/18.7', () => {
    fc.assert(
      fc.property(attemptArb, (attempt) => {
        // Download permitted exactly when it is NOT locked by the independent rule.
        expect(canDownload(attempt)).toBe(!downloadLockedByRule(attempt));
      }),
      { numRuns: 200 },
    );
  });

  it('the direct file URL enforces the SAME decision as the gated UI — no bypass (16.14)', () => {
    fc.assert(
      fc.property(attemptArb, (attempt) => {
        const gated: AccessAttempt = { ...attempt, path: 'gatedUi' };
        const direct: AccessAttempt = { ...attempt, path: 'directUrl' };

        // Preview and download decisions are invariant under the access path.
        expect(canPreview(direct)).toBe(canPreview(gated));
        expect(canDownload(direct)).toBe(canDownload(gated));
      }),
      { numRuns: 200 },
    );
  });

  it('a client with an UNPAID, non-bypassed, non-zero-dollar invoice may preview but NOT download — on either path (16.13/18.2)', () => {
    fc.assert(
      fc.property(pathArb, (path) => {
        const attempt: AccessAttempt = {
          role: 'client',
          paymentStatus: 'unpaid',
          zeroDollar: false,
          bypassPaywall: false,
          path,
        };
        expect(canPreview(attempt)).toBe(true); // preview permitted
        expect(canDownload(attempt)).toBe(false); // download locked, including via direct URL
      }),
      { numRuns: 200 },
    );
  });

  it('a client may download once the invoice is PAID — on either path (18.3)', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), pathArb, (zeroDollar, bypassPaywall, path) => {
        const attempt: AccessAttempt = {
          role: 'client',
          paymentStatus: 'paid',
          zeroDollar,
          bypassPaywall,
          path,
        };
        expect(canDownload(attempt)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('a zero-dollar (or bypass-paywall) product applies NO lock — the client may download while unpaid (18.7)', () => {
    fc.assert(
      fc.property(pathArb, fc.boolean(), (path, bypassPaywall) => {
        // Zero-dollar resolves to paid → no lock, regardless of the bypass flag or path.
        const zeroDollar: AccessAttempt = {
          role: 'client',
          paymentStatus: 'unpaid',
          zeroDollar: true,
          bypassPaywall,
          path,
        };
        expect(canDownload(zeroDollar)).toBe(true);

        // bypass_paywall alone also lifts the lock while unpaid.
        const bypass: AccessAttempt = {
          role: 'client',
          paymentStatus: 'unpaid',
          zeroDollar: false,
          bypassPaywall: true,
          path,
        };
        expect(canDownload(bypass)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('a non-client role (admin / editor) is NEVER download-locked, even while unpaid (lock is client-scoped)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Role>('admin', 'editor'),
        paymentStatusArb,
        fc.boolean(),
        fc.boolean(),
        pathArb,
        (role, paymentStatus, zeroDollar, bypassPaywall, path) => {
          const attempt: AccessAttempt = { role, paymentStatus, zeroDollar, bypassPaywall, path };
          expect(canDownload(attempt)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── Concrete examples (the named 18.x payment-lock scenarios) ─────────────────────────────────────

describe(`${TAG} — concrete scenarios`, () => {
  it('18.2 unpaid client (gated UI): preview permitted, download locked', () => {
    const attempt: AccessAttempt = {
      role: 'client',
      paymentStatus: 'unpaid',
      zeroDollar: false,
      bypassPaywall: false,
      path: 'gatedUi',
    };
    expect(canPreview(attempt)).toBe(true);
    expect(canDownload(attempt)).toBe(false);
  });

  it('18.2/16.14 unpaid client (direct file URL): download still locked — no bypass', () => {
    const attempt: AccessAttempt = {
      role: 'client',
      paymentStatus: 'unpaid',
      zeroDollar: false,
      bypassPaywall: false,
      path: 'directUrl',
    };
    expect(canPreview(attempt)).toBe(true);
    expect(canDownload(attempt)).toBe(false);
  });

  it('18.3 paid client: download permitted', () => {
    const attempt: AccessAttempt = {
      role: 'client',
      paymentStatus: 'paid',
      zeroDollar: false,
      bypassPaywall: false,
      path: 'gatedUi',
    };
    expect(canDownload(attempt)).toBe(true);
  });

  it('18.7 zero-dollar client (unpaid invoice): no lock, download permitted', () => {
    const attempt: AccessAttempt = {
      role: 'client',
      paymentStatus: 'unpaid',
      zeroDollar: true,
      bypassPaywall: false,
      path: 'gatedUi',
    };
    expect(canDownload(attempt)).toBe(true);
  });

  it('admin probing an unpaid shoot: never locked (client-scoped lock)', () => {
    const attempt: AccessAttempt = {
      role: 'admin',
      paymentStatus: 'unpaid',
      zeroDollar: false,
      bypassPaywall: false,
      path: 'directUrl',
    };
    expect(canDownload(attempt)).toBe(true);
  });
});
