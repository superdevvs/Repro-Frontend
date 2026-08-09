import axios from 'axios';
import { toast } from '@/hooks/use-toast';
import {
  fetchFinalizeProgress,
  fetchShootForFinalizeFallback,
  FinalizeProgressUnavailableError,
  postFinalizeShoot,
  readFinalizeOutcomeFromShoot,
  type FinalizeProgress,
  type FinalizeProgressStage,
} from '@/services/finalizeShootService';
import { FinalizeProgressToastContent } from './FinalizeProgressToastContent';

export type FinalizeOutcome =
  | { status: 'completed'; warnings: string[] }
  | { status: 'failed'; message: string }
  | { status: 'pending'; message: string }
  | { status: 'error'; message: string };

interface RunFinalizeOptions {
  shootId: string | number;
  /** Request body for POST /finalize. Build it with `buildFinalizeRequestBody`. */
  body?: Record<string, unknown>;
  /**
   * Fallback status source, used only when the progress endpoint is
   * unavailable. Anything that resolves to a shoot payload works — most
   * callers already have a `refreshShoot`.
   */
  fetchShoot?: () => Promise<unknown>;
  /** Called once delivery has committed, and again when the run settles. */
  onRefresh?: () => unknown;
  /** Progress snapshots; `null` means "running, but not measurable". */
  onProgress?: (progress: FinalizeProgress | null) => void;
}

export interface FinalizeToastOptions extends RunFinalizeOptions {
  /** Human label for the shoot, e.g. its address, used in toast copy. */
  shootLabel?: string;
}

const PROGRESS_POLL_MS = 1500;
const FALLBACK_POLL_MS = 4000;
const MAX_WAIT_MS = 180000;

const TOAST_COPY = {
  starting: 'Sending finalize request…',
  running: 'Running background processes…',
  title: 'Finalizing shoot',
  doneTitle: 'Finalize complete',
  doneDescription: 'The shoot is delivered and the client has been notified.',
  warningsTitle: 'Finalized with warnings',
  failedTitle: 'Finalize failed',
  pendingTitle: 'Still processing',
  pendingDescription: 'Finalize is still running in the background. Check back in a moment.',
  errorTitle: 'Error',
  errorDescription: 'Failed to finalize shoot',
};

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const readErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { message?: string } | undefined;
    return payload?.message?.trim() || error.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const collectWarnings = (progress: FinalizeProgress | null): string[] =>
  (progress?.failures ?? []).map((failure) => `${failure.label}: ${failure.error}`);

/**
 * Registry of in-flight finalize runs, so the same shoot triggered (or merely
 * observed) from several components shares one request, one poll loop and one
 * toast instead of racing duplicates.
 */
const activeRuns = new Map<string, {
  promise: Promise<FinalizeOutcome>;
  listeners: Set<(progress: FinalizeProgress | null) => void>;
}>();

export const isFinalizeRunning = (shootId: string | number): boolean =>
  activeRuns.has(String(shootId));

/**
 * Drive one finalize: POST the request, then follow the queued pipeline to a
 * terminal state. Emits progress snapshots but renders no UI, so it can back
 * both the single-shoot toast and the bulk toast.
 */
export const runFinalize = (options: RunFinalizeOptions): Promise<FinalizeOutcome> => {
  const key = String(options.shootId);
  const existing = activeRuns.get(key);

  if (existing) {
    if (options.onProgress) {
      existing.listeners.add(options.onProgress);
    }
    return existing.promise;
  }

  const listeners = new Set<(progress: FinalizeProgress | null) => void>();
  if (options.onProgress) {
    listeners.add(options.onProgress);
  }

  const emit = (progress: FinalizeProgress | null) => {
    listeners.forEach((listener) => listener(progress));
  };

  const promise = executeFinalize(options, emit).finally(() => {
    activeRuns.delete(key);
  });

  activeRuns.set(key, { promise, listeners });

  return promise;
};

const executeFinalize = async (
  options: RunFinalizeOptions,
  emit: (progress: FinalizeProgress | null) => void,
): Promise<FinalizeOutcome> => {
  const { shootId, body = {}, fetchShoot, onRefresh } = options;
  let refreshedOnCommit = false;

  const refresh = () => {
    try {
      onRefresh?.();
    } catch {
      // Refreshing the caller's view must never change the finalize outcome.
    }
  };

  let progress: FinalizeProgress | null = null;

  try {
    const response = await postFinalizeShoot(shootId, body);

    // Pre-202 backends finalize synchronously: there is no pipeline to follow.
    if (response.httpStatus !== 202) {
      refresh();
      return { status: 'completed', warnings: [] };
    }

    progress = response.progress ?? null;
    emit(progress);
  } catch (error) {
    return { status: 'error', message: readErrorMessage(error, TOAST_COPY.errorDescription) };
  }

  const deadline = Date.now() + MAX_WAIT_MS;
  let progressAvailable = true;

  while (Date.now() < deadline) {
    if (progressAvailable) {
      // `undefined` = this read failed; `null` = the backend tracks nothing.
      let fetched: FinalizeProgress | null | undefined;

      try {
        fetched = await fetchFinalizeProgress(shootId);
      } catch (error) {
        if (error instanceof FinalizeProgressUnavailableError) {
          progressAvailable = false;
        }
      }

      if (progressAvailable && fetched === undefined) {
        // Transient failure: keep the last snapshot and try again.
        await delay(PROGRESS_POLL_MS);
        continue;
      }

      if (progressAvailable && fetched === null) {
        // Nothing tracked (TTL expired, or finalize ran before we polled):
        // decide the outcome from the shoot itself.
        progressAvailable = false;
      }

      if (progressAvailable && fetched) {
        progress = fetched;
        emit(progress);

        const commitDone = progress.stages.some(
          (stage) => stage.key === 'commit' && stage.status === 'completed',
        );
        if (commitDone && !refreshedOnCommit) {
          refreshedOnCommit = true;
          refresh();
        }

        if (progress.status === 'completed') {
          refresh();
          return { status: 'completed', warnings: collectWarnings(progress) };
        }

        if (progress.status === 'failed') {
          refresh();
          return {
            status: 'failed',
            message: progress.error || TOAST_COPY.errorDescription,
          };
        }

        await delay(PROGRESS_POLL_MS);
        continue;
      }
    }

    // ---- Fallback: plain shoot-status polling (pre-progress backends). ----
    emit(null);

    try {
      const shoot = await (fetchShoot ? fetchShoot() : fetchShootForFinalizeFallback(shootId));
      const outcome = readFinalizeOutcomeFromShoot(shoot);

      if (outcome === 'delivered') {
        refresh();
        return { status: 'completed', warnings: [] };
      }

      if (outcome === 'failed') {
        refresh();
        return {
          status: 'failed',
          message: 'Finalize failed in background. Check the Activity Log for details.',
        };
      }
    } catch {
      // Keep polling: a single failed read should not end the run.
    }

    await delay(FALLBACK_POLL_MS);
  }

  refresh();

  return { status: 'pending', message: TOAST_COPY.pendingDescription };
};

/**
 * Finalize one shoot with the shared progress toast: a live bar plus a line
 * per background process (media verification, file caching, MLS publish,
 * client notification), then a single outcome toast.
 */
export const finalizeShootWithProgressToast = async (
  options: FinalizeToastOptions,
): Promise<FinalizeOutcome> => {
  const { shootLabel, ...runOptions } = options;
  const suffix = shootLabel ? ` · ${shootLabel}` : '';

  // Already tracked elsewhere: attach to the existing run instead of stacking
  // a second toast for the same shoot.
  if (isFinalizeRunning(runOptions.shootId)) {
    return runFinalize(runOptions);
  }

  const handle = toast({
    title: `${TOAST_COPY.title}${suffix}`,
    description: <FinalizeProgressToastContent progress={null} fallbackMessage={TOAST_COPY.starting} />,
    duration: Infinity,
  });

  const render = (progress: FinalizeProgress | null) => {
    handle.update({
      id: handle.id,
      title: `${TOAST_COPY.title}${suffix}`,
      description: (
        <FinalizeProgressToastContent progress={progress} fallbackMessage={TOAST_COPY.running} />
      ),
      duration: Infinity,
    });
  };

  const outcome = await runFinalize({ ...runOptions, onProgress: render });

  handle.dismiss();

  if (outcome.status === 'completed') {
    toast({
      title: outcome.warnings.length ? TOAST_COPY.warningsTitle : TOAST_COPY.doneTitle,
      description: outcome.warnings.length
        ? outcome.warnings.join(' · ')
        : TOAST_COPY.doneDescription,
    });
  } else if (outcome.status === 'pending') {
    toast({ title: TOAST_COPY.pendingTitle, description: outcome.message });
  } else {
    toast({
      title: outcome.status === 'failed' ? TOAST_COPY.failedTitle : TOAST_COPY.errorTitle,
      description: outcome.message,
      variant: 'destructive',
    });
  }

  return outcome;
};

interface BulkFinalizeTarget {
  shootId: string | number;
  shootLabel?: string;
  body?: Record<string, unknown>;
}

const bulkStage = (
  target: BulkFinalizeTarget,
  progress: FinalizeProgress | null,
  outcome: FinalizeOutcome | null,
): FinalizeProgressStage => {
  const label = target.shootLabel || `Shoot #${target.shootId}`;
  const activeStage = progress?.stages.find((stage) => stage.status === 'running');

  if (outcome) {
    return {
      key: String(target.shootId),
      label,
      status: outcome.status === 'completed' ? 'completed' : 'failed',
      message: outcome.status === 'completed' ? null : outcome.message,
      processed: null,
      total: null,
      indeterminate: false,
    };
  }

  return {
    key: String(target.shootId),
    label: activeStage ? `${label} — ${activeStage.label}` : label,
    status: 'running',
    message: null,
    processed: activeStage?.processed ?? null,
    total: activeStage?.total ?? null,
    indeterminate: !activeStage || activeStage.indeterminate,
  };
};

/**
 * Finalize several shoots behind a single aggregate toast: overall progress is
 * the mean of the individual runs, with one line per shoot.
 */
export const finalizeShootsWithProgressToast = async (
  targets: BulkFinalizeTarget[],
  options: { onRefresh?: () => unknown } = {},
): Promise<FinalizeOutcome[]> => {
  if (targets.length === 0) return [];
  if (targets.length === 1) {
    return [await finalizeShootWithProgressToast({ ...targets[0], onRefresh: options.onRefresh })];
  }

  const snapshots = new Map<string, FinalizeProgress | null>();
  const outcomes = new Map<string, FinalizeOutcome>();

  const handle = toast({
    title: `Finalizing ${targets.length} shoots`,
    description: <FinalizeProgressToastContent progress={null} fallbackMessage={TOAST_COPY.starting} />,
    duration: Infinity,
  });

  const render = () => {
    const settled = outcomes.size;
    const percentages = targets.map((target) => {
      const key = String(target.shootId);
      if (outcomes.has(key)) return 100;
      return snapshots.get(key)?.percentage ?? 0;
    });

    const aggregate: FinalizeProgress = {
      shoot_id: 0,
      run_id: 'bulk',
      status: settled === targets.length ? 'completed' : 'running',
      message: `${settled}/${targets.length} shoots finalized`,
      error: null,
      failures: [],
      percentage: Math.round(percentages.reduce((sum, value) => sum + value, 0) / targets.length),
      indeterminate: false,
      stages: targets.map((target) => {
        const key = String(target.shootId);
        return bulkStage(target, snapshots.get(key) ?? null, outcomes.get(key) ?? null);
      }),
    };

    handle.update({
      id: handle.id,
      title: `Finalizing ${targets.length} shoots`,
      description: <FinalizeProgressToastContent progress={aggregate} />,
      duration: Infinity,
    });
  };

  render();

  const results = await Promise.all(
    targets.map(async (target) => {
      const key = String(target.shootId);
      const outcome = await runFinalize({
        shootId: target.shootId,
        body: target.body,
        onRefresh: options.onRefresh,
        onProgress: (progress) => {
          snapshots.set(key, progress);
          render();
        },
      });

      outcomes.set(key, outcome);
      render();

      return outcome;
    }),
  );

  handle.dismiss();

  const failed = results.filter(
    (result): result is Exclude<FinalizeOutcome, { status: 'completed' }> =>
      result.status !== 'completed',
  );

  if (failed.length === 0) {
    toast({
      title: TOAST_COPY.doneTitle,
      description: `${results.length} shoots finalized and delivered.`,
    });
  } else {
    toast({
      title: failed.length === results.length ? TOAST_COPY.failedTitle : TOAST_COPY.warningsTitle,
      description: `${results.length - failed.length} of ${results.length} shoots finalized. ${failed[0].message}`,
      variant: failed.length === results.length ? 'destructive' : 'default',
    });
  }

  return results;
};
