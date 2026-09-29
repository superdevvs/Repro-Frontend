import type { ShootData } from '@/types/shoots';
import { getShootSchedule } from './shootSchedule';
import { buildShootScheduleTimestamp } from './shootScheduleSubmission';

export type ResumeSchedulePayload = {
  scheduled_at?: string;
  scheduled_date?: string;
  time?: string;
  photographer_id?: number;
};

type ServiceScheduleHint = { date: string; time: string };

function extractLocalYmd(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function extractLocalHm(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = value.trim().match(/(?:T|\s)(\d{2}:\d{2})/);
  if (match) return match[1];
  if (/^\d{2}:\d{2}/.test(value.trim())) return value.trim().slice(0, 5);
  return null;
}

/** Collect distinct service-level local dates/times from the shoot payload. */
export function getShootServiceScheduleHints(shoot: ShootData | null | undefined): ServiceScheduleHint[] {
  if (!shoot) return [];
  const lists: unknown[] = [
    shoot.serviceObjects,
    shoot.serviceItems,
    (shoot as { service_items?: unknown }).service_items,
    shoot.services,
  ].filter(Array.isArray) as unknown[];

  const hints: ServiceScheduleHint[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const raw of list as Array<Record<string, unknown>>) {
      if (!raw || typeof raw !== 'object') continue;
      const pivot = raw.pivot && typeof raw.pivot === 'object'
        ? (raw.pivot as Record<string, unknown>)
        : null;
      const date =
        extractLocalYmd(raw.scheduled_date) ||
        extractLocalYmd(raw.scheduledDate) ||
        extractLocalYmd(raw.scheduled_at) ||
        extractLocalYmd(raw.scheduledAt) ||
        extractLocalYmd(pivot?.scheduled_at) ||
        extractLocalYmd(pivot?.scheduled_date);
      if (!date) continue;
      const time =
        extractLocalHm(raw.time) ||
        extractLocalHm(raw.scheduled_at) ||
        extractLocalHm(raw.scheduledAt) ||
        extractLocalHm(pivot?.scheduled_at) ||
        extractLocalHm(pivot?.time) ||
        '10:00';
      const key = `${date}|${time}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hints.push({ date, time });
    }
  }
  return hints.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** True when a held shoot has no usable shoot-level date (imported undated on-hold). */
export function shootNeedsResumeSchedule(shoot: ShootData | null | undefined): boolean {
  if (!shoot) return true;
  return !getShootSchedule(shoot).date;
}

/**
 * True when Resume must collect/confirm a date in the dialog:
 * undated holds, past appointments, or shoot header date vs service-date mismatch.
 */
export function shootNeedsResumeScheduleDialog(
  shoot: ShootData | null | undefined,
  now = new Date(),
): boolean {
  if (!shoot || shootNeedsResumeSchedule(shoot)) return true;

  const schedule = getShootSchedule(shoot);
  const instantValue = shoot.scheduledInstant ?? shoot.scheduled_instant;
  const instant = instantValue ? Date.parse(instantValue) : NaN;
  const isPast = Number.isFinite(instant) && instant <= now.getTime();
  if (isPast) return true;

  const serviceHints = getShootServiceScheduleHints(shoot);
  if (serviceHints.length === 0) return false;
  const headerDate = schedule.date;
  return serviceHints.some((hint) => hint.date !== headerDate);
}

/** Prefill for the resume schedule dialog: prefer earliest future service slot. */
export function getResumeScheduleDialogDefaults(
  shoot: ShootData,
  now = new Date(),
): { date: string; time: string } {
  const schedule = getShootSchedule(shoot);
  const todayParts = (() => {
    const timezone = shoot.timezone || shoot.scheduleTimezone || shoot.schedule_timezone;
    try {
      if (!timezone) return null;
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(now);
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((value) => value.type === type)?.value ?? '';
      return `${part('year')}-${part('month')}-${part('day')}`;
    } catch {
      return null;
    }
  })();

  const futureServices = getShootServiceScheduleHints(shoot).filter((hint) => {
    if (!todayParts) return true;
    return hint.date >= todayParts;
  });
  if (futureServices.length > 0) {
    return { date: futureServices[0].date, time: futureServices[0].time || schedule.time || '10:00' };
  }
  return { date: schedule.date, time: schedule.time || '10:00' };
}

export function resolveResumePhotographerId(shoot: ShootData): number | undefined {
  // Prefer the most common service-level assignee (capture photographers) over a
  // shoot-level primary that may only exist on fee/hold lines.
  const counts = new Map<number, number>();
  const bump = (raw: unknown) => {
    if (raw === null || raw === undefined || raw === '') return;
    const id = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    counts.set(id, (counts.get(id) || 0) + 1);
  };
  for (const list of [shoot.serviceObjects, shoot.serviceItems, (shoot as { service_items?: unknown }).service_items, shoot.services]) {
    if (!Array.isArray(list)) continue;
    for (const raw of list as Array<Record<string, unknown>>) {
      if (!raw || typeof raw !== 'object') continue;
      const pivot = raw.pivot && typeof raw.pivot === 'object' ? (raw.pivot as Record<string, unknown>) : null;
      const photographer = raw.photographer && typeof raw.photographer === 'object'
        ? (raw.photographer as Record<string, unknown>)
        : null;
      bump(raw.resolved_photographer_id ?? raw.photographer_id ?? pivot?.photographer_id ?? photographer?.id);
    }
  }
  if (counts.size > 0) {
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    return ranked[0][0];
  }
  const raw = shoot.photographer?.id ?? shoot.photographer_id;
  if (raw === null || raw === undefined || raw === '') return undefined;
  const id = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

/**
 * Build POST /shoots/{id}/schedule body for resume-from-hold.
 * - Undated / past / header↔service date mismatch: caller must confirm via dialog.
 * - Dated + still future + services agree: shape 3 — photographer only; BE uses saved appointment.
 */
export function buildResumeSchedulePayload(
  shoot: ShootData,
  now = new Date(),
): ResumeSchedulePayload | 'needs_schedule' {
  if (shootNeedsResumeScheduleDialog(shoot, now)) return 'needs_schedule';

  const photographerId = resolveResumePhotographerId(shoot);
  const withPhotographer = (payload: ResumeSchedulePayload): ResumeSchedulePayload => (
    photographerId ? { ...payload, photographer_id: photographerId } : payload
  );

  // Shape 3: date already on the hold and still in the future; BE resolves from saved appointment.
  return withPhotographer({});
}

/** @deprecated Prefer buildResumeSchedulePayload + scheduled_date/time contract. */
export function buildResumeScheduleTimestamp(shoot: ShootData, now = new Date()): string | null {
  const schedule = getShootSchedule(shoot);
  const instantValue = shoot.scheduledInstant ?? shoot.scheduled_instant;
  const instant = instantValue ? Date.parse(instantValue) : NaN;
  const shouldReschedule = !schedule.date || (Number.isFinite(instant) && instant <= now.getTime());
  let date = schedule.date;

  if (shouldReschedule) {
    const timezone = shoot.timezone || shoot.scheduleTimezone || shoot.schedule_timezone;
    if (!timezone) {
      throw new Error('Refresh this shoot to load its scheduling timezone before resuming.');
    }
    let parts: Intl.DateTimeFormatPart[];
    try {
      parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(now);
    } catch {
      throw new Error('The shoot timezone is invalid. Correct the timezone before resuming.');
    }
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value ?? '';
    const tomorrow = new Date(Date.UTC(Number(part('year')), Number(part('month')) - 1, Number(part('day')) + 1));
    date = tomorrow.toISOString().slice(0, 10);
  }

  // Keep legacy wall-clock behavior when only scheduleTimezone is set (tests + older callers).
  return buildShootScheduleTimestamp(date, schedule.time || '10:00', shoot.timezone,
    shouldReschedule ? null : instantValue);
}
