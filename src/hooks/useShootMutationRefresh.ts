import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  triggerShootListRefresh,
  triggerShootDetailRefresh,
  triggerShootHistoryRefresh,
  triggerDashboardOverviewRefresh,
} from '@/realtime/realtimeRefreshBus';

/**
 * Canonical cache-refresh for any shoot mutation (reschedule, cancel, hold,
 * finalize, assign, payment, ...).
 *
 * A1 fixed the reschedule workflow but left every other mutation path to
 * refresh the cache ad-hoc — some invalidated `['shootFiles']`, some invalidated
 * a `['shoots']` key that no query is ever registered under, and none reliably
 * refreshed the `ShootsContext`-backed lists. That is why a mutated shoot could
 * still show its stale date in the list/history views after the change was saved
 * (issue B4). This hook gives every mutation one place to call.
 *
 * It:
 *  - invalidates the single-shoot (`['shoot', id]`) and file-list
 *    (`['shootFiles', id, ...]`) React Query caches. A predicate is used so the
 *    match holds whether the id was stored as a string or a number — the two
 *    forms are used interchangeably across the codebase.
 *  - triggers the realtime refresh bus for the shoot list (which `ShootsContext`
 *    subscribes to), the specific shoot detail view, the shoot history view, and
 *    the dashboard overview.
 */
export const useShootMutationRefresh = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (shootId: string | number | null | undefined) => {
      if (shootId == null || String(shootId) === '') {
        return;
      }

      const idStr = String(shootId);

      queryClient.invalidateQueries({
        predicate: (query) => {
          const [scope, keyId] = query.queryKey as [unknown, unknown];
          return (
            (scope === 'shoot' || scope === 'shootFiles') &&
            String(keyId) === idStr
          );
        },
      });

      triggerShootListRefresh();
      triggerShootDetailRefresh(shootId);
      triggerShootHistoryRefresh();
      triggerDashboardOverviewRefresh();
    },
    [queryClient],
  );
};

export default useShootMutationRefresh;
