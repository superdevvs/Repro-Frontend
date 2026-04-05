import { ShootData } from '@/types/shoots';
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary';
import { normalizeShootDetailsStatus } from '@/components/shoots/modal/shootDetailsCapabilities';

type PaymentBadgeVariant = 'default' | 'secondary' | 'destructive';
type WorkflowBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const shootDetailsWorkflowBadgeMap: Record<
  string,
  { label: string; variant: WorkflowBadgeVariant; className: string }
> = {
  requested: {
    label: 'Requested',
    variant: 'secondary',
    className: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  },
  booked: {
    label: 'Scheduled',
    variant: 'secondary',
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  scheduled: {
    label: 'Scheduled',
    variant: 'default',
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  raw_upload_pending: {
    label: 'Awaiting RAW',
    variant: 'outline',
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  uploaded: {
    label: 'Uploaded',
    variant: 'default',
    className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  raw_uploaded: {
    label: 'Uploaded',
    variant: 'default',
    className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  photos_uploaded: {
    label: 'Uploaded',
    variant: 'default',
    className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  in_progress: {
    label: 'Uploaded',
    variant: 'default',
    className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  completed: {
    label: 'Uploaded',
    variant: 'default',
    className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  raw_issue: {
    label: 'RAW Issue',
    variant: 'destructive',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
  editing: {
    label: 'Editing',
    variant: 'secondary',
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  },
  editing_uploaded: {
    label: 'In Review',
    variant: 'default',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  },
  ready_for_review: {
    label: 'In Review',
    variant: 'default',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  },
  pending_review: {
    label: 'In Review',
    variant: 'default',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  },
  review: {
    label: 'In Review',
    variant: 'default',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  },
  editing_issue: {
    label: 'Editing Issue',
    variant: 'destructive',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
  delivered: {
    label: 'Delivered',
    variant: 'default',
    className: 'bg-green-600/10 text-green-700 border-green-600/20',
  },
  ready_for_client: {
    label: 'Delivered',
    variant: 'default',
    className: 'bg-green-600/10 text-green-700 border-green-600/20',
  },
  admin_verified: {
    label: 'Delivered',
    variant: 'default',
    className: 'bg-green-600/10 text-green-700 border-green-600/20',
  },
  ready: {
    label: 'Ready',
    variant: 'default',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  on_hold: {
    label: 'On Hold',
    variant: 'destructive',
    className: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  },
  hold_on: {
    label: 'On Hold',
    variant: 'destructive',
    className: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
  canceled: {
    label: 'Cancelled',
    variant: 'destructive',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
  declined: {
    label: 'Declined',
    variant: 'destructive',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
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
      className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    }
  );
};

export const getShootDetailsPaymentStatus = (payment?: ShootData['payment']) => {
  const paymentSummary = normalizeShootPaymentSummary({ payment });
  return paymentSummary.paymentStatus ?? 'unpaid';
};

export const getShootDetailsPaymentBadge = (payment?: ShootData['payment']) =>
  shootDetailsPaymentBadgeMap[getShootDetailsPaymentStatus(payment)];

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
