/**
 * Unit tests for the Studio query hooks and mutations (task 9.2).
 *
 * Covers the result-driven queue poll interval (Req 7.3, 7.4, 7.5), the
 * duplicate-submit guard and idempotency key on create/workflow submit
 * (Req 12.7), and query invalidation after a successful mutation (Req 12.8).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  CREATE_PROJECT_INVALIDATE_KEYS,
  STUDIO_QUEUE_MAX_POLL_INTERVAL,
  STUDIO_QUEUE_POLL_INTERVAL,
  STUDIO_QUERY_KEYS,
  SubmissionGuard,
  createIdempotencyKey,
  getStudioQueueRefetchInterval,
  isTerminalQueueStatus,
  useCreateProject,
  useStudioQueue,
  useStudioSearch,
  useSubmitWorkflow,
} from './useStudio';
import { studioService, type CreateProjectResult, type QueueRecord } from '@/services/studioService';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const queueRecord = (id: string, status: string): QueueRecord => ({
  id,
  aiJobId: id.split('-')[1] ?? id,
  jobType: 'photo',
  workflowTitle: 'Photo Enhancement',
  context: null,
  contextLabel: null,
  thumbnailUrl: null,
  status,
  progress: null,
  eta: null,
  failureReason: null,
  terminalAt: null,
  version: '2026-01-01T00:00:00.000Z',
  deepLink: { destination: 'queue', recordType: 'ai_job', recordId: id },
});

const createResult = (projectId: string): CreateProjectResult => ({
  projectId,
  aiJobId: '1',
  aiJobIds: ['1'],
  jobs: [{ id: '1', type: 'photo' }],
  deepLink: { destination: 'projects', recordType: 'project', recordId: projectId },
  version: 1,
});

describe('queue polling helpers', () => {
  it('polls at a bounded interval while a record is non-terminal', () => {
    const interval = getStudioQueueRefetchInterval([
      queueRecord('photo-1', 'completed'),
      queueRecord('photo-2', 'processing'),
    ]);

    expect(interval).toBe(STUDIO_QUEUE_POLL_INTERVAL);
    expect(interval as number).toBeGreaterThan(0);
    expect(interval as number).toBeLessThanOrEqual(STUDIO_QUEUE_MAX_POLL_INTERVAL);
  });

  it('stops polling when every record is terminal, empty, or not loaded', () => {
    expect(
      getStudioQueueRefetchInterval([
        queueRecord('photo-1', 'completed'),
        queueRecord('photo-2', 'failed'),
        queueRecord('video-3', 'cancelled'),
      ]),
    ).toBe(false);
    expect(getStudioQueueRefetchInterval([])).toBe(false);
    expect(getStudioQueueRefetchInterval(undefined)).toBe(false);
  });

  it('recognizes terminal statuses case-insensitively', () => {
    expect(isTerminalQueueStatus('COMPLETED')).toBe(true);
    expect(isTerminalQueueStatus('failed')).toBe(true);
    expect(isTerminalQueueStatus('cancelled')).toBe(true);
    expect(isTerminalQueueStatus('stitching')).toBe(false);
    expect(isTerminalQueueStatus(null)).toBe(false);
  });
});

describe('SubmissionGuard', () => {
  it('rejects a second claim until the first is released', () => {
    const guard = new SubmissionGuard();

    expect(guard.claim('a')).toBe(true);
    expect(guard.claim('a')).toBe(false);
    expect(guard.isPending('a')).toBe(true);
    expect(guard.claim('b')).toBe(true);

    guard.release('a');
    expect(guard.isPending('a')).toBe(false);
    expect(guard.claim('a')).toBe(true);
  });

  it('generates a distinct idempotency key per call', () => {
    expect(createIdempotencyKey()).not.toBe(createIdempotencyKey());
  });
});

describe('Studio hooks', () => {
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

  it('fetches the queue and derives its refetch interval from the result', async () => {
    vi.spyOn(studioService, 'getQueue').mockResolvedValue([queueRecord('photo-1', 'processing')]);

    const { result } = renderHook(() => useStudioQueue(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe('photo-1');
    expect(getStudioQueueRefetchInterval(result.current.data)).toBe(STUDIO_QUEUE_POLL_INTERVAL);
  });

  it('does not search until a non-empty query is provided', async () => {
    const search = vi.spyOn(studioService, 'search').mockResolvedValue([]);

    const { result, rerender } = renderHook(({ q }: { q: string }) => useStudioSearch(q), {
      wrapper,
      initialProps: { q: '   ' },
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(search).not.toHaveBeenCalled();

    rerender({ q: ' maple ' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(search).toHaveBeenCalledWith('maple');
  });

  it('sends an idempotency key and invalidates affected queries on success', async () => {
    const create = vi
      .spyOn(studioService, 'createProject')
      .mockResolvedValue(createResult('p1'));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => {
      await result.current.submit({
        input: { workflowId: 'photo-enhancement', sourceType: 'shoot', shootId: 4, fileIds: [1] },
      });
    });

    expect(create).toHaveBeenCalledTimes(1);
    const [, idempotencyKey] = create.mock.calls[0];
    expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);

    const invalidated = invalidate.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidated).toEqual(
      expect.arrayContaining(CREATE_PROJECT_INVALIDATE_KEYS.map((key) => [...key])),
    );
    expect(invalidated).toEqual(expect.arrayContaining([[...STUDIO_QUERY_KEYS.projects()]]));
  });

  it('blocks a duplicate submit while the first submission is pending', async () => {
    let release: (value: CreateProjectResult) => void = () => {};
    vi.spyOn(studioService, 'createProject').mockImplementation(
      () =>
        new Promise<CreateProjectResult>((resolve) => {
          release = resolve;
        }),
    );

    const { result } = renderHook(() => useCreateProject(), { wrapper });
    const variables = {
      input: {
        workflowId: 'photo-enhancement' as const,
        sourceType: 'shoot' as const,
        shootId: 4,
        fileIds: [1],
      },
    };

    let first: Promise<CreateProjectResult | null> = Promise.resolve(null);
    let duplicate: CreateProjectResult | null = createResult('unused');

    await act(async () => {
      first = result.current.submit(variables);
      duplicate = await result.current.submit(variables);
    });

    expect(duplicate).toBeNull();
    expect(studioService.createProject).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(createResult('p1'));
      await first;
    });

    expect(result.current.isSubmitting()).toBe(false);
  });

  it('reuses the idempotency key when a failed submission is retried', async () => {
    const create = vi
      .spyOn(studioService, 'createProject')
      .mockRejectedValueOnce(new Error('server down'))
      .mockResolvedValueOnce(createResult('p1'));

    const { result } = renderHook(() => useCreateProject(), { wrapper });
    const variables = {
      submissionId: 'launcher',
      input: {
        workflowId: 'photo-enhancement' as const,
        sourceType: 'shoot' as const,
        shootId: 4,
        fileIds: [1],
      },
    };

    await act(async () => {
      await expect(result.current.submit(variables)).rejects.toThrow('server down');
    });
    await act(async () => {
      await result.current.submit(variables);
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][1]).toBe(create.mock.calls[1][1]);
  });

  it('fixes the workflow id on workflow-submit mutations', async () => {
    const create = vi
      .spyOn(studioService, 'createProject')
      .mockResolvedValue(createResult('p2'));

    const { result } = renderHook(() => useSubmitWorkflow('twilight'), { wrapper });

    await act(async () => {
      await result.current.submitWorkflow({
        input: { sourceType: 'upload', mediaRefs: ['studio/uploads/1/2/a.jpg'] },
      });
    });

    expect(create.mock.calls[0][0]).toMatchObject({
      workflowId: 'twilight',
      sourceType: 'upload',
      mediaRefs: ['studio/uploads/1/2/a.jpg'],
    });
  });
});
