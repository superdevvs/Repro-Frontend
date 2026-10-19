import { isValid, parseISO } from 'date-fns';

/** Invoice DATE fields keep their calendar day, including Laravel's UTC serialization. */
export const parseInvoiceCalendarDate = (value?: string | null): Date | null => {
  const day = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/.exec(value?.trim() ?? '')?.[1];
  if (!day) return null;
  const parsed = parseISO(day);
  return isValid(parsed) ? parsed : null;
};

export const formatInvoiceCalendarDate = (value?: string | null, fallback = 'N/A'): string => {
  const parsed = parseInvoiceCalendarDate(value);
  return parsed?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) ?? fallback;
};
