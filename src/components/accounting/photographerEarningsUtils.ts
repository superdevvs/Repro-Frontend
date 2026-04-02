import { ShootData } from '@/types/shoots';
import { getShootPhotographerAssignments } from '@/utils/shootPhotographerAssignments';

type UserLike = {
  id?: string | number | null;
  name?: string | null;
} | null | undefined;

type TrendDirection = 'up' | 'down';

export interface PercentageTrend {
  value: number;
  direction: TrendDirection;
}

const COMPLETED_STATUSES = new Set(['completed', 'delivered', 'finalized']);

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : String(value ?? '').trim().toLowerCase();

const toNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getUserIdentity = (user: UserLike) => ({
  id: user?.id != null ? String(user.id) : null,
  name: normalizeText(user?.name),
});

const matchesPhotographer = (
  user: UserLike,
  photographerId?: string | number | null,
  photographerName?: string | null,
) => {
  const identity = getUserIdentity(user);
  const candidateId = photographerId != null ? String(photographerId) : null;
  const candidateName = normalizeText(photographerName);

  if (identity.id && candidateId && identity.id === candidateId) {
    return true;
  }

  return Boolean(identity.name && candidateName && identity.name === candidateName);
};

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isCompletedShoot = (shoot: ShootData) => {
  const legacyShoot = shoot as ShootData & Record<string, unknown>;
  const status = normalizeText(shoot.status);
  return Boolean(
    shoot.completedDate ||
      legacyShoot.completed_at ||
      legacyShoot.completedAt ||
      legacyShoot.completed_date ||
      legacyShoot.editing_completed_at ||
      legacyShoot.admin_verified_at ||
      COMPLETED_STATUSES.has(status),
  );
};

export const getShootCompletedDate = (shoot: ShootData) => {
  const legacyShoot = shoot as ShootData & Record<string, unknown>;
  return (
    parseDate(shoot.completedDate) ||
    parseDate(legacyShoot.completed_at) ||
    parseDate(legacyShoot.completedAt) ||
    parseDate(legacyShoot.completed_date) ||
    parseDate(legacyShoot.editing_completed_at) ||
    parseDate(legacyShoot.admin_verified_at) ||
    (isCompletedShoot(shoot) ? parseDate(shoot.scheduledDate) : null)
  );
};

export const getShootScheduledDate = (shoot: ShootData) => {
  const legacyShoot = shoot as ShootData & Record<string, unknown>;
  return (
    parseDate(shoot.scheduledDate) ||
    parseDate(legacyShoot.scheduled_date) ||
    parseDate(legacyShoot.scheduled_at) ||
    parseDate(legacyShoot.scheduledAt)
  );
};

export const isShootAssignedToPhotographer = (shoot: ShootData, user: UserLike) => {
  if (!user) return false;

  if (matchesPhotographer(user, shoot.photographer?.id, shoot.photographer?.name)) {
    return true;
  }

  const assignments = getShootPhotographerAssignments(shoot);
  if (!assignments.length) {
    return false;
  }

  return assignments.some((assignment) =>
    matchesPhotographer(
      user,
      assignment.photographerId ?? assignment.photographer?.id,
      assignment.photographer?.name,
    ),
  );
};

export const getPhotographerPayoutStatus = (shoot: ShootData) => {
  const legacyShoot = shoot as ShootData & Record<string, unknown>;
  const paidAt =
    legacyShoot.photographerPaidAt ||
    legacyShoot.photographer_paid_at ||
    legacyShoot.paid_at_photographer;

  if (paidAt) {
    return 'paid' as const;
  }

  const rawStatus =
    legacyShoot.payout_status ||
    legacyShoot.payoutStatus ||
    legacyShoot.payment_status ||
    legacyShoot.paymentStatus;
  const normalizedStatus = normalizeText(rawStatus);

  if (normalizedStatus === 'paid') {
    return 'paid' as const;
  }

  if (normalizedStatus === 'pending' || normalizedStatus === 'unpaid') {
    return 'pending' as const;
  }

  return isCompletedShoot(shoot) ? ('pending' as const) : ('upcoming' as const);
};

export const getPhotographerPayoutDate = (shoot: ShootData) => {
  const legacyShoot = shoot as ShootData & Record<string, unknown>;
  return (
    String(
      legacyShoot.photographerPaidAt ||
        legacyShoot.photographer_paid_at ||
        legacyShoot.paid_at_photographer ||
        '',
    ) || null
  );
};

export const getPhotographerPayForShoot = (shoot: ShootData, user?: UserLike) => {
  const legacyShoot = shoot as ShootData & Record<string, unknown>;
  const directPay =
    toNumber(shoot.totalPhotographerPay) ??
    toNumber(shoot.photographerPay) ??
    toNumber(legacyShoot.total_photographer_pay) ??
    toNumber(legacyShoot.photographer_fee) ??
    toNumber(legacyShoot.photographerFee);

  const assignments = getShootPhotographerAssignments(shoot);
  if (user && assignments.length > 0) {
    const matchedAssignments = assignments.filter((assignment) =>
      matchesPhotographer(
        user,
        assignment.photographerId ?? assignment.photographer?.id,
        assignment.photographer?.name,
      ),
    );

    if (matchedAssignments.length > 0) {
      const matchedAssignmentPay = matchedAssignments.reduce((sum, assignment) => {
        const rawAssignment = assignment.raw as Record<string, unknown>;
        return (
          sum +
          (toNumber(rawAssignment.photographer_pay) ??
            toNumber((rawAssignment.pivot as Record<string, unknown> | undefined)?.photographer_pay) ??
            0)
        );
      }, 0);

      if (matchedAssignmentPay > 0) {
        return matchedAssignmentPay;
      }

      if (directPay != null) {
        return directPay;
      }
    }

    const hasServiceLevelOwners = assignments.some(
      (assignment) =>
        assignment.photographerId ||
        assignment.photographer?.id ||
        normalizeText(assignment.photographer?.name),
    );

    if (hasServiceLevelOwners) {
      return 0;
    }
  }

  const serviceLevelPay = (shoot.serviceObjects || []).reduce((sum, service) => {
    const servicePay = toNumber(service.photographer_pay);
    return sum + (servicePay ?? 0);
  }, 0);

  if (serviceLevelPay > 0) {
    return serviceLevelPay;
  }

  if (directPay != null) {
    return directPay;
  }

  const totalQuote = toNumber(shoot.payment?.totalQuote) ?? toNumber(shoot.totalQuote);
  return totalQuote != null ? Number((totalQuote * 0.4).toFixed(2)) : 0;
};

export const calculatePercentageTrend = (
  currentValue: number,
  previousValue: number,
): PercentageTrend | undefined => {
  if (currentValue === 0 && previousValue === 0) {
    return undefined;
  }

  if (previousValue <= 0) {
    return currentValue > 0 ? { value: 100, direction: 'up' } : undefined;
  }

  const percentage = ((currentValue - previousValue) / previousValue) * 100;
  return {
    value: Number(Math.abs(percentage).toFixed(1)),
    direction: percentage >= 0 ? 'up' : 'down',
  };
};
