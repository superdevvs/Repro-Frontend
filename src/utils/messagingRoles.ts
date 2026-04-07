import type { UserRole } from '@/types/auth';

const normalizeMessagingRole = (role?: string | null) =>
  (role ?? '')
    .toLowerCase()
    .replace(/[_-\s]/g, '');

export const canSendExternalEmail = (role?: string | null): boolean =>
  ['superadmin', 'admin'].includes(normalizeMessagingRole(role));

export const isInternalMessagingRole = (role?: string | null): boolean =>
  ['client', 'photographer', 'editor'].includes(normalizeMessagingRole(role));

export const outboundEmailRoles: UserRole[] = ['superadmin', 'admin'];
