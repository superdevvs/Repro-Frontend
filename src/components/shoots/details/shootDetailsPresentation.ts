import { ShootData } from '@/types/shoots';
import {
  normalizeShootPaymentSummary,
  type CanonicalPaymentStatus,
  type ShootPaymentSummaryInput,
} from '@/utils/shootPaymentSummary';
import { normalizeShootDetailsStatus } from '@/components/shoots/modal/shootDetailsCapabilities';
import { getShootStatusBadgeClass } from '@/components/shoots/history/shootHistoryUtils';

type PaymentBadgeVariant = 'default' | 'secondary' | 'destructive';
type WorkflowBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const createWorkflowBadge = (
  status: string,
  label: string,
  variant: WorkflowBadgeVariant,
) => ({
  label,
  variant,
  className: getShootStatusBadgeClass(status),
});

export const shootDetailsWorkflowBadgeMap: Record<
  string,
  { label: string; variant: WorkflowBadgeVariant; className: string }
> = {
  requested: createWorkflowBadge('requested', 'Requested', 'secondary'),
  booked: createWorkflowBadge('booked', 'Scheduled', 'secondary'),
  scheduled: createWorkflowBadge('scheduled', 'Scheduled', 'default'),
  raw_upload_pending: createWorkflowBadge('raw_upload_pending', 'Awaiting RAW', 'outline'),
  uploaded: createWorkflowBadge('uploaded', 'Uploaded', 'default'),
  raw_uploaded: createWorkflowBadge('raw_uploaded', 'Uploaded', 'default'),
  photos_uploaded: createWorkflowBadge('photos_uploaded', 'Uploaded', 'default'),
  in_progress: createWorkflowBadge('in_progress', 'Uploaded', 'default'),
  completed: createWorkflowBadge('completed', 'Uploaded', 'default'),
  raw_issue: createWorkflowBadge('raw_issue', 'RAW Issue', 'destructive'),
  editing: createWorkflowBadge('editing', 'Editing', 'secondary'),
  editing_uploaded: createWorkflowBadge('editing_uploaded', 'In Review', 'default'),
  ready_for_review: createWorkflowBadge('ready_for_review', 'In Review', 'default'),
  pending_review: createWorkflowBadge('pending_review', 'In Review', 'default'),
  review: createWorkflowBadge('review', 'In Review', 'default'),
  editing_issue: createWorkflowBadge('editing_issue', 'Editing Issue', 'destructive'),
  delivered: createWorkflowBadge('delivered', 'Delivered', 'default'),
  ready_for_client: createWorkflowBadge('ready_for_client', 'Delivered', 'default'),
  admin_verified: createWorkflowBadge('admin_verified', 'Delivered', 'default'),
  ready: createWorkflowBadge('ready', 'Ready', 'default'),
  on_hold: createWorkflowBadge('on_hold', 'On Hold', 'destructive'),
  hold_on: createWorkflowBadge('hold_on', 'On Hold', 'destructive'),
  cancelled: createWorkflowBadge('cancelled', 'Cancelled', 'destructive'),
  canceled: createWorkflowBadge('canceled', 'Cancelled', 'destructive'),
  declined: createWorkflowBadge('declined', 'Declined', 'destructive'),
};

const shootDetailsPaymentBadgeMap: Record<
  string,
  { label: string; variant: PaymentBadgeVariant }
> = {
  paid: { label: 'Paid', variant: 'default' },
  unpaid: { label: 'Unpaid', variant: 'destructive' },
  partial: { label: 'Partial', variant: 'secondary' },
};

export const getShootDetailsWorkflowBadge = (status?: string | null) => {
  const key = normalizeShootDetailsStatus(status);
  return shootDetailsWorkflowBadgeMap[key];
};

export const getShootDetailsStatusBadgeInfo = (status?: string | null) => {
  const normalizedStatus = normalizeShootDetailsStatus(status);
  return (
    shootDetailsWorkflowBadgeMap[normalizedStatus] ?? {
      label: status || 'Unknown',
      variant: 'secondary' as WorkflowBadgeVariant,
      className: getShootStatusBadgeClass(status),
    }
  );
};

/**
 * Takes the whole shoot, not its `payment` sub-object.
 *
 * `GET /api/shoots/{id}` does not return a nested `payment` object at all: the
 * canonical figures arrive as top-level `payment_status`, `total_quote`,
 * `total_paid` and `payments`. Passing `{ payment }` therefore handed the
 * summary an empty container, `totalQuote` resolved to 0, and the
 * "a zero-total shoot is settled" rule reported **paid** for every shoot —
 * including one showing an outstanding balance on the same screen.
 */
export const getShootDetailsPaymentStatus = (
  shoot?: ShootPaymentSummaryInput | null,
): CanonicalPaymentStatus | null => {
  // No shoot means unknown, not settled. Without this guard the summary sees a
  // total of 0 and the zero-total rule reports "paid" for a shoot still loading.
  if (!shoot) return null;

  const paymentSummary = normalizeShootPaymentSummary(shoot);
  return paymentSummary.paymentStatus ?? 'unpaid';
};

export const getShootDetailsPaymentBadge = (shoot?: ShootPaymentSummaryInput | null) => {
  const status = getShootDetailsPaymentStatus(shoot);
  // Both consumers already treat a falsy badge as "render nothing", which is the
  // right outcome for an unknown payment state.
  return status ? shootDetailsPaymentBadgeMap[status] : undefined;
};

export const getShootDetailsCreatedByLabel = (shoot: ShootData | null) => {
  if (!shoot) return null;
  const legacyShoot = shoot as ShootData & {
    created_by?: string | null;
    created_by_name?: string | null;
    userCreatedBy?: string | null;
  };
  return (
    shoot.createdBy ||
    legacyShoot.created_by ||
    legacyShoot.created_by_name ||
    legacyShoot.userCreatedBy ||
    null
  );
};

export const getShootDetailsServiceNames = (shoot: ShootData | null): string[] => {
  if (!shoot) return [];
  return (Array.isArray(shoot.services) ? shoot.services : [])
    .map((service) => String(service ?? '').trim())
    .filter(Boolean);
};
