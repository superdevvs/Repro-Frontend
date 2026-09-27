import { differenceInCalendarDays, endOfDay, format, isValid, parseISO, startOfDay, startOfMonth, startOfQuarter, startOfWeek, startOfYear, subDays } from 'date-fns';

export type AccountingDateRange = { startDate: string; endDate: string };
export type AccountingPeriod = 'day' | 'week' | '7' | '30' | '90' | 'month' | 'quarter' | 'year' | 'custom';
export const accountingPeriods: { value: AccountingPeriod; label: string }[] = [
  { value: 'day', label: 'Today' }, { value: 'week', label: 'This week' },
  { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' }, { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' }, { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom dates' },
];
export function accountingRangeForPeriod(period: Exclude<AccountingPeriod, 'custom'>, today = new Date()): AccountingDateRange {
  const end = startOfDay(today);
  const start = period === 'day' ? end : period === 'week' ? startOfWeek(end) : period === 'month' ? startOfMonth(end)
    : period === 'quarter' ? startOfQuarter(end) : period === 'year' ? startOfYear(end) : subDays(end, Number(period) - 1);
  return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') };
}
export function validAccountingRange(range: AccountingDateRange) {
  return [range.startDate, range.endDate].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))) && range.startDate <= range.endDate;
}
export function accountingRangeDates(range: AccountingDateRange) {
  return { start: startOfDay(parseISO(range.startDate)), end: endOfDay(parseISO(range.endDate)) };
}
export function accountingRangeDays(range: AccountingDateRange) {
  return differenceInCalendarDays(parseISO(range.endDate), parseISO(range.startDate)) + 1;
}
export function previousAccountingRange(range: AccountingDateRange) {
  const { start } = accountingRangeDates(range);
  return { start: subDays(start, accountingRangeDays(range)), end: endOfDay(subDays(start, 1)) };
}
export function accountingRangeLabel(range: AccountingDateRange) {
  return `${format(parseISO(range.startDate), 'MMM d, yyyy')} – ${format(parseISO(range.endDate), 'MMM d, yyyy')}`;
}
