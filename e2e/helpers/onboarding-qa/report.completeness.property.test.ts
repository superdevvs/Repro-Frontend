// Property-based + unit tests for the evidence-backed QA report collector (`report.ts`).
//
// Feature: photographer-onboarding-qa, Property 10: Report completeness and evidence association.
//
// For any completed run, the report contains EXACTLY one entry per executed check (distinct id),
// each carrying a result; every screenshot captured for a check is referenced under that check's
// entry; every `pass` that was given evidence carries it; a `pass` recorded with NO evidence is
// treated as not-green (red) by `summary()` per the Req 22.3 evidence contract; and `cleanup()`
// carries exactly one outcome record per tracked `QA_Entity` recorded during the run.
//
// Validates: Requirements 22.1, 22.2, 22.3, 21.5

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  createQaReport,
  type CheckResult,
  type CleanupOutcome,
  type Evidence,
} from './report';
import type { EntityType, TrackedEntity } from './entity-tracker';

const ALL_ENTITY_TYPES: readonly EntityType[] = [
  'account',
  'shoot',
  'booking',
  'rawFile',
  'editedFile',
  'cubicasaOrder',
  'cubicasaReference',
  'equipment',
  'equipmentAssignment',
  'invoice',
  'reminderRecord',
  'notificationLog',
  'client',
  'address',
  'availabilityWindow',
  'blockedWindow',
  'report',
];

const RESULTS: readonly CheckResult[] = ['pass', 'fail', 'blocked', 'skipped'];
const OUTCOMES: readonly CleanupOutcome[] = ['removed', 'skipped', 'failed'];

// A small id pool so distinct-id counting is meaningfully exercised (ids repeat across ops).
const ID_POOL = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const;

// ---------------------------------------------------------------------------
// Generated operations against a report
// ---------------------------------------------------------------------------

type CheckOp =
  | { kind: 'record'; id: string; requirement: string; result: CheckResult; note?: string }
  | { kind: 'screenshot'; id: string; path: string }
  | { kind: 'evidence'; id: string; evidence: Partial<Evidence> };

const idArb = fc.constantFrom(...ID_POOL);

const recordOpArb: fc.Arbitrary<CheckOp> = fc.record({
  kind: fc.constant('record' as const),
  id: idArb,
  requirement: fc.constantFrom('22.1', '22.2', '22.3', '21.5', '8.3'),
  result: fc.constantFrom(...RESULTS),
});

const screenshotOpArb: fc.Arbitrary<CheckOp> = fc.record({
  kind: fc.constant('screenshot' as const),
  id: idArb,
  path: fc
    .tuple(idArb, fc.integer({ min: 0, max: 50 }))
    .map(([id, n]) => `output/playwright/${id}-shot-${n}.png`),
});

// A partial evidence bundle; channels are independently present or absent so some `evidence`
// ops add nothing at all (exercising the no-evidence path).
const evidenceArb: fc.Arbitrary<Partial<Evidence>> = fc.record(
  {
    screenshots: fc.array(
      fc.integer({ min: 0, max: 30 }).map((n) => `output/playwright/extra-${n}.png`),
      { maxLength: 3 },
    ),
    consoleLogs: fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 3 }),
    networkFailures: fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 3 }),
    apiExcerpts: fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 3 }),
    tracePath: fc.option(fc.constant('output/playwright/trace.zip'), { nil: undefined }),
    videoPath: fc.option(fc.constant('output/playwright/video.webm'), { nil: undefined }),
  },
  { requiredKeys: [] },
);

const evidenceOpArb: fc.Arbitrary<CheckOp> = fc.record({
  kind: fc.constant('evidence' as const),
  id: idArb,
  evidence: evidenceArb,
});

const checkOpArb: fc.Arbitrary<CheckOp> = fc.oneof(recordOpArb, screenshotOpArb, evidenceOpArb);

interface CleanupOp {
  entity: TrackedEntity;
  outcome: CleanupOutcome;
}

const cleanupOpArb: fc.Arbitrary<CleanupOp> = fc.record({
  entity: fc.record({
    type: fc.constantFrom(...ALL_ENTITY_TYPES),
    id: fc.oneof(fc.integer({ min: 1, max: 9999 }), fc.string({ minLength: 1, maxLength: 6 })),
    label: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
  }),
  outcome: fc.constantFrom(...OUTCOMES),
});

// ---------------------------------------------------------------------------
// Reference model — mirrors report.ts semantics so we can assert exactness
// ---------------------------------------------------------------------------

interface ModelEntry {
  id: string;
  requirement: string;
  result: CheckResult;
  screenshots: string[]; // deduped, insertion order
  hasOtherEvidence: boolean; // any non-screenshot channel populated
}

function buildModel(ops: CheckOp[]): Map<string, ModelEntry> {
  const model = new Map<string, ModelEntry>();

  const ensure = (id: string): ModelEntry => {
    let entry = model.get(id);
    if (!entry) {
      // Mirrors ensureEntry default: blocked + empty requirement when first touched via attach.
      entry = { id, requirement: '', result: 'blocked', screenshots: [], hasOtherEvidence: false };
      model.set(id, entry);
    }
    return entry;
  };

  const addScreenshot = (entry: ModelEntry, path: string): void => {
    if (!entry.screenshots.includes(path)) {
      entry.screenshots.push(path);
    }
  };

  for (const op of ops) {
    const entry = ensure(op.id);
    if (op.kind === 'record') {
      entry.requirement = op.requirement;
      entry.result = op.result;
    } else if (op.kind === 'screenshot') {
      addScreenshot(entry, op.path);
    } else {
      const ev = op.evidence;
      if (ev.screenshots) {
        for (const p of ev.screenshots) addScreenshot(entry, p);
      }
      if ((ev.consoleLogs?.length ?? 0) > 0) entry.hasOtherEvidence = true;
      if ((ev.networkFailures?.length ?? 0) > 0) entry.hasOtherEvidence = true;
      if ((ev.apiExcerpts?.length ?? 0) > 0) entry.hasOtherEvidence = true;
      if (ev.tracePath) entry.hasOtherEvidence = true;
      if (ev.videoPath) entry.hasOtherEvidence = true;
    }
  }

  return model;
}

const modelHasEvidence = (entry: ModelEntry): boolean =>
  entry.screenshots.length > 0 || entry.hasOtherEvidence;

function applyOps(report: ReturnType<typeof createQaReport>, ops: CheckOp[]): void {
  for (const op of ops) {
    if (op.kind === 'record') {
      report.record(op.id, op.requirement, op.result, op.note);
    } else if (op.kind === 'screenshot') {
      report.attachScreenshot(op.id, op.path);
    } else {
      report.attachEvidence(op.id, op.evidence);
    }
  }
}

// ---------------------------------------------------------------------------
// Property 10
// ---------------------------------------------------------------------------

describe("Feature: photographer-onboarding-qa, Property 10: Report completeness and evidence association", () => {
  it('keeps exactly one entry per distinct check id, references every captured screenshot, treats an evidence-less pass as not-green, and records one cleanup outcome per tracked entity', () => {
    fc.assert(
      fc.property(
        fc.array(checkOpArb, { maxLength: 120 }),
        fc.array(cleanupOpArb, { maxLength: 40 }),
        (checkOps, cleanupOps) => {
          const report = createQaReport();
          applyOps(report, checkOps);
          for (const c of cleanupOps) {
            report.recordCleanup(c.entity, c.outcome);
          }

          const model = buildModel(checkOps);
          const entries = report.entries();

          // (Req 22.1) Exactly one entry per distinct id, in first-seen order.
          const distinctIds = [...model.keys()];
          expect(entries.map((e) => e.id)).toEqual(distinctIds);
          expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);

          for (const entry of entries) {
            const expected = model.get(entry.id)!;

            // Each entry carries its latest recorded result + requirement.
            expect(entry.result).toBe(expected.result);
            expect(entry.requirement).toBe(expected.requirement);

            // (Req 22.2) Every captured screenshot is referenced under that check's entry,
            // exactly once, in capture order.
            expect(entry.evidence.screenshots).toEqual(expected.screenshots);
            for (const shot of expected.screenshots) {
              expect(entry.evidence.screenshots).toContain(shot);
            }

            // (Req 22.3) A `pass` that was given evidence genuinely carries it.
            if (entry.result === 'pass' && modelHasEvidence(expected)) {
              expect(entry.evidence.screenshots.length + countOtherEvidence(entry.evidence)).toBeGreaterThan(0);
            }
          }

          // (Req 22.3) Any `pass` recorded with NO evidence makes the summary not-green (red).
          const hasEvidencelessPass = entries.some(
            (e) => e.result === 'pass' && e.evidence.screenshots.length === 0 && countOtherEvidence(e.evidence) === 0,
          );
          if (hasEvidencelessPass) {
            expect(report.summary()).not.toBe('green');
            expect(report.summary()).toBe('red');
          }

          // (Req 21.5) Exactly one cleanup outcome record per tracked QA_Entity, in order.
          const cleanup = report.cleanup();
          expect(cleanup.length).toBe(cleanupOps.length);
          cleanup.forEach((rec, i) => {
            expect(rec.entity).toEqual(cleanupOps[i].entity);
            expect(rec.outcome).toBe(cleanupOps[i].outcome);
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  it('summary reflects the report contract: green only when every entry is a pass with evidence', () => {
    fc.assert(
      fc.property(fc.array(checkOpArb, { maxLength: 120 }), (checkOps) => {
        const report = createQaReport();
        applyOps(report, checkOps);
        const entries = report.entries();

        const anyFail = entries.some((e) => e.result === 'fail');
        const anyEvidencelessPass = entries.some(
          (e) => e.result === 'pass' && e.evidence.screenshots.length === 0 && countOtherEvidence(e.evidence) === 0,
        );
        const anyBlockedOrSkipped = entries.some(
          (e) => e.result === 'blocked' || e.result === 'skipped',
        );

        let expectedSummary: 'green' | 'yellow' | 'red';
        if (anyFail || anyEvidencelessPass) {
          expectedSummary = 'red';
        } else if (anyBlockedOrSkipped) {
          expectedSummary = 'yellow';
        } else {
          expectedSummary = 'green';
        }

        expect(report.summary()).toBe(expectedSummary);
      }),
      { numRuns: 200 },
    );
  });
});

function countOtherEvidence(evidence: Evidence): number {
  return (
    (evidence.consoleLogs?.length ?? 0) +
    (evidence.networkFailures?.length ?? 0) +
    (evidence.apiExcerpts?.length ?? 0) +
    (evidence.tracePath ? 1 : 0) +
    (evidence.videoPath ? 1 : 0)
  );
}

// ---------------------------------------------------------------------------
// Focused unit tests (concrete examples / edge cases)
// ---------------------------------------------------------------------------

describe('createQaReport — report completeness and evidence association (examples)', () => {
  it('records exactly one entry per check id even when the same id is recorded repeatedly (latest wins)', () => {
    const report = createQaReport();
    report.record('c1', '22.1', 'blocked');
    report.record('c1', '22.1', 'fail');
    report.attachScreenshot('c1', 'a.png');
    report.record('c1', '22.1', 'pass');

    const entries = report.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0].result).toBe('pass');
    expect(entries[0].evidence.screenshots).toEqual(['a.png']);
  });

  it('references every captured screenshot under its own check entry and dedupes repeats', () => {
    const report = createQaReport();
    report.record('c1', '22.2', 'pass');
    report.attachScreenshot('c1', 'c1-1.png');
    report.attachScreenshot('c1', 'c1-1.png'); // duplicate
    report.attachScreenshot('c1', 'c1-2.png');
    report.record('c2', '22.2', 'pass');
    report.attachScreenshot('c2', 'c2-1.png');

    const byId = new Map(report.entries().map((e) => [e.id, e]));
    expect(byId.get('c1')!.evidence.screenshots).toEqual(['c1-1.png', 'c1-2.png']);
    expect(byId.get('c2')!.evidence.screenshots).toEqual(['c2-1.png']);
  });

  it('treats a pass with no evidence as red (not-green), and a pass with evidence as green', () => {
    const passNoEvidence = createQaReport();
    passNoEvidence.record('c1', '22.3', 'pass');
    expect(passNoEvidence.summary()).toBe('red');

    const passWithEvidence = createQaReport();
    passWithEvidence.record('c1', '22.3', 'pass');
    passWithEvidence.attachScreenshot('c1', 'proof.png');
    expect(passWithEvidence.summary()).toBe('green');
  });

  it('records exactly one cleanup outcome entry per tracked QA_Entity, preserving order', () => {
    const report = createQaReport();
    const e1: TrackedEntity = { type: 'account', id: 1, label: 'admin.qa' };
    const e2: TrackedEntity = { type: 'shoot', id: 'sh-1' };
    report.recordCleanup(e1, 'removed');
    report.recordCleanup(e2, 'failed');

    const cleanup = report.cleanup();
    expect(cleanup).toHaveLength(2);
    expect(cleanup[0]).toEqual({ entity: e1, outcome: 'removed' });
    expect(cleanup[1]).toEqual({ entity: e2, outcome: 'failed' });
  });
});
