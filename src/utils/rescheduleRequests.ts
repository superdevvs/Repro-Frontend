import type { ShootData } from '@/types/shoots';
import { isSalesRepRole } from './shootManagementAccess';

export interface RescheduleViewer {
  role?: string | null;
  secondary_roles?: string[] | null;
}

export interface ReschedulePermissions {
  canManageRequests: boolean;
  canEditAppointments: boolean;
  isLoading: boolean;
  hasError?: boolean;
}

const hasBookingStaffRole = (viewer?: RescheduleViewer | null): boolean =>
  [viewer?.role, ...(viewer?.secondary_roles ?? [])].some(role =>
    ['admin', 'superadmin', 'editingmanager'].includes(String(role ?? '').trim().toLowerCase().replace(/[_\s-]/g, ''))
      || isSalesRepRole(role));

export type RescheduleRequestStatus = 'pending' | 'approved' | 'rejected';

export interface RescheduleRequestRecord {
  id: number | string;
  status: RescheduleRequestStatus | string;
  original_date?: string | null;
  original_time?: string | null;
  requested_date?: string | null;
  requested_time?: string | null;
  reason?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  applied_at?: string | null;
  requester?: { id?: number | string; name?: string } | null;
  approver?: { id?: number | string; name?: string } | null;
  created_at?: string | null;
}

/** Review rights come from effective permissions, including individual denials. */
export const canReviewRescheduleRequests = (
  viewer: RescheduleViewer | null | undefined,
  permissions: ReschedulePermissions,
): boolean => !permissions.isLoading && !permissions.hasError
  && hasBookingStaffRole(viewer) && permissions.canManageRequests;

/** A reviewer may reject a request without being allowed to move its appointment. */
export const getRescheduleAccess = (
  shoot: Pick<ShootData, 'canApproveReschedule' | 'canRequestReschedule'>,
  viewer: RescheduleViewer | null | undefined,
  permissions: ReschedulePermissions,
): 'checking' | 'unavailable' | 'apply' | 'request' | 'denied' => {
  if (permissions.isLoading) return 'checking';
  if (permissions.hasError) return 'unavailable';
  if (shoot.canApproveReschedule === true && permissions.canEditAppointments
    && canReviewRescheduleRequests(viewer, permissions)) return 'apply';
  // Denied staff never silently fall back to submitting a client request.
  if (shoot.canRequestReschedule === true && !hasBookingStaffRole(viewer)) return 'request';
  if (shoot.canApproveReschedule === undefined && shoot.canRequestReschedule === undefined) return 'unavailable';
  return 'denied';
};

export const normalizeRescheduleStatus = (
  status?: string | null,
): RescheduleRequestStatus => {
  const normalized = String(status ?? '').trim().toLowerCase();

  if (normalized === 'approved' || normalized === 'rejected') {
    return normalized;
  }

  return 'pending';
};

/**
 * Colour and wording per state. Pending is amber because it is waiting on
 * someone, approved green, rejected red — so the three are distinguishable at a
 * glance and not only by their label.
 */
export const RESCHEDULE_STATUS_PRESENTATION: Record<
  RescheduleRequestStatus,
  { label: string; className: string; description: string }
> = {
  pending: {
    label: 'Pending review',
    className: 'bg-amber-500 text-white border-transparent hover:bg-amber-500',
    description: 'Submitted. The shoot keeps its current date until this is approved.',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-600 text-white border-transparent hover:bg-emerald-600',
    description: 'Approved and applied to the shoot.',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-600 text-white border-transparent hover:bg-red-600',
    description: 'Declined. The shoot was left on its original date.',
  },
};

export const describeRescheduleStatus = (status?: string | null) =>
  RESCHEDULE_STATUS_PRESENTATION[normalizeRescheduleStatus(status)];
