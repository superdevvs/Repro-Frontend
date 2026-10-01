import { normalizeDashboardRole } from '@/utils/dashboardFilterPermissions';

/** AI provenance is an internal review detail, scoped to the active viewer. */
export function canViewAiEditStatus(role?: string): boolean {
  const normalizedRole = normalizeDashboardRole(role);
  return normalizedRole === 'superadmin' || normalizedRole === 'editing_manager';
}
