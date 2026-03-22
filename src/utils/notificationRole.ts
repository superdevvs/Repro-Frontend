const SALES_ROLE_ALIASES = new Set([
  'salesrep',
  'sales_rep',
  'sales-rep',
  'rep',
  'representative',
]);

export const normalizeNotificationRole = (role?: string | null): string => {
  const normalized = String(role ?? '').trim().toLowerCase();

  if (!normalized) return '';
  if (SALES_ROLE_ALIASES.has(normalized)) return 'salesrep';

  return normalized;
};

export const isAdminNotificationRole = (role?: string | null): boolean => {
  const normalized = normalizeNotificationRole(role);

  return (
    normalized === 'admin' ||
    normalized === 'superadmin' ||
    normalized === 'editing_manager' ||
    normalized === 'salesrep'
  );
};

export const canAccessNotificationSms = (role?: string | null): boolean =>
  isAdminNotificationRole(role);

export const canReceiveEmailInboxNotifications = (role?: string | null): boolean =>
  isAdminNotificationRole(role);

export const canReceivePersonalEmailNotifications = (role?: string | null): boolean => {
  const normalized = normalizeNotificationRole(role);

  return normalized === 'photographer' || normalized === 'editor';
};

export const getNotificationChannelForRole = (
  role?: string | null,
  userId?: string | number | null,
): string | null => {
  const normalized = normalizeNotificationRole(role);

  if (!normalized) return null;

  if (isAdminNotificationRole(normalized)) {
    return 'admin.notifications';
  }

  if (!userId) return null;

  switch (normalized) {
    case 'client':
      return `client.${userId}.notifications`;
    case 'photographer':
      return `photographer.${userId}.notifications`;
    case 'editor':
      return `editor.${userId}.notifications`;
    default:
      return null;
  }
};
