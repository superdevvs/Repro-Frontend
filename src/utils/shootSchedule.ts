import { extractLocalYmd } from './shootLocalDate';

interface ShootScheduleSource {
  scheduledDate?: unknown;
  scheduled_date?: unknown;
  scheduledAt?: unknown;
  scheduled_at?: unknown;
  time?: unknown;
  timezone?: unknown;
}

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const clockTime = (value: unknown): string => {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(text(value));
  if (!match) return '';
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || Number(match[3] ?? 0) > 59) return '';
  if (match[4]) {
    if (hour < 1 || hour > 12) return '';
    hour = hour % 12 + (match[4].toLowerCase() === 'pm' ? 12 : 0);
  } else if (hour > 23) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
};

/**
 * Resolve booking fields for display and editing without using the viewer's zone.
 * Local date/time fields are authoritative. Legacy bookings without a shoot zone
 * store a local clock even when the API's datetime cast appends Z. Only bookings
 * with an explicit zone interpret scheduled_at as an absolute instant.
 */
export function getShootSchedule(shoot?: ShootScheduleSource | null): { date: string; time: string } {
  if (!shoot) return { date: '', time: '' };
  const timestamp = text(shoot.scheduled_at) || text(shoot.scheduledAt);
  let fallbackDate = extractLocalYmd(timestamp) ?? '';
  let fallbackTime = clockTime(/[T\s](\d{1,2}:\d{2}(?::\d{2})?)/.exec(timestamp)?.[1]);
  const timezone = text(shoot.timezone);

  if (timezone && timestamp) {
    // Naive backend datetime strings are UTC storage values for zoned bookings.
    const iso = timestamp.replace(' ', 'T');
    const instant = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
    if (!Number.isNaN(instant.getTime())) {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(instant);
        const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value ?? '';
        fallbackDate = `${part('year')}-${part('month')}-${part('day')}`;
        fallbackTime = `${part('hour')}:${part('minute')}`;
      } catch {
        // A malformed zone must not shift a valid saved clock into the browser zone.
      }
    }
  }

  return {
    date: extractLocalYmd(text(shoot.scheduled_date) || text(shoot.scheduledDate)) ?? fallbackDate,
    time: clockTime(shoot.time) || fallbackTime,
  };
}

interface AdoptedShootScheduleSource extends ShootScheduleSource {
  serviceObjects?: Array<{ scheduled_at?: unknown; scheduledAt?: unknown }> | null;
  serviceItems?: Array<{ scheduled_at?: unknown; scheduledAt?: unknown }> | null;
  service_items?: Array<{ scheduled_at?: unknown; scheduledAt?: unknown }> | null;
}

/**
 * Adopted Overview schedule: shoot-level fields BE syncs from services (SoT),
 * with a services fallback when shoot-level date/time are still empty.
 */
export function getAdoptedShootSchedule(
  shoot?: AdoptedShootScheduleSource | null,
): { date: string; time: string } {
  const fromShoot = getShootSchedule(shoot);
  if (fromShoot.date || fromShoot.time) return fromShoot;

  if (!shoot) return { date: '', time: '' };

  const lists = [shoot.serviceObjects, shoot.serviceItems, shoot.service_items];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const scheduledAt = text(item?.scheduled_at) || text(item?.scheduledAt);
      if (!scheduledAt) continue;
      const fromService = getShootSchedule({
        scheduled_at: scheduledAt,
        timezone: shoot.timezone,
      });
      if (fromService.date || fromService.time) return fromService;
    }
  }

  return { date: '', time: '' };
}

