// Property-based + unit tests for re-run result override in the QA report collector (`report.ts`).
//
// Feature: photographer-onboarding-qa, Property 9: Re-run result override.
//
// A check first recorded as `fail` and later re-executed with a passing outcome must have a final
// stored result of `pass` (Req 22.6). The override path is available both via `record()` (latest
// write wins) and via the dedicated `override()` method. Evidence accumulated before the override
// is preserved across it, so the re-run records the latest verified state without discarding the
// proof captured earlier.
//
// Validates: Requirements 22.5, 22.6

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createQaReport, type CheckResult } from './report';

const RESULTS: readonly CheckResult[] = ['pass', 'fail', 'blocked', 'skipped'];

// ---------------------------------------------------------------------------
// Property 9
// ---------------------------------------------------------------------------

describe('Feature: photographer-onboarding-qa, Property 9: Re-run result override', () => {
  it('a check recorded failing then re-run as pass has a final stored result of pass, and evidence accumulated before the override is preserved', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('c1', 'c2', 'c3'),
        // Arbitrary intermediate results recorded between the initial fail and the final pass,
        // so the override holds regardless of what happened in between.
        fc.array(fc.constantFrom(...RESULTS), { maxLength: 6 }),
        // Screenshots captured before the override; these must survive the re-run.
        fc.array(fc.string({ minLength: 1, maxLength: 12 }), { maxLength: 5 }),
        // Choose whether the final pass is applied via record() or via the dedicated override().
        fc.boolean(),
        (id, intermediate, rawShots, useOverrideMethod) => {
          const report = createQaReport();

          // 1) Initial run records the check as failing.
          report.record(id, '22.6', 'fail');

          // 2) Evidence is captured for the failing check before any re-run.
          const shots = [...new Set(rawShots.map((s) => `output/playwright/${id}-${s}.png`))];
          for (const shot of shots) {
            report.attachScreenshot(id, shot);
          }

          // 3) Arbitrary intermediate re-records (still not the final state).
          for (const result of intermediate) {
            report.record(id, '22.6', result);
          }

          // 4) Final re-run: the check now passes.
          if (useOverrideMethod) {
            report.override(id, 'pass');
          } else {
            report.record(id, '22.6', 'pass');
          }

          const entry = report.entries().find((e) => e.id === id)!;

          // (Req 22.6) The latest verified state wins: final stored result is `pass`.
          expect(entry.result).toBe('pass');

          // (Req 22.5/22.6) Evidence accumulated earlier is preserved across the override.
          expect(entry.evidence.screenshots).toEqual(shots);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Focused unit tests (concrete examples / edge cases)
// ---------------------------------------------------------------------------

describe('createQaReport — re-run result override (examples)', () => {
  it('overrides a failing result to pass via record() (latest write wins)', () => {
    const report = createQaReport();
    report.record('c1', '22.6', 'fail');
    report.attachScreenshot('c1', 'proof.png');
    report.record('c1', '22.6', 'pass');

    const entry = report.entries()[0];
    expect(entry.result).toBe('pass');
    expect(entry.evidence.screenshots).toEqual(['proof.png']);
  });

  it('overrides a failing result to pass via override(), preserving accumulated evidence', () => {
    const report = createQaReport();
    report.record('c1', '22.6', 'fail');
    report.attachScreenshot('c1', 'before.png');
    report.attachEvidence('c1', { consoleLogs: ['boom'] });
    report.override('c1', 'pass');

    const entry = report.entries()[0];
    expect(entry.result).toBe('pass');
    expect(entry.evidence.screenshots).toEqual(['before.png']);
    expect(entry.evidence.consoleLogs).toEqual(['boom']);
  });
});
