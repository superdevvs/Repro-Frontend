import type { ShootData } from '@/types/shoots';
import { getShootSchedule } from './shootSchedule';
import { buildShootScheduleTimestamp } from './shootScheduleSubmission';

export type ResumeSchedulePayload = {
  scheduled_at?: string;
  scheduled_date?: string;
  time?: string;
  photographer_id?: number;
};

/** True when a held shoot has no usable shoot-level date (imported undated on-hold). */
export function shootNeedsResumeSchedule(shoot: ShootData | null | undefined): boolean {
  if (!shoot) return true;
  return !getShootSchedule(shoot).date;
}

function resolvePhotographerId(shoot: ShootData): number | undefined {
  const raw = shoot.photographer?.id ?? shoot.photographer_id;
  if (raw === null || raw === undefined || raw === '') return undefined;
  const id = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

/**
 * Build POST /shoots/{id}/schedule body for resume-from-hold.
 * - Undated: caller must collect date/time (dialog) — do not invent / send empty.
 * - Dated + still future: shape 3 — photographer only; BE uses saved appointment.
 * - Dated but past: shape 2 — local scheduled_date + time for the next booking day.
 */
export function buildResumeSchedulePayload(
  shoot: ShootData,
  now = new Date(),
): ResumeSchedulePayload | 'needs_schedule' {
  if (shootNeedsResumeSchedule(shoot)) return 'needs_schedule';

  const photographerId = resolvePhotographerId(shoot);
  const withPhotographer = (payload: ResumeSchedulePayload): ResumeSchedulePayload => (
    photographerId ? { ...payload, photographer_id: photographerId } : payload
  );

  const schedule = getShootSchedule(shoot);
  const instantValue = shoot.scheduledInstant ?? shoot.scheduled_instant;
  const instant = instantValue ? Date.parse(instantValue) : NaN;
  const isPast = Number.isFinite(instant) && instant <= now.getTime();

  if (!isPast) {
    // Shape 3: date already on the hold; BE resolves from the saved appointment.
    return withPhotographer({});
  }

  // Past appointment — move to the next booking day in the shoot zone (shape 2).
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
  const date = tomorrow.toISOString().slice(0, 10);
  const time = schedule.time || '10:00';
  return withPhotographer({ scheduled_date: date, time });
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
