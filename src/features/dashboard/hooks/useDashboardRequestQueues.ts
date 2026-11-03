import { canViewAryeoRequests, useAryeoRequests } from './useAryeoRequests';
import { useHoldRequests } from './useHoldRequests';
import { canViewOverdueClients, useOverdueClients } from './useOverdueClients';
import { useRescheduleRequests } from './useRescheduleRequests';
import { useRescheduleAccess } from '@/hooks/useRescheduleAccess';

/** Keep each queue scoped to the current Dashboard viewer, including View As. */
export function useDashboardRequestQueues(role: string, userId: string | number | undefined, canViewDashboard: boolean) {
  const scope = `${role}:${userId ?? 'guest'}`;
  const holdRequests = useHoldRequests(['admin', 'superadmin', 'editing_manager', 'salesRep'].includes(role), scope);
  const showAryeoRequests = canViewDashboard && canViewAryeoRequests(role);
  const aryeoRequests = useAryeoRequests(showAryeoRequests, scope);
  const { canReview: canReviewReschedules, viewerScope: rescheduleViewerScope } = useRescheduleAccess();
  const rescheduleRequests = useRescheduleRequests(canReviewReschedules, rescheduleViewerScope);
  const showOverdueClients = canViewOverdueClients(role);
  const overdueClients = useOverdueClients(showOverdueClients, scope);
  return {
    holdRequests, aryeoRequests, rescheduleRequests, overdueClients,
    aryeoRequestsForUi: showAryeoRequests ? aryeoRequests : undefined,
    rescheduleRequestsForUi: canReviewReschedules ? rescheduleRequests : undefined,
    overdueClientsForUi: showOverdueClients ? overdueClients : undefined,
  };
}
