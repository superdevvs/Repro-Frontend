import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Clock3, ImageIcon, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useStudioQueue } from '@/hooks/useStudio';
import { resolveGeneratedAsset, resolveStudioAssetPath } from '@/lib/studioAssets';
import { cn } from '@/lib/utils';
import type { QueueRecord } from '@/services/studioService';

import { SectionError, SectionSkeleton, StatusBadge } from './feedback/StudioFeedback';
import { useOptionalStudioShell } from './StudioShell';

interface LiveQueueState {
  records: QueueRecord[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const LiveQueueContext = createContext<LiveQueueState | null>(null);

/** Mounted above destinations so the last successful queue survives navigation. */
export function LiveQueueProvider({ children }: { children: ReactNode }) {
  const query = useStudioQueue();
  const lastSuccessful = useRef<QueueRecord[]>([]);

  useEffect(() => {
    if (query.data) lastSuccessful.current = query.data;
  }, [query.data]);

  const value = useMemo<LiveQueueState>(
    () => ({
      records: query.data ?? lastSuccessful.current,
      isLoading: query.isLoading && lastSuccessful.current.length === 0,
      isError: query.isError,
      refetch: () => {
        void query.refetch();
      },
    }),
    [query.data, query.isError, query.isLoading, query.refetch],
  );

  return <LiveQueueContext.Provider value={value}>{children}</LiveQueueContext.Provider>;
}

export function queueProgressPresentation(progress: number | null): {
  value: number | null;
  label: string;
} {
  if (progress === null) return { value: null, label: 'Progress unavailable' };
  const value = Math.min(100, Math.max(0, Math.round(progress)));
  return { value, label: `${value}%` };
}

export function queueEtaPresentation(record: QueueRecord): string {
  if (!record.eta) return 'ETA unavailable';
  const seconds = Math.max(0, Math.round(record.eta.estimateSeconds));
  if (seconds < 60) return `About ${seconds}s remaining`;
  return `About ${Math.ceil(seconds / 60)} min remaining`;
}

export function queueFallbackThumbnail(workflowTitle: string): string | null {
  const normalized = workflowTitle.toLowerCase();
  if (normalized.includes('twilight')) return resolveGeneratedAsset('queue-twilight');
  if (normalized.includes('video') || normalized.includes('cleanup')) {
    return resolveGeneratedAsset('queue-video-cleanup');
  }
  return resolveGeneratedAsset('queue-photo-enhancement');
}

export function LiveQueue({
  className,
  onRetry,
  compact = false,
}: {
  className?: string;
  onRetry?: (record: QueueRecord) => void;
  compact?: boolean;
}) {
  const state = useContext(LiveQueueContext);
  const shell = useOptionalStudioShell();

  if (!state) {
    return (
      <SectionError
        className={className}
        title="Live queue is not connected"
        message="Mount LiveQueueProvider above the Studio destinations."
      />
    );
  }

  return (
    <section className={cn('space-y-4', className)} aria-labelledby="live-queue-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="live-queue-heading" className="text-base font-semibold">
            AI Queue
          </h2>
          <p className={cn('text-sm text-muted-foreground', compact && 'sr-only')}>
            Active work and recently finished jobs
          </p>
        </div>
        {compact ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => shell?.setDestination('queue')}>
            View all
          </Button>
        ) : null}
      </div>

      {state.isLoading ? (
        <SectionSkeleton label="Loading live AI queue" />
      ) : state.records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Clock3 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">Queue is clear</p>
          <p className="mt-1 text-xs text-muted-foreground">
            New AI jobs appear here as soon as they are submitted.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {(compact ? state.records.slice(0, 3) : state.records).map((record) => {
            const progress = queueProgressPresentation(record.progress);
            const thumbnail =
              resolveStudioAssetPath(record.thumbnailUrl) ??
              queueFallbackThumbnail(record.workflowTitle);
            const failed = record.status.toLowerCase() === 'failed';
            return (
              <li key={record.id} className="rounded-xl border border-border bg-card p-3">
                <button
                  type="button"
                  className="w-full text-left transition-colors hover:bg-muted/40"
                  aria-label={`Open ${record.workflowTitle} job`}
                  onClick={() => shell?.openDeepLink(record.deepLink)}
                >
                  <div className="flex gap-3">
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={`${record.workflowTitle} property thumbnail`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{record.workflowTitle}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {record.contextLabel ?? record.context?.label ?? 'Studio project'}
                          </p>
                        </div>
                        <StatusBadge status={record.status} />
                      </div>
                      <div className="mt-3">
                        {progress.value === null ? (
                          <div
                            className="h-1.5 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-label="Progress unavailable"
                          >
                            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
                          </div>
                        ) : (
                          <Progress value={progress.value} aria-label={progress.label} className="h-1.5" />
                        )}
                        <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-muted-foreground">
                          <span>{progress.label}</span>
                          <span>{queueEtaPresentation(record)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
                {failed ? (
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <p className="text-xs text-destructive">
                      {record.failureReason || 'The provider did not return a reason.'}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (onRetry) onRetry(record);
                        else shell?.openDeepLink(record.deepLink);
                      }}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      Retry
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {state.isError ? (
        <SectionError
          title="Queue refresh failed"
          message="Showing the last successful queue state."
          onRetry={state.refetch}
        />
      ) : null}
    </section>
  );
}

export default LiveQueue;
