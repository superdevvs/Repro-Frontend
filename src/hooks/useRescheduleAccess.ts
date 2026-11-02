import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/context/PermissionsContext';
import { canReviewRescheduleRequests, getRescheduleAccess } from '@/utils/rescheduleRequests';
import type { ShootData } from '@/types/shoots';

/** Shared server-backed access for the dialog, dashboard queue, and review controls. */
export function useRescheduleAccess(shoot?: Pick<ShootData, 'canApproveReschedule' | 'canRequestReschedule'>) {
  const { user, role, isLoading: authLoading } = useAuth();
  const { can, isLoading, hasError } = usePermissions();
  const viewer = { role, secondary_roles: user?.secondary_roles };
  const permissions = {
    canManageRequests: can('shoots', 'manage'),
    canEditAppointments: can('shoots', 'update'),
    isLoading: Boolean(authLoading || isLoading),
    hasError,
  };
  return {
    viewerScope: `${role}:${user?.id ?? 'guest'}:${(user?.secondary_roles ?? []).join(',')}`,
    canReview: canReviewRescheduleRequests(viewer, permissions),
    canApprove: permissions.canEditAppointments && canReviewRescheduleRequests(viewer, permissions),
    access: shoot ? getRescheduleAccess(shoot, viewer, permissions) : undefined,
  };
}
