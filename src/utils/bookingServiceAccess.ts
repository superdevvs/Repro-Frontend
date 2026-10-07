/** Client service groups constrain self-service; these staff roles can book the full catalog. */
export const canBookOutsideClientServiceGroups = (role?: string | null): boolean =>
  ['admin', 'superadmin', 'salesrep', 'rep', 'representative'].includes(String(role ?? '').toLowerCase().replace(/[_\s-]/g, ''));
