import type { UserData, UserRole } from '@/types/auth';

export function canImpersonateAccount(
  role: UserRole,
  target: Pick<UserData, 'role' | 'can_impersonate'>,
): boolean {
  return role === 'admin' || role === 'superadmin'
    || (role === 'salesRep' && target.role === 'client' && target.can_impersonate === true);
}
