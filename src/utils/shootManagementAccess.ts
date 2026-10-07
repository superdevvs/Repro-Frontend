export const isSalesRepRole = (role?: unknown): boolean =>
  ['salesrep', 'rep', 'representative'].includes(String(role ?? '').trim().toLowerCase().replace(/[_\s-]/g, ''));

export const hasSalesRepRole = (user?: { role?: string; secondary_roles?: string[] } | null): boolean =>
  isSalesRepRole(user?.role) || Boolean(user?.secondary_roles?.some(isSalesRepRole));
