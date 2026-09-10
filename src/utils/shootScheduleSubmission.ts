import { buildWallClockIso } from './wallClockDateTime';

/** Serialize local form fields using the booking's storage convention. */
export function buildShootScheduleTimestamp(
  date: string,
  time: string,
  timezone?: string | null,
  originalTimestamp?: string | null,
): string | null {
  const wallClock = buildWallClockIso(date, time);
  if (!wallClock || !timezone?.trim()) return wallClock;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
  } catch {
    throw new Error('The shoot timezone is invalid. Correct the timezone before saving this schedule.');
  }
  const localStamp = (instant: number): string => {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
  };
  const originalIso = originalTimestamp?.trim().replace(' ', 'T');
  const original = originalIso
    ? Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(originalIso) ? originalIso : `${originalIso}Z`)
    : NaN;
  if (Number.isFinite(original) && localStamp(original).slice(0, 16) === wallClock.slice(0, 16)) {
    return new Date(original).toISOString();
  }

  const naiveUtc = Date.parse(`${wallClock}Z`);
  const offsets = new Set([-86_400_000, 0, 86_400_000].map(delta => {
    const sample = naiveUtc + delta;
    return Date.parse(`${localStamp(sample)}Z`) - sample;
  }));
  const candidates = [...offsets].map(offset => naiveUtc - offset)
    .filter(instant => localStamp(instant) === wallClock)
    .sort((left, right) => left - right);

  if (candidates.length === 0) {
    throw new Error('This time does not exist in the shoot timezone because of a daylight-saving change. Choose another time.');
  }
  if (candidates.length > 1) {
    throw new Error('This time occurs twice in the shoot timezone because of a daylight-saving change. Choose an unambiguous time.');
  }
  return new Date(candidates[0]).toISOString();
}

export function findServiceScheduleTimestamp(shoot: {
  serviceItems?: unknown; service_items?: unknown; serviceObjects?: unknown; services?: unknown;
} | null | undefined, serviceId: string | number): string | null {
  if (!shoot) return null;
  for (const list of [shoot.serviceItems, shoot.service_items, shoot.serviceObjects, shoot.services]) {
    if (!Array.isArray(list)) continue;
    for (const value of list) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      if (String(item.service_id ?? item.serviceId ?? item.id) !== String(serviceId)) continue;
      const timestamp = item.scheduled_at ?? item.scheduledAt;
      if (typeof timestamp === 'string' && timestamp) return timestamp;
    }
  }
  return null;
}
