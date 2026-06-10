import { motion } from 'framer-motion';
import { FolderKanban, Sparkles, TrendingUp } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudioHeroStats } from '@/hooks/useStudioMetrics';
import type { StudioHeroStats } from '@/services/studioMetricsService';
import { cn } from '@/lib/utils';

/**
 * StudioHero — Hero_Section of the Studio Landing.
 *
 * Renders the studio title, an introductory description, and the three
 * Hero_Stats (Projects, AI Jobs Completed, Success Rate) sourced from
 * `useStudioHeroStats` (Req 3.1). While the request is in flight each metric
 * value is replaced by a loading indicator (Req 3.6); if the request fails the
 * values fall back to an em dash without preventing the rest of the landing
 * from rendering (Req 3.7) — the failure is contained to this section because
 * the query is owned here.
 */
export interface StudioHeroProps {
  className?: string;
}

const FALLBACK_VALUE = '—';

type StatSlot = {
  key: keyof StudioHeroStats;
  label: string;
  icon: typeof FolderKanban;
  format: (stats: StudioHeroStats) => string;
};

const STAT_SLOTS: StatSlot[] = [
  {
    key: 'projects_count',
    label: 'Projects',
    icon: FolderKanban,
    format: (stats) => formatCount(stats.projects_count),
  },
  {
    key: 'ai_jobs_completed',
    label: 'AI Jobs Completed',
    icon: Sparkles,
    format: (stats) => formatCount(stats.ai_jobs_completed),
  },
  {
    key: 'success_rate',
    label: 'Success Rate',
    icon: TrendingUp,
    format: (stats) => formatPercentage(stats.success_rate),
  },
];

function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return FALLBACK_VALUE;
  return value.toLocaleString();
}

function formatPercentage(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return FALLBACK_VALUE;
  // Drop a trailing `.0` so whole percentages read cleanly (e.g. "95%").
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
}

export function StudioHero({ className }: StudioHeroProps) {
  const { data, isLoading, isError } = useStudioHeroStats();

  return (
    <section className={cn('space-y-6', className)}>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          AI Real Estate Media Studio
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Enhance photos, replace skies, and build listing videos and reels — all powered by AI.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_SLOTS.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
            >
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="mt-2">
                  {isLoading ? (
                    <Skeleton
                      className="h-8 w-20"
                      role="status"
                      aria-label={`Loading ${stat.label}`}
                    />
                  ) : (
                    <p className="text-2xl font-semibold">
                      {isError || !data ? FALLBACK_VALUE : stat.format(data)}
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

export default StudioHero;
