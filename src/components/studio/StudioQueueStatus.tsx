import { motion } from 'framer-motion';
import { AlertCircle, ImageIcon, Loader2, Video } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudioActiveQueue } from '@/hooks/useStudioMetrics';
import type { StudioActiveJob } from '@/services/studioMetricsService';
import { cn } from '@/lib/utils';

/**
 * StudioQueueStatus — Queue_Status_Section of the Studio Landing.
 *
 * Lists the AI jobs currently active (queued/processing) from
 * `useStudioActiveQueue`, showing each job's type, its related shoot, and its
 * current status (Req 6.3). The hook polls while jobs are present and stops
 * when the queue is empty (Req 6.4, 6.5), so this panel reflects live progress
 * without any extra wiring here.
 *
 * The panel owns its own query, so its loading, empty (Req 6.6), and error
 * (Req 6.7) states stay isolated to this section and never block the rest of
 * the landing from rendering.
 */
export interface StudioQueueStatusProps {
  className?: string;
}

const SKELETON_ROWS = 3;

/** Map a job status into a Badge variant for at-a-glance scanning. */
function statusVariant(status: string): BadgeProps['variant'] {
  const normalized = status.toLowerCase();
  if (normalized === 'failed') return 'destructive';
  if (normalized === 'cancelled') return 'outline';
  return 'secondary';
}

/** Human-readable label for a job's type. */
function jobTypeLabel(jobType: StudioActiveJob['job_type']): string {
  return jobType === 'video' ? 'Video' : 'Photo';
}

/** Shoot display label, falling back to the shoot id when no address is set. */
function shootLabel(job: StudioActiveJob): string {
  return job.shoot_address?.trim() ? job.shoot_address : `Shoot #${job.shoot_id}`;
}

export function StudioQueueStatus({ className }: StudioQueueStatusProps) {
  const { data, isLoading, isError } = useStudioActiveQueue();

  return (
    <section className={cn('space-y-4', className)}>
      <h2 className="text-lg font-semibold tracking-tight">AI Queue Status</h2>
      <Card className="divide-y divide-border">
        {isLoading ? (
          <div className="space-y-3 p-4" role="status" aria-label="Loading active jobs">
            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 p-6 text-sm text-destructive" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Couldn’t load the AI queue. Please try again later.</span>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6" aria-hidden="true" />
            <span>No jobs are currently running.</span>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((job, index) => {
              const JobIcon = job.job_type === 'video' ? Video : ImageIcon;
              return (
                <motion.li
                  key={`${job.job_type}-${job.id}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <JobIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{shootLabel(job)}</p>
                      <p className="text-xs text-muted-foreground">{jobTypeLabel(job.job_type)} job</p>
                    </div>
                  </div>
                  <Badge variant={statusVariant(job.status)} className="shrink-0 capitalize">
                    {job.status}
                  </Badge>
                </motion.li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}

export default StudioQueueStatus;
