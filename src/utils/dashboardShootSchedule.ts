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
