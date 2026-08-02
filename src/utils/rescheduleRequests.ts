/**
 * Reschedule request vocabulary shared by the dialog and the review panel.
 *
 * A1.docx item 4: the client UI said "Request to reschedule" while the backend
 * applied the change on submission. Now submission and application are separate,
 * and the UI has to say which one it is doing — so the role test that decides
 * that lives here rather than being re-derived in each component.
 *
 * Mirrors `ShootRescheduleRequestController::STAFF_ROLES`.
 */
export const RESCHEDULE_REVIEWER_ROLES = [
  'admin',
  'superadmin',
  'super_admin',
  'editing_manager',
] as const;

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

/**
 * Whether this role may reschedule outright and review others' requests.
 *
 * Anyone else submits a request that waits for review.
 */
export const canReviewRescheduleRequests = (role?: string | null): boolean => {
  const normalized = String(role ?? '').trim().toLowerCase();

  return (RESCHEDULE_REVIEWER_ROLES as readonly string[]).includes(normalized);
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
