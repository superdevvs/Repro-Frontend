import { useEffect, useMemo, useState } from 'react';
import type { DashboardShootSummary } from '@/types/dashboard';
import { normalizeDashboardRole } from '@/utils/dashboardFilterPermissions';
import { classifyDashboardBookedDay, getDashboardBookedYmd } from '@/utils/dashboardShootSchedule';

const STAFF_ROLES = new Set(['admin', 'superadmin', 'editing_manager', 'salesrep', 'photographer', 'editor']);
const DELIVERED_STATUSES = new Set(['delivered', 'delivered_to_client', 'ready_for_client', 'admin_verified', 'client_delivered', 'workflow_completed', 'finalized']);
const CLOSED_STATUSES = new Set([...DELIVERED_STATUSES, 'cancelled', 'canceled', 'declined', 'archived']);
const UNBOOKED_STATUSES = new Set(['requested', 'draft', 'pending', 'new']);

export const isStaffShootStackRole = (role?: string): boolean => STAFF_ROLES.has(normalizeDashboardRole(role));

/** The booked day and workflow determine visibility; legacy completedAt can mean editing finished. */
export const isEarlierUnfinishedShoot = (
  shoot: DashboardShootSummary,
  role?: string,
  now = new Date(),
): boolean => {
  if (!isStaffShootStackRole(role) || !classifyDashboardBookedDay(shoot, now).isPast) return false;
  const status = (shoot.workflowStatus || shoot.status || '').trim().toLowerCase();
  if (UNBOOKED_STATUSES.has(status)) return false;
  if (!CLOSED_STATUSES.has(status)) return true;
  // Photos may already be delivered while this editor still owes assigned video.
  return DELIVERED_STATUSES.has(status) && normalizeDashboardRole(role) === 'editor' && shoot.hasPendingEditorWork === true;
};

export const partitionEarlierShoots = (shoots: DashboardShootSummary[], role?: string, now = new Date()) => {
  const earlier: DashboardShootSummary[] = [];
  const remaining: DashboardShootSummary[] = [];
  shoots.forEach(shoot => (isEarlierUnfinishedShoot(shoot, role, now) ? earlier : remaining).push(shoot));
  earlier.sort((a, b) => (getDashboardBookedYmd(b) || '').localeCompare(getDashboardBookedYmd(a) || '') || a.id - b.id);
  return { earlier, remaining };
};

/** Reclassify at market midnight even when a long-lived dashboard has no data changes. */
export function useEarlierShoots(shoots: DashboardShootSummary[], role?: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isStaffShootStackRole(role)) return;
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [role]);
  return useMemo(() => partitionEarlierShoots(shoots, role, now), [shoots, role, now]);
}
