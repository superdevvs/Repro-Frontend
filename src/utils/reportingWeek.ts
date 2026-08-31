import { endOfWeek, format, isAfter, isValid, parseISO, startOfWeek } from 'date-fns';

export type ReportingWeekRange = {
  startDate: string;
  endDate: string;
};

const parseDateOnly = (value: string) => {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

/** Expand any selected dates to complete Sunday-through-Saturday weeks. */
export const normalizeReportingWeekRange = ({
  startDate,
  endDate,
}: ReportingWeekRange): ReportingWeekRange => {
  const parsedStart = parseDateOnly(startDate || endDate);
  const parsedEnd = parseDateOnly(endDate || startDate);

  if (!parsedStart || !parsedEnd) {
    return { startDate: '', endDate: '' };
  }

  const first = isAfter(parsedStart, parsedEnd) ? parsedEnd : parsedStart;
  const last = isAfter(parsedStart, parsedEnd) ? parsedStart : parsedEnd;

  return {
    startDate: format(startOfWeek(first, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
    endDate: format(endOfWeek(last, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
  };
};
