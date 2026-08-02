// Property-based test for the revamped Live_Queue polling decision.
//
// Feature: ai-editing-studio-revamp, Property 20: Queue polling is bounded and
// result-driven.
//
// **Validates: Requirements 7.4, 7.5**
//
// For any Live_Queue state, the refresh interval is enabled and no greater than
// 15 seconds when at least one Queue_Record is non-terminal, and disabled when
// all displayed Queue_Records are terminal (including the empty and
// not-yet-loaded cases).

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  STUDIO_QUEUE_MAX_POLL_INTERVAL,
  getStudioQueueRefetchInterval,
} from './useStudio';
import type { QueueRecord } from '@/services/studioService';

/**
 * Terminal_Status set restated independently of the implementation so the
 * property checks the specification (Req 7.5) rather than the code under test.
 */
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;
const NON_TERMINAL_STATUSES = ['pending', 'processing', 'stitching', 'queued'] as const;

const isTerminal = (status: string) =>
  (TERMINAL_STATUSES as readonly string[]).includes(status.trim().toLowerCase());

/** Mixed-case variants so the property covers server casing differences. */
const arbitraryStatus: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...TERMINAL_STATUSES),
  fc.constantFrom(...NON_TERMINAL_STATUSES),
  fc.constantFrom(...TERMINAL_STATUSES).map((s) => s.toUpperCase()),
  fc.constantFrom(...NON_TERMINAL_STATUSES).map((s) => s.toUpperCase()),
);

/**
 * Smart Queue_Record generator: only `status` drives the polling decision, but
 * the rest of the record is generated in its real shape so the helper is
 * exercised against realistic server payloads.
 */
const arbitraryQueueRecord: fc.Arbitrary<QueueRecord> = fc
  .record({
    id: fc.integer({ min: 1, max: 9999 }),
    jobType: fc.constantFrom('photo', 'video') as fc.Arbitrary<QueueRecord['jobType']>,
    workflowTitle: fc.string({ minLength: 1, maxLength: 40 }),
    status: arbitraryStatus,
    progress: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 100 })),
    thumbnailUrl: fc.oneof(fc.constant(null), fc.constant('/assets/studio/thumb.jpg')),
    failureReason: fc.oneof(fc.constant(null), fc.string({ maxLength: 60 })),
  })
  .map(({ id, jobType, workflowTitle, status, progress, thumbnailUrl, failureReason }) => ({
    id: `${jobType}-${id}`,
    aiJobId: String(id),
    jobType,
    workflowTitle,
    context: null,
    contextLabel: null,
    thumbnailUrl,
    status,
    progress,
    eta: null,
    failureReason: isTerminal(status) ? failureReason : null,
    terminalAt: isTerminal(status) ? new Date().toISOString() : null,
    version: `v${id}`,
    deepLink: { destination: 'queue' as const, recordType: 'ai_job' as const, recordId: String(id) },
  }));

describe('Feature: ai-editing-studio-revamp, Property 20: Queue polling is bounded and result-driven', () => {
  it('enables a ≤15s interval while any record is non-terminal and disables it when all are terminal', () => {
    fc.assert(
      fc.property(fc.array(arbitraryQueueRecord, { maxLength: 12 }), (records) => {
        const interval = getStudioQueueRefetchInterval(records);
        const hasNonTerminal = records.some((record) => !isTerminal(record.status));

        if (hasNonTerminal) {
          // Req 7.4: polling enabled at a fixed interval no greater than 15s.
          expect(typeof interval).toBe('number');
          expect(interval as number).toBeGreaterThan(0);
          expect(interval as number).toBeLessThanOrEqual(STUDIO_QUEUE_MAX_POLL_INTERVAL);
          expect(STUDIO_QUEUE_MAX_POLL_INTERVAL).toBe(15000);
        } else {
          // Req 7.5: every displayed record terminal (or none displayed) => no polling.
          expect(interval).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('keeps the interval fixed regardless of how many records are non-terminal', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryQueueRecord, { minLength: 1, maxLength: 8 }),
        fc.array(arbitraryQueueRecord, { minLength: 1, maxLength: 8 }),
        (a, b) => {
          fc.pre(
            a.some((record) => !isTerminal(record.status)) &&
              b.some((record) => !isTerminal(record.status)),
          );

          expect(getStudioQueueRefetchInterval(a)).toBe(getStudioQueueRefetchInterval(b));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('disables polling for terminal-only, empty, and not-yet-loaded queues', () => {
    fc.assert(
      fc.property(
        fc.array(
          arbitraryQueueRecord.filter((record) => isTerminal(record.status)),
          { maxLength: 10 },
        ),
        (terminalRecords) => {
          expect(getStudioQueueRefetchInterval(terminalRecords)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );

    expect(getStudioQueueRefetchInterval([])).toBe(false);
    expect(getStudioQueueRefetchInterval(undefined)).toBe(false);
  });
});
