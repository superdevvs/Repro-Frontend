// Property-based test for the Studio duplicate-submit guard.
//
// Feature: ai-editing-studio-revamp, Property 34: Duplicate submissions are
// prevented while pending.
//
// **Validates: Requirements 12.7**
//
// For any server mutation, activating its trigger again while the first request
// is still pending issues no additional request. The generated property drives
// the pure `SubmissionGuard` through arbitrary interleavings of claim/release
// operations across arbitrary submission ids; the example tests assert the same
// behaviour at the `useCreateProject` hook level, where a blocked duplicate must
// resolve to `null` without reaching the service.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { act, cleanup, renderHook } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SubmissionGuard, useCreateProject } from './useStudio';
import { studioService, type CreateProjectResult } from '@/services/studioService';

const NUM_RUNS = 30;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Smart generator: a small id pool so arbitrary operation sequences actually
 * collide on the same submission id (the interesting case), while still covering
 * several distinct ids so cross-id independence is exercised.
 */
const submissionId = fc.constantFrom(
  'studio-submission',
  'launcher',
  'workflow:photo-enhancement',
  'workflow:twilight',
);

type Op = { kind: 'claim' | 'release'; id: string };

const operation: fc.Arbitrary<Op> = fc.record({
  kind: fc.constantFrom('claim' as const, 'release' as const),
  id: submissionId,
});

describe('Feature: ai-editing-studio-revamp, Property 34: Duplicate submissions are prevented while pending', () => {
  it('refuses a claim while the id is pending, allows it after release, and never blocks distinct ids', () => {
    fc.assert(
      fc.property(fc.array(operation, { maxLength: 40 }), (ops) => {
        const guard = new SubmissionGuard();
        // Reference model of pending submissions, independent of the guard.
        const pending = new Set<string>();

        for (const op of ops) {
          if (op.kind === 'claim') {
            const wasPending = pending.has(op.id);
            const claimed = guard.claim(op.id);

            // Req 12.7: a second claim while pending is always refused; a claim
            // of an id that is not pending always succeeds.
            expect(claimed).toBe(!wasPending);
            pending.add(op.id);

            // A refused duplicate must not disturb the pending state.
            expect(guard.isPending(op.id)).toBe(true);
          } else {
            guard.release(op.id);
            pending.delete(op.id);

            // A released id is immediately claimable again.
            expect(guard.isPending(op.id)).toBe(false);
          }

          // The guard's view agrees with the model for every id, so distinct
          // submission ids never block each other.
          for (const id of ['studio-submission', 'launcher', 'workflow:photo-enhancement', 'workflow:twilight', 'unused-id']) {
            expect(guard.isPending(id)).toBe(pending.has(id));
          }
          expect(guard.isPending()).toBe(pending.size > 0);
        }

        // Any id that is not currently pending can still be claimed, whatever
        // the interleaving produced.
        const free = ['studio-submission', 'launcher', 'workflow:twilight', 'fresh-id'].filter(
          (id) => !pending.has(id),
        );
        for (const id of free) {
          expect(guard.claim(id)).toBe(true);
          guard.release(id);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('lets every distinct id be claimed once while all of them are pending', () => {
    fc.assert(
      fc.property(fc.uniqueArray(submissionId, { minLength: 1, maxLength: 4 }), (ids) => {
        const guard = new SubmissionGuard();

        // Distinct ids are independent: each first claim succeeds.
        for (const id of ids) {
          expect(guard.claim(id)).toBe(true);
        }
        // Every repeat claim is refused while its submission is still pending.
        for (const id of ids) {
          expect(guard.claim(id)).toBe(false);
        }
        // Releasing one id frees only that id.
        const [first, ...rest] = ids;
        guard.release(first);
        expect(guard.claim(first)).toBe(true);
        for (const id of rest) {
          expect(guard.claim(id)).toBe(false);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Property 34 example: useCreateProject blocks duplicate submissions', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;

  const result_ = (projectId: string): CreateProjectResult => ({
    projectId,
    aiJobId: '1',
    aiJobIds: ['1'],
    jobs: [{ id: '1', type: 'photo' }],
    deepLink: { destination: 'projects', recordType: 'project', recordId: projectId },
    version: 1,
  });

  const variables = {
    submissionId: 'launcher',
    input: {
      workflowId: 'photo-enhancement' as const,
      sourceType: 'shoot' as const,
      shootId: 4,
      fileIds: [1],
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  it('resolves the duplicate submit to null and calls the service once while pending', async () => {
    let settle: (value: CreateProjectResult) => void = () => {};
    const create = vi.spyOn(studioService, 'createProject').mockImplementation(
      () =>
        new Promise<CreateProjectResult>((resolve) => {
          settle = resolve;
        }),
    );

    const { result } = renderHook(() => useCreateProject(), { wrapper });

    let inFlight: Promise<CreateProjectResult | null> = Promise.resolve(null);
    let duplicate: CreateProjectResult | null = result_('unused');

    await act(async () => {
      inFlight = result.current.submit(variables);
      duplicate = await result.current.submit(variables);
    });

    expect(duplicate).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting('launcher')).toBe(true);

    await act(async () => {
      settle(result_('p1'));
      await inFlight;
    });

    expect(result.current.isSubmitting('launcher')).toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reuses the idempotency key when a failed submission is retried', async () => {
    const create = vi
      .spyOn(studioService, 'createProject')
      .mockRejectedValueOnce(new Error('server unavailable'))
      .mockResolvedValueOnce(result_('p1'));

    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => {
      await expect(result.current.submit(variables)).rejects.toThrow('server unavailable');
    });
    // The guard released the id after the failure, so the retry is allowed.
    expect(result.current.isSubmitting('launcher')).toBe(false);

    await act(async () => {
      await result.current.submit(variables);
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][1]).toBe(create.mock.calls[1][1]);
  });
});
