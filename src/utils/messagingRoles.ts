import type { UserRole } from '@/types/auth';

const normalizeMessagingRole = (role?: string | null) =>
  (role ?? '')
    .toLowerCase()
    .replace(/[_-\s]/g, '');

/** Primary role only; a secondary role or custom email grant does not open the staff workspace. */
export const canUseEmailWorkspace = (role?: string | null): boolean =>
  ['superadmin', 'admin', 'editingmanager'].includes(normalizeMessagingRole(role));

export const canSendExternalEmail = (role?: string | null): boolean =>
  canUseEmailWorkspace(role);

export const isInternalMessagingRole = (role?: string | null): boolean =>
  ['client', 'photographer', 'editor'].includes(normalizeMessagingRole(role));

export const outboundEmailRoles: UserRole[] = ['superadmin', 'admin', 'editing_manager'];
