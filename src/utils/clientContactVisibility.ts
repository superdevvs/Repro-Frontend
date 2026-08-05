import { getShootLocalDate } from '@/utils/shootLocalDate';
import { normalizeTimezone } from '@/utils/timezone';

type ShootLike = {
  scheduledDate?: string | null;
  scheduled_date?: string | null;
  scheduledAt?: string | null;
  scheduled_at?: string | null;
  time?: string | null;
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

/** Minutes before the scheduled start that the client phone unlocks. */
export const PHOTOGRAPHER_CONTACT_LEAD_MINUTES = 120;

/**
 * On-site buffer treated as the appointment itself. Shoots store no duration,
 * so the trailing window is measured from the end of this buffer.
 */
export const PHOTOGRAPHER_SHOOT_BUFFER_MINUTES = 60;

/** Minutes after the on-site buffer ends that the client phone stays unlocked. */
export const PHOTOGRAPHER_CONTACT_TRAIL_MINUTES = 120;

const MINUTE_MS = 60_000;
const ABSOLUTE_INSTANT_RE = /(Z|[+-]\d{2}:?\d{2})$/i;
const WALL_TIME_RE = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i;

/**
 * Epoch ms for a value that carries its own UTC offset (`Z` or `±hh:mm`).
 *
 * Offset-less datetimes are rejected on purpose: browsers would interpret them
 * in the viewer's timezone, which would shift the window for anyone not sitting
 * in the shoot's timezone.
 */
const parseAbsoluteInstant = (value?: string | null): number | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!ABSOLUTE_INSTANT_RE.test(trimmed)) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

/** Minutes since midnight from `HH:mm[:ss]`, `h:mm AM/PM`, or a datetime string. */
const parseWallTimeMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const match = WALL_TIME_RE.exec(String(value).trim());
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  if (meridiem === 'pm' && hours !== 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

/** Offset (ms) of `timezone` at a given instant: zone wall clock minus UTC. */
const timezoneOffsetMs = (timezone: string, instantMs: number): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);

  return Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  ) - instantMs;
};

/**
 * Epoch ms for a wall-clock time on `ymd` in `timezone`.
 *
 * The offset is resolved twice so a start that sits near a DST transition lands
 * on the correct instant.
 */
const zonedWallTimeToMs = (ymd: string, minutesFromMidnight: number, timezone?: string | null): number | null => {
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) return null;

  const naiveUtc = Date.UTC(year, month - 1, day) + minutesFromMidnight * MINUTE_MS;
  const resolvedTimezone = normalizeTimezone(timezone)
    || Intl.DateTimeFormat().resolvedOptions().timeZone
    || 'UTC';

  try {
    const firstPass = naiveUtc - timezoneOffsetMs(resolvedTimezone, naiveUtc);
    return naiveUtc - timezoneOffsetMs(resolvedTimezone, firstPass);
  } catch {
    // Unknown/invalid timezone: fall back to the naive UTC instant.
    return naiveUtc;
  }
};

/**
 * The shoot's start as an absolute instant.
 *
 * `scheduledAt` is authoritative when it carries an offset; otherwise the local
 * `scheduledDate` + `time` pair is anchored in the shoot's own timezone (never
 * the viewer's).
 */
export const getShootStartInstantMs = (shoot?: ShootLike | null): number | null => {
  if (!shoot) return null;

  const absolute = parseAbsoluteInstant(shoot.scheduledAt) ?? parseAbsoluteInstant(shoot.scheduled_at);
  if (absolute !== null) return absolute;

  const shootLocalDate = getShootLocalDate(shoot);
  if (!shootLocalDate) return null;

  const minutesFromMidnight = parseWallTimeMinutes(shoot.time)
    ?? parseWallTimeMinutes(shoot.scheduledAt)
    ?? parseWallTimeMinutes(shoot.scheduled_at)
    ?? 0;

  return zonedWallTimeToMs(shootLocalDate, minutesFromMidnight, shoot.timezone);
};

/**
 * Whether now sits inside the photographer's contact window: two hours before
 * the scheduled start, through the on-site buffer, plus two hours after it.
 *
 * Mirrors `App\Services\Shoots\ShootClientContactVisibility`, which is the
 * authority that decides whether the number is serialized at all.
 */
export const isWithinPhotographerContactWindow = (shoot?: ShootLike | null): boolean => {
  const startMs = getShootStartInstantMs(shoot);
  if (startMs === null) return false;

  const now = Date.now();
  const opensAt = startMs - PHOTOGRAPHER_CONTACT_LEAD_MINUTES * MINUTE_MS;
  const closesAt = startMs
    + (PHOTOGRAPHER_SHOOT_BUFFER_MINUTES + PHOTOGRAPHER_CONTACT_TRAIL_MINUTES) * MINUTE_MS;

  return now >= opensAt && now <= closesAt;
};

export const normalizeContactViewerRole = (role?: string | null): string =>
  String(role || '').trim().toLowerCase();

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
      canShowPhone: isWithinPhotographerContactWindow(shoot),
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
