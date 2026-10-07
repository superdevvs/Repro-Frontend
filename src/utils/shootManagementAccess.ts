export const isSalesRepRole = (role?: unknown): boolean =>
  ['salesrep', 'rep', 'representative'].includes(String(role ?? '').trim().toLowerCase().replace(/[_\s-]/g, ''));

export const hasSalesRepRole = (user?: { role?: string; secondary_roles?: string[] } | null): boolean => {
  const primary = String(user?.role ?? '').trim().toLowerCase().replace(/[_\s-]/g, '');
  // Retain privileged staff behavior when sales rep is only an additional role.
  return !['admin', 'superadmin', 'editingmanager'].includes(primary) &&
    (isSalesRepRole(user?.role) || Boolean(user?.secondary_roles?.some(isSalesRepRole)));
};
