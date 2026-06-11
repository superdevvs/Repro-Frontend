// Aborted / stale availability request handling test (task 5.7 — MANDATORY).
//
// Feature: booking-scheduling-fixes, Property 8: Aborts are benign and the
// latest request wins.
// Validates: Requirements 6.1, 6.2, 6.3
//
// Two things are exercised here:
//
//  1. The PURE `derivePanelState` mapping (frontend/src/utils/availabilityPanelState.ts)
//     — aborts resolve to the benign `loading` state (never `error`), a
//     non-abort error yields the explicit `error` state, and
//     success/empty/not-configured results map to their respective panels.
//
//  2. The request-SEQUENCING the SchedulingForm effect performs around that
//     pure function: a monotonic `latestRequestRef` counter so the most
//     recently issued request "wins", stale (superseded) responses are dropped,
//     and aborts are benign (they never log, never surface an error, and never
//     overwrite a newer result). We model that sequencing in a tiny harness
//     that mirrors the effect's try/catch ordering exactly:
//       try   { result = await fetch(...); if (id !== latest) return; render(result) }
//       catch { if (AbortError) return; if (id !== latest) return; render(error) }

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  derivePanelState,
  DEFAULT_AVAILABILITY_ERROR_MESSAGE,
  type AvailabilityPanelState,
} from '@/utils/availabilityPanelState';
import type {
  AvailabilityResult,
  DayAvailability,
} from '@/utils/availabilityProvider';

// ---------------------------------------------------------------------------
// Outcome model + arbitraries
// ---------------------------------------------------------------------------

type Outcome =
  | { kind: 'success'; result: AvailabilityResult }
  | { kind: 'error'; error: Error }
  | { kind: 'abort' };

const SUCCESS_DAY: DayAvailability = {
  workingHours: { start: '09:00', end: '18:00' },
  blocked: [],
  fromConfig: true,
  timezone: 'Asia/Kolkata',
};

const arbResult: fc.Arbitrary<AvailabilityResult> = fc
  .constantFrom<AvailabilityResult['status']>('success', 'empty', 'not-configured')
  .map((status) => {
    if (status === 'success') {
      return { status, day: SUCCESS_DAY };
    }
    const day: DayAvailability = {
      workingHours: null,
      blocked: status === 'empty' ? [{ start: '09:00', end: '10:00' }] : [],
      fromConfig: false,
      timezone: 'Asia/Kolkata',
    };
    return { status, day };
  });

const arbOutcome: fc.Arbitrary<Outcome> = fc.oneof(
  arbResult.map((result) => ({ kind: 'success' as const, result })),
  fc.string().map((message) => ({ kind: 'error' as const, error: new Error(message) })),
  fc.constant({ kind: 'abort' as const }),
);

/** The panel state a non-abort outcome should render through `derivePanelState`. */
function expectedStateFor(outcome: Exclude<Outcome, { kind: 'abort' }>): AvailabilityPanelState {
  if (outcome.kind === 'success') {
    return derivePanelState({ loading: false, aborted: false, error: null, result: outcome.result });
  }
  return derivePanelState({ loading: false, aborted: false, error: outcome.error, result: null });
}

const LOADING: AvailabilityPanelState = derivePanelState({
  loading: true,
  aborted: false,
  error: null,
  result: null,
});

// ---------------------------------------------------------------------------
// Sequencing harness — mirrors the SchedulingForm effect's request ordering.
// ---------------------------------------------------------------------------

interface OutstandingRequest {
  id: number;
  outcome: Outcome;
}

class RequestSequencer {
  /** Monotonic counter — the SchedulingForm `latestRequestRef`. */
  latest = 0;
  /** The currently rendered panel state. */
  rendered: AvailabilityPanelState = LOADING;
  /** The request id whose result is currently rendered (0 = none/loading). */
  renderedOriginId = 0;
  /** Errors that were "logged"/surfaced. Aborts must never append here. */
  readonly errorLog: string[] = [];
  /** Outcome by request id, so the test oracle can reason about "latest wins". */
  readonly issuedOutcomes = new Map<number, Outcome>();

  /** Issue a new request: claim the next id and enter the loading state. */
  issue(outcome: Outcome): OutstandingRequest {
    const id = ++this.latest;
    this.issuedOutcomes.set(id, outcome);
    // A new in-flight request always shows the distinct loading panel and, by
    // bumping `latest`, supersedes every earlier outstanding request.
    this.rendered = LOADING;
    this.renderedOriginId = 0;
    return { id, outcome };
  }

  /**
   * Settle a request exactly as the effect does. Returns the rendered state
   * after settling so the caller can assert benign/stale no-ops.
   */
  settle(req: OutstandingRequest): AvailabilityPanelState {
    const { id, outcome } = req;

    // catch-branch: benign cancellation returns immediately — no log, no state
    // change, never overwrites a newer result. (Req 6.1)
    if (outcome.kind === 'abort') {
      return this.rendered;
    }

    if (outcome.kind === 'success') {
      // try-branch: drop stale (superseded) responses before rendering. (Req 6.2)
      if (id !== this.latest) return this.rendered;
      this.rendered = expectedStateFor(outcome);
      this.renderedOriginId = id;
      return this.rendered;
    }

    // catch-branch, non-abort error: drop if stale, else surface the explicit
    // error state. (Req 6.2, 6.3)
    if (id !== this.latest) return this.rendered;
    this.rendered = expectedStateFor(outcome);
    this.renderedOriginId = id;
    this.errorLog.push(outcome.error.message);
    return this.rendered;
  }
}

// ---------------------------------------------------------------------------
// Command sequence: interleaved issue/settle actions.
// ---------------------------------------------------------------------------

type Action =
  | { tag: 'issue'; outcome: Outcome }
  | { tag: 'settle'; pick: number };

const arbAction: fc.Arbitrary<Action> = fc.oneof(
  { weight: 2, arbitrary: arbOutcome.map((outcome) => ({ tag: 'issue' as const, outcome })) },
  { weight: 3, arbitrary: fc.nat().map((pick) => ({ tag: 'settle' as const, pick })) },
);

describe('Feature: booking-scheduling-fixes, Property 8: Aborts are benign and the latest request wins', () => {
  it('pure derivePanelState: aborts are benign (loading, never error)', () => {
    fc.assert(
      fc.property(arbResult, fc.string(), (result, message) => {
        // An aborted settled request resolves to the benign loading state and
        // never to error, regardless of any error message in flight. (Req 6.1)
        const aborted = derivePanelState({
          loading: false,
          aborted: true,
          error: new Error(message),
          result,
        });
        expect(aborted).toEqual({ kind: 'loading' });
      }),
    );
  });

  it('pure derivePanelState: non-abort errors yield the explicit error state', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const state = derivePanelState({
          loading: false,
          aborted: false,
          error: new Error(message),
          result: null,
        });
        expect(state.kind).toBe('error');
        if (state.kind === 'error') {
          expect(state.message).toBe(
            message.trim() ? message : DEFAULT_AVAILABILITY_ERROR_MESSAGE,
          );
        }
      }),
    );
  });

  it('sequencing: aborts/stale responses never overwrite a newer result; the latest request wins', () => {
    fc.assert(
      fc.property(fc.array(arbAction, { minLength: 1, maxLength: 30 }), (actions) => {
        const seq = new RequestSequencer();
        const outstanding: OutstandingRequest[] = [];

        const settleWithInvariants = (req: OutstandingRequest) => {
          const before = seq.rendered;
          const logLenBefore = seq.errorLog.length;
          const wasLatest = req.id === seq.latest;

          const after = seq.settle(req);

          if (req.outcome.kind === 'abort') {
            // Aborts are benign: no state change, never logged. (Req 6.1)
            // "Benign" means the abort changes nothing — `after === before` and
            // the error log is unchanged. It does NOT mean the resulting panel
            // can't be an error: a newer request may have legitimately rendered
            // an error before this abort settles, and the abort correctly leaves
            // that error state untouched.
            expect(after).toEqual(before);
            expect(seq.errorLog.length).toBe(logLenBefore);
          } else if (!wasLatest) {
            // Stale (superseded) responses are dropped — no change. (Req 6.2)
            expect(after).toEqual(before);
            expect(seq.errorLog.length).toBe(logLenBefore);
          } else {
            // The latest non-abort request renders exactly its derived state. (Req 6.3)
            expect(after).toEqual(expectedStateFor(req.outcome));
          }
        };

        for (const action of actions) {
          if (action.tag === 'issue') {
            outstanding.push(seq.issue(action.outcome));
          } else if (outstanding.length > 0) {
            const idx = action.pick % outstanding.length;
            const [req] = outstanding.splice(idx, 1);
            settleWithInvariants(req);
          }
        }

        // Drain any still-outstanding requests.
        while (outstanding.length > 0) {
          settleWithInvariants(outstanding.shift()!);
        }

        // "Latest request wins": the final rendered state is determined solely
        // by the most recently issued request. If it settled non-abort, its
        // result is what shows; otherwise the panel remains the benign loading
        // state it entered when that request was issued. (Req 6.1, 6.2)
        if (seq.latest > 0) {
          const lastOutcome = seq.issuedOutcomes.get(seq.latest)!;
          if (lastOutcome.kind === 'abort') {
            expect(seq.rendered).toEqual(LOADING);
          } else {
            expect(seq.rendered).toEqual(expectedStateFor(lastOutcome));
          }
          // The rendered result never originates from a request older than the
          // newest one (no stale data on screen).
          expect(seq.renderedOriginId === 0 || seq.renderedOriginId === seq.latest).toBe(true);
        }
      }),
    );
  });

  it('sequencing example: an abort of the in-flight request leaves the newer success rendered', () => {
    const seq = new RequestSequencer();
    const r1 = seq.issue({ kind: 'abort' });
    const r2 = seq.issue({ kind: 'success', result: { status: 'success', day: SUCCESS_DAY } });

    // The first request aborts after being superseded: benign no-op.
    seq.settle(r1);
    expect(seq.rendered).toEqual(LOADING);
    expect(seq.errorLog).toHaveLength(0);

    // The newest request settles and wins.
    seq.settle(r2);
    expect(seq.rendered).toEqual({ kind: 'success', day: SUCCESS_DAY });
  });

  it('sequencing example: a stale success arriving after a newer error is dropped', () => {
    const seq = new RequestSequencer();
    const r1 = seq.issue({ kind: 'success', result: { status: 'success', day: SUCCESS_DAY } });
    const r2 = seq.issue({ kind: 'error', error: new Error('boom') });

    // Newer request (r2) settles first with an error → explicit error state.
    seq.settle(r2);
    expect(seq.rendered.kind).toBe('error');

    // Older request (r1) resolves late: stale, must be dropped (no flip to success).
    seq.settle(r1);
    expect(seq.rendered.kind).toBe('error');
  });
});
