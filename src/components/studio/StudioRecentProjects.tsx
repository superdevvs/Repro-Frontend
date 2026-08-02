import { formatDistanceToNow } from 'date-fns';
import { Clock3, ImageIcon, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useStudioProjects } from '@/hooks/useStudio';
import { resolveGeneratedAsset, resolveStudioAssetPath } from '@/lib/studioAssets';
import { cn } from '@/lib/utils';
import type { StudioRecentProject } from '@/services/studioMetricsService';
import type { StudioProjectSummary } from '@/services/studioService';

import { SectionError, SectionSkeleton, StatusBadge } from './feedback/StudioFeedback';
import { useOptionalStudioShell } from './StudioShell';
import type { RouteTarget, RouteToCapability } from './types';

/** Kept for compatibility with the original landing tests and route contract. */
export function recentProjectRouteTarget(project: StudioRecentProject): RouteTarget {
  const shoot = { id: project.shoot_id, address: project.address };
  return project.latest_job_type === 'video'
    ? { subtab: 'video', shoot }
    : { subtab: 'photo', shoot };
}

export function projectRequiredFields(project: StudioProjectSummary) {
  return {
    thumbnail: project.thumbnailRef,
    workflow: project.latestWorkflow,
    status: project.latestStatus,
    activity: project.lastActivityAt,
    mediaCount: project.mediaCount,
  };
}

export interface StudioRecentProjectsProps {
  routeToCapability?: RouteToCapability;
  onNewProject?: () => void;
  limit?: number;
  cards?: boolean;
  className?: string;
}

export function StudioRecentProjects({
  onNewProject,
  limit = 5,
  cards = false,
  className,
}: StudioRecentProjectsProps) {
  const query = useStudioProjects();
  const shell = useOptionalStudioShell();
  const projects = (query.data ?? []).slice(0, limit);

  return (
    <section className={cn('space-y-4', className)} aria-labelledby="recent-projects-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="recent-projects-heading" className="text-base font-semibold">
            Recent projects
          </h2>
          <p className="text-sm text-muted-foreground">Ordered by server activity</p>
        </div>
        {query.data && query.data.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => shell?.setDestination('projects')}
          >
            View all projects
          </Button>
        ) : null}
      </div>

      {query.isLoading ? (
        <SectionSkeleton label="Loading recent projects" rows={3} />
      ) : query.isError ? (
        <SectionError
          title="Recent projects are unavailable"
          onRetry={() => query.refetch()}
        />
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">No Studio projects yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start an AI workflow to create the first one.
          </p>
          {onNewProject ? (
            <Button type="button" size="sm" className="mt-4" onClick={onNewProject}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New AI Project
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className={cn(
          cards
            ? 'grid gap-3 lg:grid-cols-3'
            : 'divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card',
        )}>
          {projects.map((project) => {
            const thumbnail =
              resolveStudioAssetPath(project.thumbnailRef) ??
              resolveGeneratedAsset('selected-shoot');
            const activity = new Date(project.lastActivityAt);
            const activityLabel = Number.isNaN(activity.getTime())
              ? 'Activity time unavailable'
              : formatDistanceToNow(activity, { addSuffix: true });
            return (
              <li key={project.id} className={cn(cards && 'min-w-0')}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50',
                    cards && 'h-full rounded-xl border border-border bg-card',
                  )}
                  aria-label={`Open ${project.name}`}
                  onClick={() => shell?.openDeepLink(project.deepLink)}
                >
                  <div className={cn('shrink-0 overflow-hidden rounded-lg bg-muted', cards ? 'h-20 w-28' : 'h-14 w-20')}>
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={`${project.name} property thumbnail`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{project.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {project.latestWorkflow}
                        </p>
                      </div>
                      <StatusBadge status={project.latestStatus} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {activityLabel}
                      </span>
                      <span>{project.mediaCount} media</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default StudioRecentProjects;
