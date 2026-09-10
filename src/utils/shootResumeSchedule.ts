import type { ShootData } from '@/types/shoots';
import { getShootSchedule } from './shootSchedule';
import { buildShootScheduleTimestamp } from './shootScheduleSubmission';

/** Resume a saved future schedule, or move a past appointment to the next booking day. */
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

  return buildShootScheduleTimestamp(date, schedule.time || '10:00', shoot.timezone,
    shouldReschedule ? null : instantValue);
}
