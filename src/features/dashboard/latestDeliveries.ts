import type { DashboardShootSummary } from '@/types/dashboard';

const deliveryTime = (shoot: DashboardShootSummary): number => {
  for (const value of [shoot.completedAt, shoot.deliveryDeadline, shoot.startTime]) {
    if (!value) continue;
    const time = Date.parse(value);
    if (Number.isFinite(time)) return time;
  }
  return -Infinity;
};

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
    .sort((a, b) => (deliveryTime(b) - deliveryTime(a)) || b.id - a.id)
    .slice(0, limit);
};
