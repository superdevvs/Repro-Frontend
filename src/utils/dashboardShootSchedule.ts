import { format } from 'date-fns';
import type { DashboardShootSummary } from '@/types/dashboard';
import { formatTimeForDisplay } from '@/utils/availabilityUtils';
import { extractLocalYmd, parseLocalYmd } from '@/utils/shootLocalDate';
import { getShootSchedule } from '@/utils/shootSchedule';
import { getShootStartInstantMs } from '@/utils/clientContactVisibility';

type DashboardSchedule = Partial<Pick<DashboardShootSummary,
  'scheduledLocalDate' | 'timeLabel' | 'startTime'
>>;

/** Prefer the server-resolved instant for timed windows, with the older API fallback. */
export const getDashboardShootStartInstantMs = (
  shoot: Partial<Pick<DashboardShootSummary, 'scheduledInstant' | 'startTime'>>,
): number | null => getShootStartInstantMs({
  scheduledInstant: shoot.scheduledInstant,
  scheduledAt: shoot.startTime,
});

type DashboardBookedDay = Partial<Pick<DashboardShootSummary,
  'scheduledLocalDate' | 'startTime' | 'scheduleTimezone' | 'dayLabel'
>>;

const ymdToDayNumber = (ymd: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(utc / 86_400_000);
};

/** Calendar day of an instant in an IANA zone, or the viewer's day when the zone is missing. */
export const calendarDayInTimeZone = (instant: Date, timeZone?: string | null): string => {
  const zone = timeZone?.trim();
  if (zone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(instant);
      const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? '';
      const ymd = `${value('year')}-${value('month')}-${value('day')}`;
      if (ymdToDayNumber(ymd) != null) return ymd;
    } catch {
      // An invalid zone falls through to the viewer's calendar day.
    }
  }
  return format(instant, 'yyyy-MM-dd');
};

export const getDashboardBookedYmd = (shoot: DashboardBookedDay): string | null =>
  extractLocalYmd(shoot.scheduledLocalDate) ?? extractLocalYmd(shoot.startTime);

/**
 * Booked calendar day minus "today" in the shoot's zone.
 * Negative means that market day is already over. Missing dates return null.
 */
export const getDashboardBookedDayOffset = (
  shoot: DashboardBookedDay,
  now = new Date(),
): number | null => {
  const booked = getDashboardBookedYmd(shoot);
  const bookedNumber = booked ? ymdToDayNumber(booked) : null;
  const todayNumber = ymdToDayNumber(calendarDayInTimeZone(now, shoot.scheduleTimezone));
  if (bookedNumber == null || todayNumber == null) return null;
  return bookedNumber - todayNumber;
};

export const classifyDashboardBookedDay = (
  shoot: DashboardBookedDay,
  now = new Date(),
) => {
  const offset = getDashboardBookedDayOffset(shoot, now);
  const label = (shoot.dayLabel || '').toLowerCase();
  return {
    offset,
    isToday: offset === 0 || (offset == null && label.includes('today')),
    isPast: offset != null ? offset < 0 : label.includes('yesterday'),
  };
};

export const formatDashboardDayDistance = (
  offset: number,
  bookedDate: Date | null,
): string => {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset === -1) return 'Yesterday';
  if (offset >= 2 && offset <= 6 && bookedDate) return format(bookedDate, 'EEEE');
  if (offset < -1) {
    const absDays = Math.abs(offset);
    return absDays > 10 ? `${Math.round(absDays / 7)} weeks ago` : `${absDays} days ago`;
  }
  if (offset > 10) return `In ${Math.round(offset / 7)} weeks`;
  return `In ${offset} days`;
};

/** Dashboard schedule labels are booked wall-clock values, independent of the viewer's timezone. */
export const getDashboardShootDisplayDate = (shoot: DashboardSchedule): Date | null => {
  const day = extractLocalYmd(shoot.scheduledLocalDate) ?? extractLocalYmd(shoot.startTime);
  if (!day) return null;
  const parsed = parseLocalYmd(day);
  return !Number.isNaN(parsed.getTime()) && format(parsed, 'yyyy-MM-dd') === day ? parsed : null;
};

export const getDashboardShootDisplayTime = (shoot: DashboardSchedule): string | null => {
  // Summary labels take priority; legacy start_time is a wall-clock fallback.
  return getShootSchedule({ time: shoot.timeLabel, scheduled_at: shoot.startTime }).time || null;
};

export const formatDashboardShootSchedule = (
  shoot: DashboardSchedule,
  datePattern = 'MMM d',
): string | null => {
  const date = getDashboardShootDisplayDate(shoot);
  const time = getDashboardShootDisplayTime(shoot);
  return [date ? format(date, datePattern) : null, time ? formatTimeForDisplay(time) : null]
    .filter(Boolean).join(' • ') || null;
};
