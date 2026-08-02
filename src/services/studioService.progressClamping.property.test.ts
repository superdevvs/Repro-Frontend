// Feature: ai-editing-studio-revamp, Property 12: Progress values are clamped to 0–100
//
// For any upload or AI_Job progress value, the displayed progress is constrained
// to the inclusive range 0 through 100. This exercises `clampProgress` directly
// and the queue-record normalization it feeds (`studioService.getQueue`), where a
// null/absent server progress must stay indeterminate rather than becoming a
// number.
//
// **Validates: Requirements 4.8, 16.4**

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './api';
import { clampProgress, type QueueRecord } from './studioService';
import { studioService } from './studioService';

const RUNS = 200;

/**
 * Numeric progress inputs a server or an XHR progress event can realistically
 * produce: in-range, negative, out-of-range, fractional, and non-finite.
 */
const progressNumberArb = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 100 }) },
  { weight: 4, arbitrary: fc.double({ min: 0, max: 100, noNaN: true }) },
  { weight: 3, arbitrary: fc.integer({ min: -10_000, max: 10_000 }) },
  {
    weight: 3,
    arbitrary: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
  },
  {
    weight: 2,
    arbitrary: fc.constantFrom(
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0,
      Number.MAX_SAFE_INTEGER,
      -Number.MAX_SAFE_INTEGER,
      100.4,
      -0.4,
      99.5,
    ),
  },
);

/** Progress as the API may deliver it: a number, or null/undefined for indeterminate. */
const serverProgressArb = fc.oneof(
  { weight: 6, arbitrary: progressNumberArb },
  { weight: 2, arbitrary: fc.constant(null) },
  { weight: 1, arbitrary: fc.constant(undefined) },
);

const queueRecordArb = fc
  .record({
    index: fc.integer({ min: 1, max: 999 }),
    jobType: fc.constantFrom<'photo' | 'video'>('photo', 'video'),
    status: fc.constantFrom(
      'pending',
      'processing',
      'stitching',
      'queued',
      'completed',
      'failed',
      'cancelled',
    ),
    progress: serverProgressArb,
  })
  .map(({ index, jobType, status, progress }) => ({
    id: `${jobType}-${index}`,
    aiJobId: String(index),
    jobType,
    workflowTitle: 'Photo Enhancement',
    context: null,
    contextLabel: null,
    thumbnailUrl: null,
    status,
    progress,
    eta: null,
    failureReason: null,
    terminalAt: null,
    version: '1',
  }));

let get: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  get = vi.spyOn(apiClient, 'get');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Property 12: Progress values are clamped to 0–100', () => {
  it('clampProgress maps any numeric input into the inclusive 0–100 range', () => {
    fc.assert(
      fc.property(progressNumberArb, (value) => {
        const clamped = clampProgress(value);

        expect(Number.isInteger(clamped)).toBe(true);
        expect(clamped).toBeGreaterThanOrEqual(0);
        expect(clamped).toBeLessThanOrEqual(100);
      }),
      { numRuns: RUNS },
    );
  });

  it('clampProgress preserves in-range values (rounded) and saturates outside the range', () => {
    fc.assert(
      fc.property(progressNumberArb, (value) => {
        const clamped = clampProgress(value);

        if (!Number.isFinite(value)) {
          // No credible server value => 0 rather than a fabricated number.
          expect(clamped).toBe(0);
          return;
        }

        if (value <= 0) {
          expect(clamped).toBe(0);
        } else if (value >= 100) {
          expect(clamped).toBe(100);
        } else {
          expect(clamped).toBe(Math.min(100, Math.max(0, Math.round(value))));
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('clampProgress is idempotent and monotonic', () => {
    fc.assert(
      fc.property(progressNumberArb, progressNumberArb, (a, b) => {
        expect(clampProgress(clampProgress(a))).toBe(clampProgress(a));

        if (Number.isFinite(a) && Number.isFinite(b) && a <= b) {
          expect(clampProgress(a)).toBeLessThanOrEqual(clampProgress(b));
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('normalizes queue-record progress to 0–100 while keeping null progress indeterminate', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(queueRecordArb, { maxLength: 12 }), async (records) => {
        get.mockResolvedValue({
          data: {
            success: true,
            data: records,
            meta: { retentionHours: 24, calculatedAt: new Date().toISOString() },
          },
        });

        const normalized: QueueRecord[] = await studioService.getQueue();

        expect(normalized).toHaveLength(records.length);

        normalized.forEach((record, index) => {
          const raw = records[index].progress;

          if (raw === null || raw === undefined) {
            expect(record.progress).toBeNull();
            return;
          }

          expect(record.progress).not.toBeNull();
          expect(Number.isInteger(record.progress as number)).toBe(true);
          expect(record.progress as number).toBeGreaterThanOrEqual(0);
          expect(record.progress as number).toBeLessThanOrEqual(100);
          expect(record.progress).toBe(clampProgress(Number(raw)));
        });
      }),
      { numRuns: RUNS },
    );
  });
});
