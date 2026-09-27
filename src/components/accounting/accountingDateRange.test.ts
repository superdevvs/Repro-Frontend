import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { accountingRangeDates, accountingRangeDays, accountingRangeForPeriod, previousAccountingRange, validAccountingRange } from './accountingDateRange';

describe('Accounting reporting dates', () => {
  it('includes exactly thirty calendar days across a month boundary', () => {
    const range = accountingRangeForPeriod('30', new Date(2026, 8, 27, 19));
    expect(range).toEqual({ startDate: '2026-08-29', endDate: '2026-09-27' });
    expect(accountingRangeDays(range)).toBe(30);
    expect(accountingRangeDates(range).end.getHours()).toBe(23);
  });
  it('uses calendar periods and supports leap days', () => {
    expect(accountingRangeForPeriod('month', new Date(2024, 1, 29))).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
    expect(accountingRangeForPeriod('quarter', new Date(2026, 8, 27))).toEqual({ startDate: '2026-07-01', endDate: '2026-09-27' });
  });
  it('compares the immediately preceding period with equal calendar length', () => {
    const previous = previousAccountingRange({ startDate: '2026-09-01', endDate: '2026-09-07' });
    expect(format(previous.start, 'yyyy-MM-dd')).toBe('2026-08-25');
    expect(format(previous.end, 'yyyy-MM-dd')).toBe('2026-08-31');
  });
  it('rejects invalid or reversed custom dates', () => {
    expect(validAccountingRange({ startDate: '2026-02-30', endDate: '2026-03-04' })).toBe(false);
    expect(validAccountingRange({ startDate: '2026-09-08', endDate: '2026-09-07' })).toBe(false);
    expect(validAccountingRange({ startDate: '2026-09-07', endDate: '2026-09-07' })).toBe(true);
  });
});
