import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  isAfter,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from 'date-fns';

export const INVOICE_DATE_PRESETS = [
  { value: 'all', label: 'All' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
] as const;

export type InvoiceDatePreset = (typeof INVOICE_DATE_PRESETS)[number]['value'];

export interface InvoiceCustomDateRange {
  startDate: string;
  endDate: string;
}

export interface InvoiceDateFilter {
  preset: InvoiceDatePreset;
  customRange?: InvoiceCustomDateRange;
}

export type InvoiceDateInput = Date | string | number | null | undefined;

/** A dated item that covers a period instead of one point in time. */
export interface InvoiceDatePeriod {
  startDate: InvoiceDateInput;
  endDate?: InvoiceDateInput;
}

export interface ResolvedInvoiceDateRange {
  start: Date | null;
  end: Date | null;
}

export const EMPTY_INVOICE_CUSTOM_RANGE: InvoiceCustomDateRange = {
  startDate: '',
  endDate: '',
};

export const DEFAULT_INVOICE_DATE_FILTER: InvoiceDateFilter = {
  preset: 'all',
  customRange: EMPTY_INVOICE_CUSTOM_RANGE,
};

export const parseInvoiceDateInput = (value: InvoiceDateInput): Date | null => {
  if (value === null || value === undefined || value === '') return null;

  const parsed = value instanceof Date
    ? new Date(value.getTime())
    : typeof value === 'string'
      ? parseISO(value)
      : new Date(value);

  return isValid(parsed) ? parsed : null;
};

const orderedDates = (first: Date, second: Date): [Date, Date] =>
  isAfter(first, second) ? [second, first] : [first, second];

/**
 * Resolve a date preset against a reference date. All boundaries include the
 * complete first and last calendar day. Weeks run Sunday through Saturday.
 * Passing `now` makes preset behavior deterministic in tests and scheduled work.
 */
export const resolveInvoiceDateFilterRange = (
  filter: InvoiceDateFilter,
  now: Date = new Date(),
): ResolvedInvoiceDateRange => {
  switch (filter.preset) {
    case 'day':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 0 }),
        end: endOfWeek(now, { weekStartsOn: 0 }),
      };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom': {
      const range = filter.customRange ?? EMPTY_INVOICE_CUSTOM_RANGE;
      const parsedStart = parseInvoiceDateInput(range.startDate || range.endDate);
      const parsedEnd = parseInvoiceDateInput(range.endDate || range.startDate);

      if (!parsedStart || !parsedEnd) return { start: null, end: null };

      const [first, last] = orderedDates(parsedStart, parsedEnd);
      return { start: startOfDay(first), end: endOfDay(last) };
    }
    case 'all':
    default:
      return { start: null, end: null };
  }
};

const isInvoiceDatePeriod = (
  value: InvoiceDateInput | InvoiceDatePeriod,
): value is InvoiceDatePeriod =>
  typeof value === 'object'
  && value !== null
  && !(value instanceof Date)
  && 'startDate' in value;

const resolveItemPeriod = (
  value: InvoiceDateInput | InvoiceDatePeriod,
): ResolvedInvoiceDateRange | null => {
  if (!isInvoiceDatePeriod(value)) {
    const point = parseInvoiceDateInput(value);
    return point ? { start: point, end: point } : null;
  }

  const parsedStart = parseInvoiceDateInput(value.startDate ?? value.endDate);
  const parsedEnd = parseInvoiceDateInput(value.endDate ?? value.startDate);
  if (!parsedStart || !parsedEnd) return null;

  const [start, end] = orderedDates(parsedStart, parsedEnd);
  return { start, end };
};

const isUnboundedRange = ({ start, end }: ResolvedInvoiceDateRange) => !start && !end;

/**
 * Match either a point date or a period against an invoice date filter.
 * Periods use inclusive overlap semantics, so touching either boundary counts.
 */
export const matchesInvoiceDateFilter = (
  value: InvoiceDateInput | InvoiceDatePeriod,
  filter: InvoiceDateFilter,
  now: Date = new Date(),
): boolean => {
  const filterRange = resolveInvoiceDateFilterRange(filter, now);
  if (isUnboundedRange(filterRange)) return true;

  const itemRange = resolveItemPeriod(value);
  if (!itemRange?.start || !itemRange.end || !filterRange.start || !filterRange.end) {
    return false;
  }

  return itemRange.start.getTime() <= filterRange.end.getTime()
    && itemRange.end.getTime() >= filterRange.start.getTime();
};

/** Filter invoice-like rows without requiring a particular invoice model. */
export const filterInvoiceItemsByDate = <Item>(
  items: readonly Item[],
  filter: InvoiceDateFilter,
  selectDate: (item: Item) => InvoiceDateInput | InvoiceDatePeriod,
  now: Date = new Date(),
): Item[] => {
  const filterRange = resolveInvoiceDateFilterRange(filter, now);
  if (isUnboundedRange(filterRange)) return [...items];

  return items.filter((item) => {
    const itemRange = resolveItemPeriod(selectDate(item));
    if (!itemRange?.start || !itemRange.end || !filterRange.start || !filterRange.end) {
      return false;
    }

    return itemRange.start.getTime() <= filterRange.end.getTime()
      && itemRange.end.getTime() >= filterRange.start.getTime();
  });
};
