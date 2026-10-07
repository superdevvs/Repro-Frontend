export const isSalesRepRole = (role?: unknown): boolean =>
  ['salesrep', 'rep', 'representative'].includes(String(role ?? '').trim().toLowerCase().replace(/[_\s-]/g, ''));

type ShootManagementUser = { role?: string; secondary_roles?: string[] } | null;
export const hasSalesRepRole = (user?: ShootManagementUser): boolean =>
  isSalesRepRole(user?.role) || Boolean(user?.secondary_roles?.some(isSalesRepRole));

export const hasRestrictedSalesRepRole = (user?: ShootManagementUser): boolean => {
  const primary = String(user?.role ?? '').trim().toLowerCase().replace(/[_\s-]/g, '');
  // Retain privileged staff behavior when sales rep is only an additional role.
  return !['admin', 'superadmin', 'editingmanager'].includes(primary) &&
    hasSalesRepRole(user);
};
