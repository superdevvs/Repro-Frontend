import React from 'react';
import { AlertTriangle, Check, Loader2, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  FinalizeProgress,
  FinalizeProgressStage,
  FinalizeStageStatus,
} from '@/services/finalizeShootService';

interface FinalizeProgressToastContentProps {
  /** Live progress document, or null while we only know work is running. */
  progress: FinalizeProgress | null;
  /** Shown when there is no progress document (fallback / status polling). */
  fallbackMessage?: string;
}

const stageIcons: Record<FinalizeStageStatus, React.ReactNode> = {
  pending: <span className="mt-[3px] block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />,
  running: <Loader2 className="mt-[1px] h-3 w-3 animate-spin text-blue-500" />,
  completed: <Check className="mt-[1px] h-3 w-3 text-emerald-500" />,
  skipped: <MinusCircle className="mt-[1px] h-3 w-3 text-muted-foreground/60" />,
  failed: <AlertTriangle className="mt-[1px] h-3 w-3 text-amber-500" />,
};

const stageDetail = (stage: FinalizeProgressStage): string | null => {
  if (stage.total !== null && stage.total > 0 && stage.status !== 'skipped') {
    return `${stage.processed ?? 0}/${stage.total}`;
  }

  return null;
};

/**
 * Body of the finalize toast: one line per background process in the finalize
 * pipeline plus the overall bar. The bar is only shown as a real percentage
 * when the backend can actually measure it; otherwise it animates as
 * indeterminate rather than implying precision it does not have.
 */
export const FinalizeProgressToastContent: React.FC<FinalizeProgressToastContentProps> = ({
  progress,
  fallbackMessage = 'Running background processes…',
}) => {
  const percentage = progress ? Math.max(0, Math.min(100, progress.percentage)) : 0;
  const isIndeterminate = !progress || (progress.indeterminate && percentage === 0);
  const headline = progress?.message || fallbackMessage;

  return (
    <div className="mt-1 w-full min-w-[240px] space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate">{headline}</span>
        {!isIndeterminate && (
          <span className="shrink-0 font-medium tabular-nums">{percentage}%</span>
        )}
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted/70"
        role="progressbar"
        aria-label="Finalize progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isIndeterminate ? undefined : percentage}
      >
        <div
          className={cn(
            'h-full rounded-full bg-blue-500 transition-all duration-500',
            isIndeterminate && 'w-1/3 animate-pulse',
          )}
          style={isIndeterminate ? undefined : { width: `${percentage}%` }}
        />
      </div>

      {progress && (
        <ul className="space-y-1">
          {progress.stages.map((stage) => {
            const detail = stageDetail(stage);

            return (
              <li key={stage.key} className="flex items-start gap-2 text-[11px] leading-tight">
                <span className="flex h-3 w-3 shrink-0 items-center justify-center">
                  {stageIcons[stage.status] ?? stageIcons.pending}
                </span>
                <span
                  className={cn(
                    'flex-1',
                    stage.status === 'pending' && 'text-muted-foreground/70',
                    stage.status === 'skipped' && 'text-muted-foreground/70 line-through',
                  )}
                >
                  {stage.label}
                  {detail && <span className="ml-1 tabular-nums opacity-80">{detail}</span>}
                  {stage.status === 'failed' && stage.message && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">— {stage.message}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
