import type { DashboardShootSummary } from '@/types/dashboard';
import { sortByDeliveryDesc } from '@/utils/dashboardDerivedUtils';

export const selectLatestDeliveries = (
  shoots: DashboardShootSummary[],
  limit = 6,
): DashboardShootSummary[] => {
  const unique = new Map<number, DashboardShootSummary>();
  for (const shoot of shoots) {
    if ((shoot.status || shoot.workflowStatus || '').toLowerCase() !== 'delivered') continue;
    if (!unique.has(shoot.id)) unique.set(shoot.id, shoot);
  }
  return [...unique.values()]
    .sort((a, b) => sortByDeliveryDesc(a, b) || b.id - a.id)
    .slice(0, limit);
};
