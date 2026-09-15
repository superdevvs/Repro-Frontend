export const OLD_DASHBOARD_URL = 'https://reprophotos.viewshoot.com';

export const canViewOldDashboard = (role: string) =>
  ['client', 'salesRep', 'admin', 'superadmin', 'editing_manager'].includes(role);
