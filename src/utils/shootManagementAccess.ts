export const isSalesRepRole = (role?: unknown): boolean =>
  ['salesrep', 'rep', 'representative'].includes(String(role ?? '').trim().toLowerCase().replace(/[_\s-]/g, ''));

type ShootManagementUser = { role?: string; secondary_roles?: string[] } | null;
export const hasSalesRepRole = (user?: ShootManagementUser): boolean =>
  isSalesRepRole(user?.role) || Boolean(user?.secondary_roles?.some(isSalesRepRole));

export const hasRestrictedSalesRepRole = (user?: ShootManagementUser): boolean => {
  const hasOfficeRole = [user?.role, ...(user?.secondary_roles ?? [])].some(role =>
    ['admin', 'superadmin', 'editingmanager'].includes(String(role ?? '').trim().toLowerCase().replace(/[_\s-]/g, '')));
  // Booking restrictions follow the complete role set, as they do on the server.
  return !hasOfficeRole &&
    hasSalesRepRole(user);
};

export const isDeliveredShootForManagement = (shoot: { status?: string | null; workflowStatus?: string | null }): boolean =>
  [shoot.status, shoot.workflowStatus].some(status =>
    ['delivered', 'delivered_to_client', 'ready_for_client', 'admin_verified'].includes(String(status ?? '').trim().toLowerCase()));
