// Property-based test for Studio progress clamping.
//
// Feature: ai-editing-studio-revamp, Property 12: Progress values are clamped
// to 0–100.
//
// **Validates: Requirements 4.8, 16.4**
//
// For any upload or AI_Job progress value, the displayed progress is
// constrained to the inclusive range 0 through 100. Upload per-file progress is
// always numeric (Req 4.8), while an AI_Job Progress_Value may be absent, in
// which case it stays `null` so the Live_Queue shows an indeterminate state
// rather than a coerced number (Req 7.10, 16.4).

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  clampNullableProgress,
  clampProgress,
  type QueueRecord,
} from './studioService';

const NUM_RUNS = 30;

/**
 * Smart generator over the progress input space: in-range values, out-of-range
 * values on both sides, fractional values, and the non-finite values a division
 * by a zero total can produce.
 */
const arbitraryProgressNumber: fc.Arbitrary<number> = fc.oneof(
  // In range, integral and fractional.
  fc.integer({ min: 0, max: 100 }),
  fc.double({ min: 0, max: 100, noNaN: true }),
  // Below range (negatives) and above range.
  fc.double({ min: -10000, max: -0.0001, noNaN: true }),
  fc.double({ min: 100.0001, max: 10000, noNaN: true }),
  // Non-finite results of a degenerate progress computation.
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
);

/** AI_Job progress: any numeric input plus the absent representations. */
const arbitraryJobProgress: fc.Arbitrary<number | null | undefined> = fc.oneof(
  arbitraryProgressNumber,
  fc.constant(null),
  fc.constant(undefined),
);

const queueRecordWith = (progress: number | null | undefined): QueueRecord =>
  ({
    id: 'photo-1',
    aiJobId: '1',
    jobType: 'photo',
    workflowTitle: 'Photo Enhancement',
    context: null,
    contextLabel: null,
    thumbnailUrl: null,
    status: 'processing',
    progress: progress as number | null,
    eta: null,
    failureReason: null,
    terminalAt: null,
    version: 'v1',
    deepLink: { destination: 'queue', recordType: 'ai_job', recordId: '1' },
  }) as QueueRecord;

describe('Feature: ai-editing-studio-revamp, Property 12: Progress values are clamped to 0–100', () => {
  it('constrains any upload per-file progress value to the inclusive range 0–100 (Req 4.8)', () => {
    fc.assert(
      fc.property(arbitraryProgressNumber, (value) => {
        const clamped = clampProgress(value);

        expect(Number.isFinite(clamped)).toBe(true);
        expect(clamped).toBeGreaterThanOrEqual(0);
        expect(clamped).toBeLessThanOrEqual(100);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('preserves in-range order and is idempotent, so clamping never invents progress', () => {
    fc.assert(
      fc.property(arbitraryProgressNumber, (value) => {
        const clamped = clampProgress(value);

        // Clamping an already-clamped value changes nothing.
        expect(clampProgress(clamped)).toBe(clamped);

        if (Number.isFinite(value)) {
          if (value < 0) expect(clamped).toBe(0);
          if (value > 100) expect(clamped).toBe(100);
          // Inside the range the value is only rounded, never moved further.
          if (value >= 0 && value <= 100) {
            expect(Math.abs(clamped - value)).toBeLessThanOrEqual(0.5);
          }
        } else {
          expect(clamped).toBe(0);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('clamps a present AI_Job progress to 0–100 and keeps an absent one null (Req 16.4, 7.10)', () => {
    fc.assert(
      fc.property(arbitraryJobProgress, (value) => {
        const clamped = clampNullableProgress(value);

        if (value === null || value === undefined) {
          // Indeterminate stays indeterminate — never coerced to a number.
          expect(clamped).toBeNull();
        } else {
          expect(clamped).not.toBeNull();
          expect(clamped as number).toBeGreaterThanOrEqual(0);
          expect(clamped as number).toBeLessThanOrEqual(100);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('holds for the QueueRecord progress field carried through the Live_Queue', () => {
    fc.assert(
      fc.property(arbitraryJobProgress, (value) => {
        const record = queueRecordWith(value);
        const displayed = clampNullableProgress(record.progress);

        if (record.progress === null || record.progress === undefined) {
          expect(displayed).toBeNull();
        } else {
          expect(displayed as number).toBeGreaterThanOrEqual(0);
          expect(displayed as number).toBeLessThanOrEqual(100);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
