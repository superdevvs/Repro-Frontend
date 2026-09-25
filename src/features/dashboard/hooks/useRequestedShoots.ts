import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api';
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms';
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils';
import { registerDashboardOverviewRefresh } from '@/realtime/realtimeRefreshBus';

export async function fetchRequestedShoots(signal?: AbortSignal) {
  const shoots = new Map<string, ReturnType<typeof shootDataToSummary>>();
  let page = 1;
  let lastPage = 1;
  do {
    const response = await apiClient.get('/shoots', {
      signal,
      params: { tab: 'scheduled', scheduled_status: 'requested', page, per_page: 50, no_cache: 'true' },
    });
    const payload = response.data;
    for (const item of Array.isArray(payload?.data) ? payload.data : []) {
      const summary = shootDataToSummary(mapShootApiToShootData(item));
      shoots.set(String(summary.id), summary);
    }
    lastPage = Number(payload?.meta?.last_page) || 1;
    page += 1;
  } while (page <= lastPage);
  return [...shoots.values()];
}

export function useRequestedShoots(enabled: boolean, viewerScope: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['requestedShoots', viewerScope],
    enabled,
    queryFn: ({ signal }) => fetchRequestedShoots(signal),
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (!enabled) return;
    return registerDashboardOverviewRefresh(() => {
      void queryClient.invalidateQueries({ queryKey: ['requestedShoots', viewerScope] });
    });
  }, [enabled, queryClient, viewerScope]);
  return query;
}
