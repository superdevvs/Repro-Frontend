import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
  resolveStatusPresentation,
  STATUS_TONE_CLASSES,
  type StatusTone,
} from './statusPresentation';

export interface StatusBadgeProps {
  status: string | null | undefined;
  label?: string;
  tone?: StatusTone;
  className?: string;
}

/** Status is always encoded with text, an icon, and colour—not colour alone. */
export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const presentation = resolveStatusPresentation(status, { label, tone });
  const Icon = presentation.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        STATUS_TONE_CLASSES[presentation.tone],
        className,
      )}
      data-status={presentation.status}
    >
      <Icon
        className={cn('h-3.5 w-3.5', presentation.isBusy && 'motion-safe:animate-spin')}
        aria-label={presentation.accessibleLabel}
      />
      <span>{presentation.label}</span>
    </span>
  );
}

export function SectionSkeleton({
  label = 'Loading section',
  rows = 3,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border/60 p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function SectionError({
  title = 'This section could not be loaded',
  message,
  requestId,
  onRetry,
  className,
}: {
  title?: string;
  message?: string | null;
  requestId?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{title}</p>
          {message ? <p className="mt-1 text-muted-foreground">{message}</p> : null}
          {requestId ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">Request {requestId}</p>
          ) : null}
        </div>
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function MutationSuccess({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-100',
        className,
      )}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

