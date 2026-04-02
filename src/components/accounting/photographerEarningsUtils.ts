import { ShootData } from '@/types/shoots';
import { getShootPhotographerAssignments } from '@/utils/shootPhotographerAssignments';
import { calculatePhotographerPay } from '@/utils/servicePricing';
import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  getQuarter,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from 'date-fns';

type UserLike = {
  id?: string | number | null;
  name?: string | null;
} | null | undefined;

type TrendDirection = 'up' | 'down';
export type EarningsTimeFilter = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface PercentageTrend {
  value: number;
  direction: TrendDirection;
}

export interface EarningsDateRange {
  start: Date;
  end: Date;
}

export interface EarningsChartBucket extends EarningsDateRange {
  key: string;
  label: string;
}

const COMPLETED_STATUSES = new Set(['completed', 'delivered', 'finalized']);

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : String(value ?? '').trim().toLowerCase();

const toNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeServiceText = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getShootSqft = (shoot: ShootData) => {
  const propertyDetails = shoot.propertyDetails || shoot.property_details;
  return (
    toNumber(propertyDetails?.sqft) ??
    toNumber(propertyDetails?.squareFeet) ??
    toNumber(propertyDetails?.square_feet)
  );
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
  const topLevelAssignedToUser = user
    ? matchesPhotographer(user, shoot.photographer?.id, shoot.photographer?.name)
    : false;
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

    if (hasServiceLevelOwners && !topLevelAssignedToUser) {
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

export const getPhotographerPayForService = (
  shoot: ShootData,
  service:
    | string
    | (ShootData['serviceObjects'] extends Array<infer ServiceType> ? ServiceType : never)
    | Record<string, unknown>,
) => {
  const sqft = getShootSqft(shoot);
  const serviceRecord = service as Record<string, unknown>;
  const directPay = toNumber(serviceRecord.photographer_pay);
  const calculatedPay =
    sqft != null
      ? calculatePhotographerPay(
          {
            id: String(serviceRecord.id ?? serviceRecord.name ?? serviceRecord.label ?? 'service'),
            name: String(serviceRecord.name ?? serviceRecord.label ?? service ?? 'Service'),
            price: toNumber(serviceRecord.price) ?? 0,
            pricing_type:
              serviceRecord.pricing_type === 'variable' || serviceRecord.pricing_type === 'fixed'
                ? serviceRecord.pricing_type
                : undefined,
            photographer_pay:
              directPay ??
              (typeof serviceRecord.photographer_pay === 'string'
                ? Number(serviceRecord.photographer_pay)
                : (serviceRecord.photographer_pay as number | null | undefined)) ??
              null,
            sqft_ranges: Array.isArray(serviceRecord.sqft_ranges)
              ? (serviceRecord.sqft_ranges as Array<{
                  sqft_from: number;
                  sqft_to: number;
                  duration: number | null;
                  price: number;
                  photographer_pay: number | null;
                  photo_count?: number | null;
                }>)
              : undefined,
          },
          sqft,
        )
      : null;

  return Number((calculatedPay ?? directPay ?? 0).toFixed(2));
};

export const getMatchingShootServiceForInvoiceItem = (shoot: ShootData, description?: string | null) => {
  if (!description) return null;

  const normalizedDescription = normalizeServiceText(description);
  if (!normalizedDescription) {
    return null;
  }

  const serviceObjects = Array.isArray(shoot.serviceObjects) ? shoot.serviceObjects : [];
  if (!serviceObjects.length) {
    return null;
  }

  let bestMatch: (typeof serviceObjects)[number] | null = null;
  let bestScore = 0;

  serviceObjects.forEach((serviceObject) => {
    const normalizedName = normalizeServiceText(serviceObject.name);
    if (!normalizedName) {
      return;
    }

    if (normalizedDescription === normalizedName) {
      bestMatch = serviceObject;
      bestScore = Number.MAX_SAFE_INTEGER;
      return;
    }

    if (
      normalizedDescription.includes(normalizedName) ||
      normalizedName.includes(normalizedDescription)
    ) {
      const score = normalizedName.length;
      if (score > bestScore) {
        bestMatch = serviceObject;
        bestScore = score;
      }
    }
  });

  return bestMatch;
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

export const getEarningsDateRange = (timeFilter: EarningsTimeFilter, referenceDate = new Date()): EarningsDateRange => {
  if (timeFilter === 'day') {
    return {
      start: startOfDay(referenceDate),
      end: endOfDay(referenceDate),
    };
  }

  if (timeFilter === 'week') {
    return {
      start: startOfWeek(referenceDate),
      end: endOfWeek(referenceDate),
    };
  }

  if (timeFilter === 'quarter') {
    return {
      start: startOfQuarter(referenceDate),
      end: endOfQuarter(referenceDate),
    };
  }

  if (timeFilter === 'year') {
    return {
      start: startOfYear(referenceDate),
      end: endOfYear(referenceDate),
    };
  }

  return {
    start: startOfMonth(referenceDate),
    end: endOfMonth(referenceDate),
  };
};

export const isDateInRange = (date: Date | null, range: EarningsDateRange) =>
  Boolean(date && isWithinInterval(date, range));

export const getPreviousEarningsDateRange = (timeFilter: EarningsTimeFilter, referenceDate = new Date()) => {
  if (timeFilter === 'day') {
    return getEarningsDateRange(timeFilter, subDays(referenceDate, 1));
  }

  if (timeFilter === 'week') {
    return getEarningsDateRange(timeFilter, subWeeks(referenceDate, 1));
  }

  if (timeFilter === 'quarter') {
    return getEarningsDateRange(timeFilter, subQuarters(referenceDate, 1));
  }

  if (timeFilter === 'year') {
    return getEarningsDateRange(timeFilter, subYears(referenceDate, 1));
  }

  return getEarningsDateRange(timeFilter, subMonths(referenceDate, 1));
};

export const getEarningsPeriodLabel = (timeFilter: EarningsTimeFilter) => {
  switch (timeFilter) {
    case 'day':
      return 'Today';
    case 'week':
      return 'This Week';
    case 'quarter':
      return 'This Quarter';
    case 'year':
      return 'This Year';
    default:
      return 'This Month';
  }
};

export const getPhotographerChartBuckets = (
  timeFilter: EarningsTimeFilter,
  referenceDate = new Date(),
): EarningsChartBucket[] => {
  if (timeFilter === 'day') {
    return Array.from({ length: 14 }, (_, idx) => {
      const date = subDays(referenceDate, 13 - idx);
      return {
        key: format(date, 'yyyy-MM-dd'),
        label: format(date, 'MMM dd'),
        start: startOfDay(date),
        end: endOfDay(date),
      };
    });
  }

  if (timeFilter === 'week') {
    return Array.from({ length: 12 }, (_, idx) => {
      const date = subWeeks(referenceDate, 11 - idx);
      return {
        key: format(date, 'yyyy-ww'),
        label: format(startOfWeek(date), 'MMM dd'),
        start: startOfWeek(date),
        end: endOfWeek(date),
      };
    });
  }

  if (timeFilter === 'quarter') {
    return Array.from({ length: 8 }, (_, idx) => {
      const date = subQuarters(referenceDate, 7 - idx);
      return {
        key: format(date, 'yyyy') + `-Q${getQuarter(date)}`,
        label: `Q${getQuarter(date)} ${format(date, 'yy')}`,
        start: startOfQuarter(date),
        end: endOfQuarter(date),
      };
    });
  }

  if (timeFilter === 'year') {
    return Array.from({ length: 5 }, (_, idx) => {
      const date = subYears(referenceDate, 4 - idx);
      return {
        key: format(date, 'yyyy'),
        label: format(date, 'yyyy'),
        start: startOfYear(date),
        end: endOfYear(date),
      };
    });
  }

  return Array.from({ length: 12 }, (_, idx) => {
    const date = subMonths(referenceDate, 11 - idx);
    return {
      key: format(date, 'yyyy-MM'),
      label: format(date, 'MMM'),
      start: startOfMonth(date),
      end: endOfMonth(date),
    };
  });
};
