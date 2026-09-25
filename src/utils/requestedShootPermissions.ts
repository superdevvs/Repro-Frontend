export const canManageRequestedShoots = (role?: string | null): boolean =>
  ['admin', 'superadmin', 'super_admin', 'editing_manager', 'salesrep', 'sales_rep', 'rep', 'representative']
    .includes(String(role ?? '').trim().toLowerCase());
