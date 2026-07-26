import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  RotateCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EditingJob } from '@/services/autoenhanceService';

type JobStatus = EditingJob['status'];

interface AiEditingJobCardProps {
  job: EditingJob;
  editingTypeLabels: Record<string, string>;
  resolveImageUrl: (value?: string | null) => string;
  onCompare: (job: EditingJob) => void;
  onCancel?: (job: EditingJob) => void;
  onRetry?: (job: EditingJob) => void;
  onOpenSource?: (job: EditingJob) => void;
  isMutating?: boolean;
}

const STATUS_CONFIG: Record<JobStatus, { label: string; chip: string; icon: React.ElementType; ring: string }> = {
  pending: {
    label: 'Pending',
    chip: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
    icon: Clock,
    ring: 'ring-amber-300/40',
  },
  processing: {
    label: 'Processing',
    chip: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900',
    icon: Loader2,
    ring: 'ring-blue-400/40',
  },
  completed: {
    label: 'Completed',
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
    icon: CheckCircle2,
    ring: 'ring-emerald-400/40',
  },
  failed: {
    label: 'Failed',
    chip: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900',
    icon: XCircle,
    ring: 'ring-red-400/40',
  },
  cancelled: {
    label: 'Cancelled',
    chip: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
    icon: XCircle,
    ring: 'ring-slate-400/30',
  },
};

// fal.ai does not report a real completion percentage, so we derive a smooth
// estimate from elapsed processing time. It eases towards — but never reaches —
// 99% so the bar keeps moving while we wait for the provider to finish.
const ESTIMATED_JOB_SECONDS = 75;

const estimateProgress = (startedAt?: string | null): number => {
  if (!startedAt) return 5;
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return 5;
  const elapsedSeconds = Math.max(0, (Date.now() - started) / 1000);
  const eased = 1 - Math.exp(-elapsedSeconds / ESTIMATED_JOB_SECONDS);

  return Math.min(99, Math.max(5, Math.round(eased * 100)));
};

const Thumb: React.FC<{ url?: string | null; alt: string; placeholder?: React.ReactNode; className?: string }> = ({
  url,
  alt,
  placeholder,
  className,
}) =>
  url ? (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={cn('h-full w-full object-cover', className)}
      onError={(event) => {
        (event.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
      {placeholder || <ImageIcon className="h-6 w-6" />}
    </div>
  );

export const AiEditingJobCard: React.FC<AiEditingJobCardProps> = ({
  job,
  editingTypeLabels,
  resolveImageUrl,
  onCompare,
  onCancel,
  onRetry,
  onOpenSource,
  isMutating,
}) => {
  const statusInfo = STATUS_CONFIG[job.status];
  const StatusIcon = statusInfo.icon;

  const sourceThumb = job.source_file?.thumb_url
    ? resolveImageUrl(job.source_file.thumb_url)
    : resolveImageUrl(job.original_image_url);
  const enhancedPreview = job.output_file?.thumb_url
    ? resolveImageUrl(job.output_file.thumb_url)
    : job.output_file?.url
    ? resolveImageUrl(job.output_file.url)
    : job.edited_image_url
    ? resolveImageUrl(job.edited_image_url)
    : '';
  const enhancedResultUrl = job.output_file?.url
    ? resolveImageUrl(job.output_file.url)
    : job.edited_image_url
    ? resolveImageUrl(job.edited_image_url)
    : enhancedPreview;

  const filename = job.source_file?.filename || (job.shoot_file_id ? `File #${job.shoot_file_id}` : null);
  // Title fallback for ad-hoc / quick-edit jobs that aren't tied to a shoot.
  const isDirectUpload = !job.shoot_id;
  const address = job.shoot?.address
    || (isDirectUpload ? (filename ? 'Direct upload' : 'Direct upload') : `Shoot #${job.shoot_id}`);
  const editingType = editingTypeLabels[job.editing_type] || job.editing_type;
  const referenceTime = job.completed_at || job.started_at || job.created_at;
  const relativeTime = referenceTime ? formatDistanceToNow(new Date(referenceTime), { addSuffix: true }) : null;
  const isProcessing = job.status === 'processing';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelable = ['pending', 'processing'].includes(job.status);
  const isAiResult = Boolean(enhancedPreview) || isCompleted;

  const [progress, setProgress] = useState(() => estimateProgress(job.started_at || job.created_at));

  useEffect(() => {
    if (!isProcessing) return;

    const tick = () => setProgress(estimateProgress(job.started_at || job.created_at));
    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [isProcessing, job.started_at, job.created_at]);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card text-card-foreground transition-all hover:shadow-md',
        statusInfo.ring,
        isCompleted && 'cursor-pointer',
      )}
      onClick={isCompleted ? () => onCompare(job) : undefined}
    >
      <div className="grid grid-cols-[88px,1fr] sm:grid-cols-[112px,1fr] gap-3 p-3 sm:p-4">
        <div className="relative h-22 w-22 sm:h-28 sm:w-28 overflow-hidden rounded-lg border bg-muted">
          {enhancedPreview ? (
            // Split view — only when we actually have an enhanced result to compare against.
            <div className="absolute inset-0 grid grid-cols-2">
              <div className="relative overflow-hidden">
                <Thumb url={sourceThumb} alt={filename || 'Source image'} />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                  Src
                </span>
              </div>
              <div className="relative overflow-hidden border-l border-background">
                <Thumb url={enhancedPreview} alt="Enhanced" />
                <span className="absolute bottom-1 right-1 rounded bg-emerald-500/90 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                  AI
                </span>
              </div>
            </div>
          ) : (
            // Single-pane source thumb — no empty placeholder pane, no SRC label
            <Thumb url={sourceThumb} alt={filename || 'Source image'} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-medium">{editingType}</Badge>
            {isAiResult && (
              <Badge
                variant="outline"
                className="gap-1 border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
              >
                <Sparkles className="h-3 w-3" />
                AI
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">Job #{job.id}</span>
            <Badge variant="outline" className={cn('ml-auto gap-1', statusInfo.chip)}>
              <StatusIcon className={cn('h-3 w-3', isProcessing && 'animate-spin')} />
              {statusInfo.label}
              {isProcessing && <span className="tabular-nums">{progress}%</span>}
            </Badge>
          </div>

          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-semibold leading-tight">{address}</p>
            <p className="truncate text-xs text-muted-foreground">
              {filename ? `${filename} · ` : ''}{relativeTime ? relativeTime : '—'}
            </p>
          </div>

          {isFailed && job.error_message && (
            <p className="line-clamp-2 text-xs text-red-600 dark:text-red-300">{job.error_message}</p>
          )}

          {isProcessing && (
            <div className="space-y-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                <span className="tabular-nums font-medium">{progress}%</span> · image 1 of 1
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-1" onClick={(event) => event.stopPropagation()}>
            {isCompleted && (
              <Button size="sm" variant="default" className="h-8" onClick={() => onCompare(job)}>
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                Compare
              </Button>
            )}
            {isCompleted && enhancedResultUrl && (
              <Button asChild size="sm" variant="outline" className="h-8">
                <a href={enhancedResultUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open result
                </a>
              </Button>
            )}
            {(isFailed || job.status === 'cancelled') && onRetry && (
              <Button size="sm" variant="outline" className="h-8" disabled={isMutating} onClick={() => onRetry(job)}>
                <RotateCw className={cn('mr-1.5 h-3.5 w-3.5', isMutating && 'animate-spin')} />
                Retry
              </Button>
            )}
            {isCancelable && onCancel && (
              <Button size="sm" variant="ghost" className="h-8" disabled={isMutating} onClick={() => onCancel(job)}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
            {onOpenSource && job.shoot_id && (
              <Button size="sm" variant="ghost" className="h-8" onClick={() => onOpenSource(job)}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                View shoot
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiEditingJobCard;
