
import { ShootData } from "@/types/shoots";
import { addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isBefore, isAfter, isSameDay } from "date-fns";
import { calendarDay } from '@/lib/date';

export type TimeRange = 'day' | 'week' | 'month' | 'year';

export const getDateRangeFromTimeRange = (timeRange: TimeRange): [Date, Date] => {
  const now = new Date();
  
  switch (timeRange) {
    case 'day':
      return [startOfDay(now), endOfDay(now)];
    case 'week':
      return [startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })];
    case 'month':
      return [startOfMonth(now), endOfMonth(now)];
    case 'year':
      return [startOfYear(now), endOfYear(now)];
    default:
      return [startOfMonth(now), endOfMonth(now)];
  }
};

export const filterShootsByDateRange = (shoots: ShootData[], timeRange: TimeRange): ShootData[] => {
  const [startDate, endDate] = getDateRangeFromTimeRange(timeRange);
  
  return shoots.filter(shoot => {
    // Ensure we're working with a valid date
    const shootDate = calendarDay(shoot.scheduledDate);
    
    return !isBefore(shootDate, startDate) && !isAfter(shootDate, endDate);
  });
};

// Ensure the date is normalized to avoid timezone issues
export const normalizeDate = (date: Date): Date => {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12, // Set to noon to avoid timezone issues
    0,
    0
  );
};

export const getScheduledTodayShoots = (shoots: ShootData[]): ShootData[] => {
  const today = normalizeDate(new Date());
  return shoots.filter(shoot => {
    const shootDate = calendarDay(shoot.scheduledDate);
    return isSameDay(shootDate, today);
  });
};

export const getActiveShootsCount = (shoots: ShootData[]): number => {
  return shoots.filter(shoot => shoot.status === 'scheduled').length;
};

export const getCompletedShootsCount = (shoots: ShootData[]): number => {
  return shoots.filter(shoot => shoot.status === 'completed').length;
};

export const getTotalPaidAmount = (shoots: ShootData[]): number => {
  return shoots.reduce((total, shoot) => {
    const paidAmount = shoot.payment?.totalPaid || 0;
    return total + paidAmount;
  }, 0);
};

export const getEstimatedTaxAmount = (shoots: ShootData[], taxRate: number = 0.15): number => {
  const totalRevenue = getTotalPaidAmount(shoots);
  return totalRevenue * taxRate;
};

export const getUniqueClientsCount = (shoots: ShootData[]): number => {
  const clientNames = new Set(shoots.map(shoot => shoot.client.name));
  return clientNames.size;
};

export const getTotalMediaAssetsCount = (shoots: ShootData[]): number => {
  let count = 0;
  shoots.forEach(shoot => {
    if (shoot.media && shoot.media.photos) {
      count += shoot.media.photos.length;
    }
  });
  return count;
};
