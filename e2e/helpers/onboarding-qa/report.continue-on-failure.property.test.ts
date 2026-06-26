// Property-based + unit tests for continue-on-failure behaviour of the QA report collector
// (`report.ts`).
//
// Feature: photographer-onboarding-qa, Property 8: Continue-on-failure.
//
// Recording a `fail` for one check must never prevent recording other checks: `record()` never
// throws, regardless of result, ordering, or how many failures are interleaved. After recording an
// arbitrary mix of results (including failures) the report contains exactly one entry per distinct
// check id, and each entry carries the latest result recorded for that id. This is the harness-level
// expression of "when a check fails the suite continues the remaining checks" (Req 22.4).
//
// Validates: Requirement 22.4

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createQaReport, type CheckResult } from './report';

const RESULTS: readonly CheckResult[] = ['pass', 'fail', 'blocked', 'skipped'];

// A small id pool so distinct-id counting is meaningfully exercised (ids repeat across records).
const ID_POOL = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const;

interface RecordOp {
  id: string;
  requirement: string;
  result: CheckResult;
}

const recordOpArb: fc.Arbitrary<RecordOp> = fc.record({
  id: fc.constantFrom(...ID_POOL),
  requirement: fc.constantFrom('22.4', '8.3', '10.1', '13.4'),
  result: fc.constantFrom(...RESULTS),
});

// ---------------------------------------------------------------------------
// Reference model — the latest recorded result wins per distinct id, in first-seen order.
// ---------------------------------------------------------------------------

function expectedLatest(ops: RecordOp[]): Map<string, RecordOp> {
  const model = new Map<string, RecordOp>();
  for (const op of ops) {
    if (model.has(op.id)) {
      // Preserve first-seen order while updating to the latest result/requirement.
      const existing = model.get(op.id)!;
      existing.result = op.result;
      existing.requirement = op.requirement;
    } else {
      model.set(op.id, { ...op });
    }
  }
  return model;
}

// ---------------------------------------------------------------------------
// Property 8
// ---------------------------------------------------------------------------

describe('Feature: photographer-onboarding-qa, Property 8: Continue-on-failure', () => {
  it('records every check regardless of failures: record() never throws and all distinct ids are retained with their latest result', () => {
    fc.assert(
      fc.property(
        fc.array(recordOpArb, { maxLength: 120 }),
        // Guarantee at least one failure is present so the "failure does not stop the run" path is
        // always exercised; it is spliced into a random position among the other records.
        fc.integer({ min: 0, max: 120 }),
        (ops, failurePosition) => {
          const withFailure: RecordOp[] = [...ops];
          const pos = ops.length === 0 ? 0 : failurePosition % (ops.length + 1);
          withFailure.splice(pos, 0, { id: 'c1', requirement: '22.4', result: 'fail' });

          const report = createQaReport();
          // record() must never throw on a failure (or any other result), so every subsequent
          // check is still recorded.
          for (const op of withFailure) {
            expect(() => report.record(op.id, op.requirement, op.result)).not.toThrow();
          }

          const model = expectedLatest(withFailure);
          const entries = report.entries();

          // Exactly one entry per distinct id, in first-seen order.
          expect(entries.map((e) => e.id)).toEqual([...model.keys()]);
          expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);

          // Each entry carries the latest recorded result for its id — recording a failure never
          // dropped or skipped any check that came after it.
          for (const entry of entries) {
            const expected = model.get(entry.id)!;
            expect(entry.result).toBe(expected.result);
            expect(entry.requirement).toBe(expected.requirement);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Focused unit tests (concrete examples / edge cases)
// ---------------------------------------------------------------------------

describe('createQaReport — continue-on-failure (examples)', () => {
  it('continues recording checks after a failure is recorded', () => {
    const report = createQaReport();
    report.record('c1', '22.4', 'pass');
    report.record('c2', '22.4', 'fail');
    report.record('c3', '22.4', 'pass');

    expect(report.entries().map((e) => e.id)).toEqual(['c1', 'c2', 'c3']);
    expect(report.entries().map((e) => e.result)).toEqual(['pass', 'fail', 'pass']);
  });

  it('does not throw when many failures are recorded in a row', () => {
    const report = createQaReport();
    expect(() => {
      report.record('c1', '22.4', 'fail');
      report.record('c2', '22.4', 'fail');
      report.record('c3', '22.4', 'fail');
    }).not.toThrow();
    expect(report.entries()).toHaveLength(3);
  });
});
