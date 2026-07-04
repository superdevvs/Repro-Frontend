import { getShootLocalDate } from '@/utils/shootLocalDate';
import { normalizeTimezone } from '@/utils/timezone';

type ShootLike = {
  scheduledDate?: string | null;
  scheduled_date?: string | null;
  scheduledAt?: string | null;
  scheduled_at?: string | null;
  timezone?: string | null;
};

type ClientLike = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const PRIVILEGED_ROLES = new Set([
  'admin',
  'superadmin',
  'super_admin',
  'editing_manager',
  'salesrep',
  'sales_rep',
  'rep',
  'representative',
]);

const ymdInTimezone = (timezone?: string | null): string => {
  const normalizedTimezone = normalizeTimezone(timezone) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: normalizedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through to local date when the timezone is missing or invalid.
  }

  return new Date().toISOString().slice(0, 10);
};

export const normalizeContactViewerRole = (role?: string | null): string =>
  String(role || '').trim().toLowerCase();

export const isShootDayForContact = (shoot?: ShootLike | null): boolean => {
  const shootLocalDate = getShootLocalDate(shoot);
  if (!shootLocalDate) {
    return false;
  }

  return shootLocalDate === ymdInTimezone(shoot?.timezone);
};

export const getClientContactVisibility = ({
  role,
  shoot,
  shouldHideClientDetails = false,
}: {
  role?: string | null;
  shoot?: ShootLike | null;
  shouldHideClientDetails?: boolean;
}) => {
  const normalizedRole = normalizeContactViewerRole(role);

  if (PRIVILEGED_ROLES.has(normalizedRole)) {
    return {
      canShowName: true,
      canShowEmail: true,
      canShowPhone: true,
    };
  }

  if (normalizedRole === 'photographer') {
    return {
      canShowName: true,
      canShowEmail: false,
      canShowPhone: isShootDayForContact(shoot),
    };
  }

  if (shouldHideClientDetails || normalizedRole === 'editor') {
    return {
      canShowName: false,
      canShowEmail: false,
      canShowPhone: false,
    };
  }

  return {
    canShowName: true,
    canShowEmail: true,
    canShowPhone: true,
  };
};

export const getVisibleClientContact = <TClient extends ClientLike | null | undefined>({
  client,
  role,
  shoot,
  shouldHideClientDetails = false,
}: {
  client: TClient;
  role?: string | null;
  shoot?: ShootLike | null;
  shouldHideClientDetails?: boolean;
}) => {
  const visibility = getClientContactVisibility({ role, shoot, shouldHideClientDetails });

  return {
    ...visibility,
    name: visibility.canShowName ? client?.name ?? null : null,
    email: visibility.canShowEmail ? client?.email ?? null : null,
    phone: visibility.canShowPhone ? client?.phone ?? null : null,
  };
};
