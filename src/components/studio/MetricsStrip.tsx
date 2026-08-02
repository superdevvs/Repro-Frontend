import { CheckCircle2, Files, FolderCheck, Gauge } from 'lucide-react';

import { useStudioMetricsSummary } from '@/hooks/useStudio';
import { cn } from '@/lib/utils';

import { SectionError, SectionSkeleton } from './feedback/StudioFeedback';

export function MetricsStrip({ className }: { className?: string }) {
  const query = useStudioMetricsSummary();
  const metrics = query.data
    ? [
        {
          label: 'Projects processed',
          value: query.data.projectsProcessed.toLocaleString(),
          icon: FolderCheck,
        },
        {
          label: 'AI jobs completed',
          value: query.data.aiJobsCompleted.toLocaleString(),
          icon: CheckCircle2,
        },
        {
          label: 'Success rate',
          value: `${query.data.successRate}%`,
          icon: Gauge,
        },
        {
          label: 'Media outputs',
          value: query.data.mediaOutputs.toLocaleString(),
          icon: Files,
        },
      ]
    : [];

  return (
    <section className={cn('space-y-4', className)} aria-labelledby="studio-metrics-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="studio-metrics-heading" className="text-base font-semibold">
            Studio activity
          </h2>
          <p className="text-sm text-muted-foreground">Last 30 days</p>
        </div>
      </div>
      {query.isLoading ? (
        <SectionSkeleton label="Loading Studio metrics" rows={1} />
      ) : query.isError || !query.data ? (
        <SectionError
          title="Metrics are unavailable"
          message="No sample values have been substituted."
          onRetry={() => query.refetch()}
        />
      ) : (
        <dl className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-4 lg:divide-y-0">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label} className="min-w-0 p-4 sm:p-5">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export default MetricsStrip;

