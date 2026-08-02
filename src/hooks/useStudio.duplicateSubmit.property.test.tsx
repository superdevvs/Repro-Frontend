/**
 * Property-based test for the Studio duplicate-submit guard (task 9.5).
 *
 * Feature: ai-editing-studio-revamp, Property 34: Duplicate submissions are
 * prevented while pending.
 *
 * *For any* server mutation, activating its trigger again while the first
 * request is still pending issues no additional request.
 *
 * **Validates: Requirements 12.7**
 *
 * The model is the `SubmissionGuard` claim/release protocol exported from
 * `useStudio.ts`: arbitrary interleavings of claims and releases across several
 * submission ids are replayed against a reference `Set` model, asserting that a
 * claim is accepted exactly when no submission for that id is in flight. One
 * hook-level check confirms the same guarantee end to end: a second `submit`
 * while the first is pending performs no additional service call.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { act, cleanup, renderHook } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SubmissionGuard, useCreateProject } from './useStudio';
import { studioService, type CreateProjectResult } from '@/services/studioService';

const RUNS = 200;

/** Submission ids the generated operations draw from (multiple mutations). */
const SUBMISSION_IDS = ['launcher', 'workflow:photo-enhancement', 'workflow:twilight'] as const;

type GuardOp = { kind: 'claim' | 'release'; id: string };

/**
 * Smart generator: operations are constrained to the real protocol surface —
 * claims and releases over a small, reused id pool — so interleavings collide
 * often instead of wandering through unique ids that never contend.
 */
const guardOpArb: fc.Arbitrary<GuardOp> = fc.record({
  kind: fc.constantFrom<'claim' | 'release'>('claim', 'release'),
  id: fc.constantFrom(...SUBMISSION_IDS),
});

const createResult = (projectId: string): CreateProjectResult => ({
  projectId,
  aiJobId: '1',
  aiJobIds: ['1'],
  jobs: [{ id: '1', type: 'photo' }],
  deepLink: { destination: 'projects', recordType: 'project', recordId: projectId },
  version: 1,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Feature: ai-editing-studio-revamp, Property 34: Duplicate submissions are prevented while pending', () => {
  it('accepts a claim exactly when no submission for that id is pending, for any interleaving', () => {
    fc.assert(
      fc.property(fc.array(guardOpArb, { minLength: 1, maxLength: 60 }), (ops) => {
        const guard = new SubmissionGuard();
        // Reference model: the set of ids whose request is still in flight.
        const inFlight = new Set<string>();

        for (const op of ops) {
          if (op.kind === 'claim') {
            const wasPending = inFlight.has(op.id);
            const accepted = guard.claim(op.id);

            // A claim issues a request iff nothing was pending for that id;
            // while pending, the duplicate is rejected (Req 12.7).
            expect(accepted).toBe(!wasPending);
            if (accepted) inFlight.add(op.id);
          } else {
            guard.release(op.id);
            inFlight.delete(op.id);
          }

          // The guard's view of pending work always matches the model, per id
          // and in aggregate, so unrelated mutations never block each other.
          for (const id of SUBMISSION_IDS) {
            expect(guard.isPending(id)).toBe(inFlight.has(id));
          }
          expect(guard.isPending()).toBe(inFlight.size > 0);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('never issues more than one concurrent request per submission id', () => {
    fc.assert(
      fc.property(fc.array(guardOpArb, { minLength: 1, maxLength: 60 }), (ops) => {
        const guard = new SubmissionGuard();
        // Net in-flight count per id: +1 per accepted claim, -1 per release of
        // a pending id. It must never exceed one for any interleaving.
        const issued = new Map<string, number>();

        for (const op of ops) {
          const current = issued.get(op.id) ?? 0;

          if (op.kind === 'claim') {
            if (guard.claim(op.id)) issued.set(op.id, current + 1);
          } else {
            const wasPending = guard.isPending(op.id);
            guard.release(op.id);
            if (wasPending) issued.set(op.id, current - 1);
          }

          expect(issued.get(op.id) ?? 0).toBeLessThanOrEqual(1);
          expect(issued.get(op.id) ?? 0).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('lets a released id be claimed again, so a completed mutation is resubmittable', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SUBMISSION_IDS),
        fc.integer({ min: 1, max: 10 }),
        (id, cycles) => {
          const guard = new SubmissionGuard();

          for (let i = 0; i < cycles; i += 1) {
            expect(guard.claim(id)).toBe(true);
            expect(guard.claim(id)).toBe(false);
            guard.release(id);
            expect(guard.isPending(id)).toBe(false);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('Feature: ai-editing-studio-revamp, Property 34: hook-level duplicate submit', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  it('performs no additional service call when submit is activated again while pending', async () => {
    let settle: (value: CreateProjectResult) => void = () => {};
    const create = vi.spyOn(studioService, 'createProject').mockImplementation(
      () =>
        new Promise<CreateProjectResult>((resolve) => {
          settle = resolve;
        }),
    );

    const { result } = renderHook(() => useCreateProject(), { wrapper });
    const variables = {
      submissionId: 'launcher',
      input: {
        workflowId: 'photo-enhancement' as const,
        sourceType: 'shoot' as const,
        shootId: 7,
        fileIds: [1, 2],
      },
    };

    let first: Promise<CreateProjectResult | null> = Promise.resolve(null);
    const duplicates: (CreateProjectResult | null)[] = [];

    await act(async () => {
      first = result.current.submit(variables);
      duplicates.push(await result.current.submit(variables));
      duplicates.push(await result.current.submit(variables));
    });

    // Every repeat activation while pending is rejected without a request.
    expect(duplicates).toEqual([null, null]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting('launcher')).toBe(true);

    await act(async () => {
      settle(createResult('p1'));
      await first;
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting('launcher')).toBe(false);
  });
});
