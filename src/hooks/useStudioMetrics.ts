import { useQuery } from '@tanstack/react-query';
import {
  studioMetricsService,
  type StudioActiveJob,
  type StudioRecentProjectsParams,
} from '@/services/studioMetricsService';

/**
 * React Query hooks for the Studio Landing metrics.
 *
 * Mirrors `useListingVideo.ts` conventions: shared query-key map, plain
 * `useQuery` usage, and a result-driven `refetchInterval` for the polled
 * endpoint. Hero stats and recent projects are fetched once with no polling;
 * the active queue polls while jobs are present and stops when empty
 * (Req 6.4, 6.5).
 */
const KEYS = {
  heroStats: () => ['studio-hero-stats'] as const,
  recentProjects: (params?: StudioRecentProjectsParams) =>
    ['studio-recent-projects', params] as const,
  activeQueue: () => ['studio-active-queue'] as const,
};

export const ACTIVE_QUEUE_POLL_INTERVAL = 8000;

/**
 * Pure helper deciding the active-queue `refetchInterval`. Returns a positive
 * interval (enabling polling) iff the result contains at least one Active_Job,
 * and `false` (disabling polling) when the result is empty/absent (Req 6.4, 6.5).
 */
export function getActiveQueueRefetchInterval(
  data: StudioActiveJob[] | undefined,
): number | false {
  return data?.length ? ACTIVE_QUEUE_POLL_INTERVAL : false;
}

export function useStudioHeroStats() {
  return useQuery({
    queryKey: KEYS.heroStats(),
    queryFn: () => studioMetricsService.getHeroStats(),
  });
}

export function useStudioRecentProjects(params?: StudioRecentProjectsParams) {
  return useQuery({
    queryKey: KEYS.recentProjects(params),
    queryFn: () => studioMetricsService.getRecentProjects(params),
  });
}

export function useStudioActiveQueue() {
  return useQuery({
    queryKey: KEYS.activeQueue(),
    queryFn: () => studioMetricsService.getActiveQueue(),
    refetchInterval: (query) => {
      const data = query.state.data as StudioActiveJob[] | undefined;
      return getActiveQueueRefetchInterval(data);
    },
  });
}
