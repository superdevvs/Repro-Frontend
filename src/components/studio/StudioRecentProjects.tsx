import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { AlertCircle, Clock, ImageIcon, Inbox, Video } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudioRecentProjects } from '@/hooks/useStudioMetrics';
import type { StudioRecentProject } from '@/services/studioMetricsService';
import { cn } from '@/lib/utils';

import type { RouteTarget, RouteToCapability } from './types';

/**
 * StudioRecentProjects — Recent_Projects_Section of the Studio Landing.
 *
 * Lists the most recently active projects from `useStudioRecentProjects`,
 * showing each project's shoot address, its most recent activity time, and its
 * most recent job status (Req 5.3). The panel owns its own query so its
 * loading (Req 5.5), empty (Req 5.6), and error (Req 5.7) states stay isolated
 * to this section and never block the rest of the landing from rendering.
 *
 * Selecting a project deep-links into the Subtab matching the project's
 * `latest_job_type` with the shoot preselected (Req 5.4): photo jobs route to
 * the Photo Subtab, video jobs to the Video Subtab. The routing decision is
 * factored into the pure `recentProjectRouteTarget` helper so it can be
 * exercised directly in tests (Property 8, task 6.9).
 */
export interface StudioRecentProjectsProps {
  routeToCapability: RouteToCapability;
  className?: string;
}

/**
 * Pure mapping from a Recent_Project to its deep-link {@link RouteTarget}.
 *
 * Routes by `latest_job_type` — `video` → Video Subtab, anything else
 * (`photo`) → Photo Subtab — with the project's shoot preselected (Req 5.4).
 */
export function recentProjectRouteTarget(project: StudioRecentProject): RouteTarget {
  const shoot = { id: project.shoot_id, address: project.address };
  return project.latest_job_type === 'video'
    ? { subtab: 'video', shoot }
    : { subtab: 'photo', shoot };
}

const SKELETON_ROWS = 4;

/** Map a job status into a Badge variant for at-a-glance scanning. */
function statusVariant(status: string): BadgeProps['variant'] {
  const normalized = status.toLowerCase();
  if (normalized === 'completed') return 'default';
  if (normalized === 'failed') return 'destructive';
  if (normalized === 'cancelled') return 'outline';
  return 'secondary';
}

/** Format an ISO timestamp into a relative "x ago" string, guarding bad input. */
function formatActivity(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function StudioRecentProjects({ routeToCapability, className }: StudioRecentProjectsProps) {
  const { data, isLoading, isError } = useStudioRecentProjects();

  return (
    <section className={cn('space-y-4', className)}>
      <h2 className="text-lg font-semibold tracking-tight">Recent Projects</h2>
      <Card className="divide-y divide-border">
        {isLoading ? (
          <div className="space-y-3 p-4" role="status" aria-label="Loading recent projects">
            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 p-6 text-sm text-destructive" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Couldn’t load recent projects. Please try again later.</span>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Inbox className="h-6 w-6" aria-hidden="true" />
            <span>No recent projects yet. Start a capability to see it here.</span>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((project, index) => {
              const JobIcon = project.latest_job_type === 'video' ? Video : ImageIcon;
              return (
                <motion.li
                  key={`${project.latest_job_type}-${project.shoot_id}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                >
                  <button
                    type="button"
                    onClick={() => routeToCapability(recentProjectRouteTarget(project))}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Open ${project.address}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <JobIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{project.address}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatActivity(project.last_activity_at)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusVariant(project.latest_status)} className="shrink-0 capitalize">
                      {project.latest_status}
                    </Badge>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}

export default StudioRecentProjects;
