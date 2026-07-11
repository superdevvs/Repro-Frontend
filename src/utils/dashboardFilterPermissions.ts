const ASSIGNMENT_FILTER_ROLES = new Set([
  'admin',
  'superadmin',
  'salesrep',
  'editing_manager',
]);

export const normalizeDashboardRole = (role?: string): string => {
  const normalized = (role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['sales_rep', 'rep', 'representative'].includes(normalized)) return 'salesrep';
  if (['editingmanager', 'editing_mgr'].includes(normalized)) return 'editing_manager';
  if (normalized === 'super_admin') return 'superadmin';
  return normalized;
};

export const canFilterByPhotographer = (role?: string): boolean =>
  ASSIGNMENT_FILTER_ROLES.has(normalizeDashboardRole(role));
