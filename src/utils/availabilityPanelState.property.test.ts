// Property-based + unit test for the availability panel state machine.
//
// Feature: booking-scheduling-fixes, Property 7: Panel state is a deterministic
// single-valued function of inputs.
//
// `derivePanelState` is a PURE mapping from raw request signals
// (loading / aborted / error / result) to a single discriminated
// `AvailabilityPanelState`. This test asserts:
//   1. Determinism / single-valuedness — the same input always yields exactly
//      one, identical output (Req 5.1–5.4).
//   2. `loading` is rendered while a request is in flight and is distinct from
//      the empty / not-configured / error states (Req 5.3).
//   3. `not-configured`, `empty`, `success`, and `error` are mutually exclusive
//      and map per the settled result's status (Req 5.1, 5.2, 5.4).
//   4. The "no availability" panel is hidden on success — `success` carries the
//      effective `day` window and is never an empty/not-configured/error panel
//      (Req 5.1).
//
// Validates: Requirements 5.1, 5.2, 5.3, 5.4

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  derivePanelState,
  DEFAULT_AVAILABILITY_ERROR_MESSAGE,
  type AvailabilityPanelState,
  type DerivePanelStateInput,
} from '@/utils/availabilityPanelState';
import type { AvailabilityResult, DayAvailability } from '@/utils/availabilityProvider';

const ALL_KINDS: ReadonlyArray<AvailabilityPanelState['kind']> = [
  'loading',
  'success',
  'empty',
  'not-configured',
  'error',
];

// --- Generators -------------------------------------------------------------

const dayArb: fc.Arbitrary<DayAvailability> = fc.record({
  workingHours: fc.option(
    fc.record({
      start: fc.constantFrom('09:00', '10:00', '08:30'),
      end: fc.constantFrom('17:00', '18:00', '20:00'),
    }),
    { nil: null },
  ),
  blocked: fc.array(
    fc.record({
      start: fc.constantFrom('12:00', '13:00'),
      end: fc.constantFrom('12:30', '14:00'),
    }),
    { maxLength: 3 },
  ),
  fromConfig: fc.boolean(),
  timezone: fc.constantFrom('Asia/Kolkata', 'America/Chicago', 'UTC'),
});

const resultArb: fc.Arbitrary<AvailabilityResult> = fc.record({
  status: fc.constantFrom<AvailabilityResult['status']>('success', 'empty', 'not-configured'),
  day: dayArb,
  displayFallbackOnly: fc.option(fc.boolean(), { nil: undefined }),
});

// Arbitrary error, sometimes with a blank message to exercise the default.
const errorArb: fc.Arbitrary<Error> = fc
  .oneof(
    fc.string(),
    fc.constantFrom('', '   ', 'network down', 'HTTP 500'),
  )
  .map((m) => new Error(m));

// A fully arbitrary input across the whole signal space.
const inputArb: fc.Arbitrary<DerivePanelStateInput> = fc.record({
  loading: fc.boolean(),
  aborted: fc.boolean(),
  error: fc.option(errorArb, { nil: null }),
  result: fc.option(resultArb, { nil: null }),
});

// --- Determinism / single-valuedness ---------------------------------------

describe('Feature: booking-scheduling-fixes, Property 7: Panel state is a deterministic single-valued function of inputs', () => {
  it('is deterministic: the same input always yields an identical state (Req 5.1–5.4)', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const a = derivePanelState(input);
        const b = derivePanelState({ ...input });
        // Repeated evaluation with equivalent inputs is byte-for-byte identical.
        expect(a).toEqual(b);
      }),
    );
  });

  it('is single-valued: every input maps to exactly one of the five known kinds (Req 5.1–5.4)', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const state = derivePanelState(input);
        // Exactly one kind, drawn from the closed set of panel states.
        expect(ALL_KINDS).toContain(state.kind);
      }),
    );
  });

  // --- loading is distinct (Req 5.3) ----------------------------------------

  it('renders the distinct loading state while a request is in flight, regardless of other signals (Req 5.3)', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(errorArb, { nil: null }),
        fc.option(resultArb, { nil: null }),
        (aborted, error, result) => {
          const state = derivePanelState({ loading: true, aborted, error, result });
          expect(state.kind).toBe('loading');
        },
      ),
    );
  });

  // --- mutually-exclusive mapping per result status (Req 5.1, 5.2, 5.4) ------

  it('maps a settled (non-loading, non-aborted, error-free) result to the kind matching its status (Req 5.1, 5.2, 5.4)', () => {
    fc.assert(
      fc.property(resultArb, (result) => {
        const state = derivePanelState({
          loading: false,
          aborted: false,
          error: null,
          result,
        });

        const expectedKind =
          result.status === 'not-configured'
            ? 'not-configured'
            : result.status === 'empty'
              ? 'empty'
              : 'success';

        expect(state.kind).toBe(expectedKind);
      }),
    );
  });

  it('keeps not-configured / empty / success / error mutually exclusive (never two kinds for one input) (Req 5.1, 5.2, 5.4)', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const state = derivePanelState(input);
        // The discriminated union guarantees a single tag; assert the count of
        // matching kinds across the closed set is exactly one.
        const matches = ALL_KINDS.filter((k) => k === state.kind);
        expect(matches).toHaveLength(1);
      }),
    );
  });

  // --- "no availability" panel hidden on success (Req 5.1) ------------------

  it('hides the "no availability" panel on success: a success state always carries the effective day window (Req 5.1)', () => {
    fc.assert(
      fc.property(dayArb, (day) => {
        const result: AvailabilityResult = { status: 'success', day };
        const state = derivePanelState({
          loading: false,
          aborted: false,
          error: null,
          result,
        });

        expect(state.kind).toBe('success');
        // Success is never an empty / not-configured / error panel and exposes
        // the effective hours window so the "no availability" panel stays hidden.
        if (state.kind === 'success') {
          expect(state.day).toEqual(day);
        }
      }),
    );
  });

  // --- non-abort error surfaces, abort stays benign (Req 5.x supporting) ----

  it('surfaces a non-abort error (with a non-empty message) when not loading/aborted (Req 5.3 boundary)', () => {
    fc.assert(
      fc.property(errorArb, fc.option(resultArb, { nil: null }), (error, result) => {
        const state = derivePanelState({ loading: false, aborted: false, error, result });
        expect(state.kind).toBe('error');
        if (state.kind === 'error') {
          expect(state.message.length).toBeGreaterThan(0);
        }
      }),
    );
  });
});

// --- Concrete examples (single-valued mapping table) ------------------------

describe('Feature: booking-scheduling-fixes, Property 7: concrete mapping examples', () => {
  const day: DayAvailability = {
    workingHours: { start: '09:00', end: '18:00' },
    blocked: [],
    fromConfig: true,
    timezone: 'Asia/Kolkata',
  };

  it('loading: true -> loading', () => {
    expect(
      derivePanelState({ loading: true, aborted: false, error: null, result: null }).kind,
    ).toBe('loading');
  });

  it('aborted: true -> loading (benign)', () => {
    expect(
      derivePanelState({ loading: false, aborted: true, error: null, result: null }).kind,
    ).toBe('loading');
  });

  it('success result -> success', () => {
    expect(
      derivePanelState({
        loading: false,
        aborted: false,
        error: null,
        result: { status: 'success', day },
      }).kind,
    ).toBe('success');
  });

  it('empty result -> empty', () => {
    expect(
      derivePanelState({
        loading: false,
        aborted: false,
        error: null,
        result: { status: 'empty', day },
      }).kind,
    ).toBe('empty');
  });

  it('not-configured result -> not-configured', () => {
    expect(
      derivePanelState({
        loading: false,
        aborted: false,
        error: null,
        result: { status: 'not-configured', day },
      }).kind,
    ).toBe('not-configured');
  });

  it('blank-message error -> error with the default message', () => {
    const state = derivePanelState({
      loading: false,
      aborted: false,
      error: new Error('   '),
      result: null,
    });
    expect(state).toEqual({ kind: 'error', message: DEFAULT_AVAILABILITY_ERROR_MESSAGE });
  });
});
