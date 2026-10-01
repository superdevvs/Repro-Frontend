import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import type { DashboardShootSummary } from '@/types/dashboard';
import { formatDashboardDayDistance } from '@/utils/dashboardShootSchedule';

export const getRelativeGroupLabel = (group: { label: string; shoots: DashboardShootSummary[]; isToday?: boolean; dayTime?: number; dayOffset?: number | null }) => {
    const count = group.shoots.length;
    const suffix = count === 1 ? '1 shoot' : `${count} shoots`;
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    if (group.isToday) return `Today \u2022 ${suffix}`;
    if (group.dayOffset != null) {
      const bookedDate = group.dayTime && Number.isFinite(group.dayTime) && group.dayTime !== Number.POSITIVE_INFINITY
        ? new Date(group.dayTime)
        : null;
      return `${formatDashboardDayDistance(group.dayOffset, bookedDate)} \u2022 ${suffix}`;
    }
    if (group.dayTime && Number.isFinite(group.dayTime)) {
      const groupDate = new Date(group.dayTime);
      if (isSameDay(groupDate, tomorrow)) return `Tomorrow \u2022 ${suffix}`;
      const diffMs = startOfDay(groupDate).getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays >= 2 && diffDays <= 6) {
        return `${format(groupDate, 'EEEE')} \u2022 ${suffix}`;
      }
      if (diffDays === -1) return `Yesterday \u2022 ${suffix}`;
      if (diffDays < -1) {
        const absDays = Math.abs(diffDays);
        return absDays > 10
          ? `${Math.round(absDays / 7)} weeks ago \u2022 ${suffix}`
          : `${absDays} days ago \u2022 ${suffix}`;
      }
      return diffDays > 10
        ? `In ${Math.round(diffDays / 7)} weeks \u2022 ${suffix}`
        : `In ${diffDays} days \u2022 ${suffix}`;
    }
    return `${group.label} \u2022 ${suffix}`;
};
