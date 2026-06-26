// Property-based + unit tests for approval-state assignability (`approval-workflow.e2e.ts`).
//
// Feature: photographer-onboarding-qa, Property 14: Approval-state assignability.
//
// For ANY photographer, the photographer is assignable ONLY while the `Approval_State` is Approved
// (and then only subject to the profile/distance/availability/service gate). A Pending or Rejected
// photographer is NEVER assignable and NEVER receives shoots, regardless of any other field.
//
// Per the `approval-workflow.e2e.ts` findings, the Dashboard backend has no first-class
// `Approval_State`; Approved maps to an `active` account (`account_status ∈ {active, enabled}`,
// neither locked nor deleted). This property models the resolved tri-state directly: `approvalState`
// is the resolved Approval_State, `active` captures the active-account requirement, and
// `profileComplete` is the combined profile/distance/availability/service gate. The assignability
// rule under test is therefore:
//
//     isAssignable ⇔ (approvalState === 'Approved' AND active AND profileComplete)
//
// Validates: Requirements 6.2, 6.6, 6.7, 7.4, 7.5

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Domain model + unit under test
// ---------------------------------------------------------------------------

/** The resolved tri-state Approval_State of a photographer (see module header). */
type ApprovalState = 'Pending' | 'Approved' | 'Rejected';

/**
 * The subset of a photographer relevant to assignability:
 *  - `approvalState`  — resolved Approval_State (Req 6.2/6.6/6.7).
 *  - `active`         — the account is active/assignable (Approved ⇔ active account; Req 6.6/7.5).
 *  - `profileComplete`— the combined profile/distance/availability/service gate (Req 7.4/7.5).
 */
interface Photographer {
  approvalState: ApprovalState;
  active: boolean;
  profileComplete: boolean;
}

/**
 * Assignability predicate replicated from the approval-workflow rule: a photographer is assignable
 * IF AND ONLY IF the Approval_State is Approved AND the account is active AND the
 * profile/distance/availability/service gate is satisfied. Pending and Rejected short-circuit to
 * never-assignable (Req 6.2/6.7).
 */
function isAssignable(photographer: Photographer): boolean {
  return (
    photographer.approvalState === 'Approved' &&
    photographer.active &&
    photographer.profileComplete
  );
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const approvalStateArb: fc.Arbitrary<ApprovalState> = fc.constantFrom(
  'Pending',
  'Approved',
  'Rejected',
);

/** A photographer across the full cross-product of {state} × {active} × {profileComplete}. */
const photographerArb: fc.Arbitrary<Photographer> = fc.record({
  approvalState: approvalStateArb,
  active: fc.boolean(),
  profileComplete: fc.boolean(),
});

// ---------------------------------------------------------------------------
// Property 14
// ---------------------------------------------------------------------------

describe('Feature: photographer-onboarding-qa, Property 14: Approval-state assignability', () => {
  it('is assignable IFF Approved AND active AND profile/distance/availability/service complete', () => {
    fc.assert(
      fc.property(photographerArb, (p) => {
        const expected = p.approvalState === 'Approved' && p.active && p.profileComplete;
        expect(isAssignable(p)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('NEVER assigns a Pending or Rejected photographer, regardless of active/profile fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ApprovalState>('Pending', 'Rejected'),
        fc.boolean(),
        fc.boolean(),
        (approvalState, active, profileComplete) => {
          expect(isAssignable({ approvalState, active, profileComplete })).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('only Approved CAN be assignable: any assignable photographer is necessarily Approved+active+complete', () => {
    fc.assert(
      fc.property(photographerArb, (p) => {
        if (isAssignable(p)) {
          expect(p.approvalState).toBe('Approved');
          expect(p.active).toBe(true);
          expect(p.profileComplete).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  // --- Concrete truth-table anchors (Req 6.2/6.6/6.7/7.4/7.5) --------------------------------

  it('assigns an Approved + active + complete photographer (Req 6.6/7.5)', () => {
    expect(isAssignable({ approvalState: 'Approved', active: true, profileComplete: true })).toBe(true);
  });

  it('does not assign an Approved photographer with an incomplete profile gate (Req 7.4)', () => {
    expect(isAssignable({ approvalState: 'Approved', active: true, profileComplete: false })).toBe(false);
  });

  it('does not assign an Approved-but-inactive photographer (Req 6.6 — assignable only while active)', () => {
    expect(isAssignable({ approvalState: 'Approved', active: false, profileComplete: true })).toBe(false);
  });

  it('never assigns a Pending photographer even when active + complete (Req 6.2)', () => {
    expect(isAssignable({ approvalState: 'Pending', active: true, profileComplete: true })).toBe(false);
  });

  it('never assigns a Rejected photographer even when active + complete (Req 6.7)', () => {
    expect(isAssignable({ approvalState: 'Rejected', active: true, profileComplete: true })).toBe(false);
  });
});
