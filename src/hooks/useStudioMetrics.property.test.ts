// Property-based test for Studio active-queue polling.
//
// Feature: ai-editing-default-page, Property 7: Queue polling tracks the
// presence of active jobs.
// Validates: Requirements 6.4, 6.5
//
// For any active-queue result, the service enables polling (a positive
// refetch interval) if and only if the result contains at least one
// Active_Job, and disables polling (returns false) when the result is empty
// or absent.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  ACTIVE_QUEUE_POLL_INTERVAL,
  getActiveQueueRefetchInterval,
} from './useStudioMetrics';
import type { StudioActiveJob } from '@/services/studioMetricsService';

// Generator for an arbitrary StudioActiveJob — the contents do not affect the
// polling decision, only the array length does, but we generate realistic
// rows to exercise the logic over the actual input space.
const arbitraryActiveJob: fc.Arbitrary<StudioActiveJob> = fc.record({
  id: fc.integer({ min: 1 }),
  job_type: fc.constantFrom('photo', 'video') as fc.Arbitrary<
    StudioActiveJob['job_type']
  >,
  shoot_id: fc.integer({ min: 1 }),
  shoot_address: fc.oneof(fc.constant(null), fc.string()),
  status: fc.string(),
});

describe('Feature: ai-editing-default-page, Property 7: Queue polling tracks the presence of active jobs', () => {
  it('enables polling (positive interval) iff the result has at least one active job, disables when empty', () => {
    fc.assert(
      fc.property(fc.array(arbitraryActiveJob), (jobs) => {
        const interval = getActiveQueueRefetchInterval(jobs);

        if (jobs.length > 0) {
          // Polling enabled: a positive, finite refetch interval.
          expect(interval).toBe(ACTIVE_QUEUE_POLL_INTERVAL);
          expect(typeof interval).toBe('number');
          expect(interval as number).toBeGreaterThan(0);
        } else {
          // Empty queue: polling disabled.
          expect(interval).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('treats undefined (no data yet) as no active jobs and disables polling', () => {
    expect(getActiveQueueRefetchInterval(undefined)).toBe(false);
  });

  it('disables polling for the empty array', () => {
    expect(getActiveQueueRefetchInterval([])).toBe(false);
  });
});
