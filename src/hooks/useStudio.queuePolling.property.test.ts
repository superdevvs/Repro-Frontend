// Property-based test for Live_Queue polling bounds.
//
// Feature: ai-editing-studio-revamp, Property 20: Queue polling is bounded and
// result-driven.
//
// **Validates: Requirements 7.4, 7.5**
//
// For any Live_Queue state, the refresh interval is enabled and no greater than
// 15 seconds when at least one Queue_Record is non-terminal, and disabled when
// the list is empty or every displayed Queue_Record is terminal.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  STUDIO_QUEUE_MAX_POLL_INTERVAL,
  TERMINAL_QUEUE_STATUSES,
  getStudioQueueRefetchInterval,
  isTerminalQueueStatus,
} from './useStudio';
import type { QueueRecord } from '@/services/studioService';

const NON_TERMINAL_STATUSES = ['pending', 'processing', 'stitching', 'queued'] as const;

/** Randomizes casing so the helper's case-insensitive matching is exercised. */
const withArbitraryCase = (value: string): fc.Arbitrary<string> =>
  fc
    .array(fc.boolean(), { minLength: value.length, maxLength: value.length })
    .map((upper) =>
      value
        .split('')
        .map((char, index) => (upper[index] ? char.toUpperCase() : char.toLowerCase()))
        .join(''),
    );

const arbitraryTerminalStatus: fc.Arbitrary<string> = fc
  .constantFrom(...TERMINAL_QUEUE_STATUSES)
  .chain(withArbitraryCase);

const arbitraryNonTerminalStatus: fc.Arbitrary<string> = fc
  .constantFrom(...NON_TERMINAL_STATUSES)
  .chain(withArbitraryCase);

/**
 * Builds a Queue_Record with the given status. Only the status drives the
 * polling decision, but realistic surrounding fields keep the generated input
 * inside the real Queue_Record space.
 */
const queueRecordWithStatus = (status: string): fc.Arbitrary<QueueRecord> =>
  fc.record({
    id: fc.integer({ min: 1 }).map((n) => `photo-${n}`),
    aiJobId: fc.integer({ min: 1 }).map(String),
    jobType: fc.constantFrom('photo', 'video') as fc.Arbitrary<QueueRecord['jobType']>,
    workflowTitle: fc.constantFrom('Photo Enhancement', 'Twilight', 'Listing Video'),
    context: fc.constant(null),
    contextLabel: fc.oneof(fc.constant(null), fc.string()),
    thumbnailUrl: fc.constant(null),
    status: fc.constant(status),
    progress: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 100 })),
    eta: fc.constant(null),
    failureReason: fc.constant(null),
    terminalAt: fc.constant(null),
    version: fc.integer({ min: 1 }).map(String),
  }) as fc.Arbitrary<QueueRecord>;

const arbitraryTerminalRecord = arbitraryTerminalStatus.chain(queueRecordWithStatus);
const arbitraryNonTerminalRecord = arbitraryNonTerminalStatus.chain(queueRecordWithStatus);

/** Arbitrary mix of terminal and non-terminal records, including empty lists. */
const arbitraryQueue: fc.Arbitrary<QueueRecord[]> = fc.array(
  fc.oneof(arbitraryTerminalRecord, arbitraryNonTerminalRecord),
  { maxLength: 8 },
);

describe('Feature: ai-editing-studio-revamp, Property 20: Queue polling is bounded and result-driven', () => {
  it('enables a bounded interval when any record is non-terminal and disables it when all are terminal', () => {
    fc.assert(
      fc.property(arbitraryQueue, (records) => {
        const interval = getStudioQueueRefetchInterval(records);
        const hasNonTerminal = records.some(
          (record) => !isTerminalQueueStatus(record.status as string),
        );

        if (hasNonTerminal) {
          expect(typeof interval).toBe('number');
          expect(interval as number).toBeGreaterThan(0);
          expect(interval as number).toBeLessThanOrEqual(STUDIO_QUEUE_MAX_POLL_INTERVAL);
        } else {
          // Empty list or every displayed record terminal: polling stops (Req 7.5).
          expect(interval).toBe(false);
        }
      }),
      { numRuns: 30 },
    );
  });

  it('disables polling for an empty queue and before the first response', () => {
    expect(getStudioQueueRefetchInterval([])).toBe(false);
    expect(getStudioQueueRefetchInterval(undefined)).toBe(false);
  });
});
