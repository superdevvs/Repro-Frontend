import { normalizeDashboardRole } from '@/utils/dashboardFilterPermissions';

/**
 * Same gate as Shoot History `canShowShootPaymentStatus`:
 * superadmin | admin | client | sales_rep.
 * Does not include editing_manager / finance / photographer / editor.
 */
export const canShowShootPaymentStatusForRole = (role?: string | null): boolean => {
  const normalized = normalizeDashboardRole(role);
  return (
    normalized === 'superadmin' ||
    normalized === 'admin' ||
    normalized === 'client' ||
    normalized === 'salesrep'
  );
};
