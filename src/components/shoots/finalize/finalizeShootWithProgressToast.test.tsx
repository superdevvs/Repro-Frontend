import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FinalizeProgressUnavailableError,
  type FinalizeProgress,
  type FinalizeProgressStage,
} from '@/services/finalizeShootService';

const postFinalizeShoot = vi.fn();
const fetchFinalizeProgress = vi.fn();
const fetchShootForFinalizeFallback = vi.fn();

vi.mock('@/services/finalizeShootService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/finalizeShootService')>();

  return {
    ...actual,
    postFinalizeShoot: (...args: unknown[]) => postFinalizeShoot(...args),
    fetchFinalizeProgress: (...args: unknown[]) => fetchFinalizeProgress(...args),
    fetchShootForFinalizeFallback: (...args: unknown[]) => fetchShootForFinalizeFallback(...args),
  };
});

const toastCalls: Array<Record<string, unknown>> = [];
const toastUpdates: Array<Record<string, unknown>> = [];
const dismiss = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  toast: (props: Record<string, unknown>) => {
    toastCalls.push(props);
    return {
      id: `toast-${toastCalls.length}`,
      dismiss,
      update: (next: Record<string, unknown>) => toastUpdates.push(next),
    };
  },
}));

const { finalizeShootWithProgressToast, isFinalizeRunning } = await import(
  './finalizeShootWithProgressToast'
);

const stage = (
  key: string,
  status: FinalizeProgressStage['status'],
  overrides: Partial<FinalizeProgressStage> = {},
): FinalizeProgressStage => ({
  key,
  label: key,
  status,
  message: null,
  processed: null,
  total: null,
  indeterminate: status === 'running',
  ...overrides,
});

const progress = (overrides: Partial<FinalizeProgress> = {}): FinalizeProgress => ({
  shoot_id: 7,
  run_id: 'run-1',
  status: 'running',
  message: 'Verifying media',
  error: null,
  failures: [],
  percentage: 40,
  indeterminate: false,
  stages: [stage('queued', 'completed'), stage('commit', 'running')],
  ...overrides,
});

/** Let the runner's poll loop advance past its 1.5s / 4s waits. */
const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
};

beforeEach(() => {
  vi.useFakeTimers();
  toastCalls.length = 0;
  toastUpdates.length = 0;
  dismiss.mockClear();
  postFinalizeShoot.mockReset();
  fetchFinalizeProgress.mockReset();
  fetchShootForFinalizeFallback.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('finalizeShootWithProgressToast', () => {
  it('shows a live progress toast and a single success toast when the pipeline completes', async () => {
    postFinalizeShoot.mockResolvedValue({ httpStatus: 202, progress: progress() });
    fetchFinalizeProgress
      .mockResolvedValueOnce(progress({ percentage: 70, stages: [stage('commit', 'completed')] }))
      .mockResolvedValue(
        progress({ status: 'completed', percentage: 100, message: 'Finalize complete' }),
      );

    const onRefresh = vi.fn();
    const run = finalizeShootWithProgressToast({ shootId: 7, onRefresh });

    await advance(5000);
    const outcome = await run;

    expect(outcome).toEqual({ status: 'completed', warnings: [] });
    expect(postFinalizeShoot).toHaveBeenCalledTimes(1);
    // One progress toast, updated in place, then one outcome toast.
    expect(toastCalls).toHaveLength(2);
    expect(toastCalls[0].duration).toBe(Infinity);
    expect(toastUpdates.length).toBeGreaterThan(0);
    expect(dismiss).toHaveBeenCalled();
    expect(toastCalls[1]).toMatchObject({ title: 'Finalize complete' });
    // Refreshed when delivery committed and again when the run settled.
    expect(onRefresh).toHaveBeenCalled();
  });

  it('reports sub-job failures as warnings without calling the run a failure', async () => {
    postFinalizeShoot.mockResolvedValue({ httpStatus: 202, progress: progress() });
    fetchFinalizeProgress.mockResolvedValue(
      progress({
        status: 'completed',
        percentage: 100,
        failures: [{ stage: 'delivery_email', label: 'Notifying the client', error: 'SMTP down' }],
      }),
    );

    const run = finalizeShootWithProgressToast({ shootId: 7 });
    await advance(5000);
    const outcome = await run;

    expect(outcome).toEqual({
      status: 'completed',
      warnings: ['Notifying the client: SMTP down'],
    });
    expect(toastCalls[1]).toMatchObject({ title: 'Finalized with warnings' });
    expect(toastCalls[1].variant).toBeUndefined();
  });

  it('surfaces a failed pipeline as a destructive toast carrying the backend reason', async () => {
    postFinalizeShoot.mockResolvedValue({ httpStatus: 202, progress: progress() });
    fetchFinalizeProgress.mockResolvedValue(
      progress({ status: 'failed', error: 'No edited files to finalize' }),
    );

    const run = finalizeShootWithProgressToast({ shootId: 7 });
    await advance(5000);
    const outcome = await run;

    expect(outcome).toEqual({ status: 'failed', message: 'No edited files to finalize' });
    expect(toastCalls[1]).toMatchObject({
      title: 'Finalize failed',
      description: 'No edited files to finalize',
      variant: 'destructive',
    });
  });

  it('reports a rejected finalize request without leaving the progress toast up', async () => {
    postFinalizeShoot.mockRejectedValue(new Error('Shoot can only be finalized from editing'));

    const outcome = await finalizeShootWithProgressToast({ shootId: 7 });

    expect(outcome).toEqual({
      status: 'error',
      message: 'Shoot can only be finalized from editing',
    });
    expect(dismiss).toHaveBeenCalled();
    expect(fetchFinalizeProgress).not.toHaveBeenCalled();
  });

  it('falls back to shoot-status polling when the progress endpoint is unavailable', async () => {
    postFinalizeShoot.mockResolvedValue({ httpStatus: 202, progress: null });
    fetchFinalizeProgress.mockRejectedValue(new FinalizeProgressUnavailableError('nope'));

    const fetchShoot = vi
      .fn()
      .mockResolvedValueOnce({ workflowStatus: 'editing' })
      .mockResolvedValue({ workflowStatus: 'delivered' });

    const run = finalizeShootWithProgressToast({ shootId: 7, fetchShoot });
    await advance(12000);
    const outcome = await run;

    expect(outcome).toEqual({ status: 'completed', warnings: [] });
    expect(fetchShoot).toHaveBeenCalled();
    expect(fetchShootForFinalizeFallback).not.toHaveBeenCalled();
    expect(toastCalls[1]).toMatchObject({ title: 'Finalize complete' });
  });

  it('retries a transient progress read instead of dropping to the fallback poller', async () => {
    postFinalizeShoot.mockResolvedValue({ httpStatus: 202, progress: null });
    fetchFinalizeProgress
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValue(progress({ status: 'completed', percentage: 100 }));

    const fetchShoot = vi.fn();
    const run = finalizeShootWithProgressToast({ shootId: 7, fetchShoot });
    await advance(6000);
    const outcome = await run;

    expect(outcome.status).toBe('completed');
    expect(fetchFinalizeProgress).toHaveBeenCalledTimes(2);
    expect(fetchShoot).not.toHaveBeenCalled();
  });

  it('detects a background failure through the fallback poller', async () => {
    postFinalizeShoot.mockResolvedValue({ httpStatus: 202, progress: null });
    fetchFinalizeProgress.mockRejectedValue(new FinalizeProgressUnavailableError('nope'));

    const fetchShoot = vi.fn().mockResolvedValue({
      workflowStatus: 'ready',
      workflowLogs: [{ action: 'finalize_failed' }],
    });

    const run = finalizeShootWithProgressToast({ shootId: 7, fetchShoot });
    await advance(8000);
    const outcome = await run;

    expect(outcome.status).toBe('failed');
    expect(toastCalls[1]).toMatchObject({ variant: 'destructive' });
  });

  it('shares one request and one toast when the same shoot is finalized twice at once', async () => {
    postFinalizeShoot.mockResolvedValue({ httpStatus: 202, progress: progress() });
    fetchFinalizeProgress.mockResolvedValue(progress({ status: 'completed', percentage: 100 }));

    const first = finalizeShootWithProgressToast({ shootId: 7 });
    const second = finalizeShootWithProgressToast({ shootId: 7 });

    await advance(5000);
    const [firstOutcome, secondOutcome] = await Promise.all([first, second]);

    expect(firstOutcome).toEqual(secondOutcome);
    expect(postFinalizeShoot).toHaveBeenCalledTimes(1);
    // Progress toast + outcome toast only: the duplicate call attached to the
    // in-flight run instead of stacking its own toast.
    expect(toastCalls).toHaveLength(2);
    expect(isFinalizeRunning(7)).toBe(false);
  });

  it('skips the pipeline entirely for legacy synchronous finalize responses', async () => {
    postFinalizeShoot.mockResolvedValue({ httpStatus: 200 });
    const onRefresh = vi.fn();

    const outcome = await finalizeShootWithProgressToast({ shootId: 7, onRefresh });

    expect(outcome).toEqual({ status: 'completed', warnings: [] });
    expect(fetchFinalizeProgress).not.toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
