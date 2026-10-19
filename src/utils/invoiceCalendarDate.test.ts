import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { formatBillingPeriod } from '@/components/accounting/invoiceReviewWorkspaceUtils';
import { buildWeeklyInvoiceExportRows, filterWeeklyInvoicesByDate, formatWeeklyBillingPeriod } from '@/components/invoices/weeklyInvoiceReviewUtils';
import type { WeeklyInvoice } from '@/services/invoiceService';
import { parseInvoiceDateInput } from './invoiceDateFilters';
import { formatInvoiceCalendarDate, parseInvoiceCalendarDate } from './invoiceCalendarDate';

const cast = (date: string) => `${date}T00:00:00.000000Z`;

describe.each(['America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati', 'UTC'])('invoice calendar dates in %s', timezone => {
  const inTimezone = (check: () => void) => {
    const original = process.env.TZ;
    process.env.TZ = timezone;
    try { check(); } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  };

  it.each([
    ['2026-10-11', '2026-10-17', 'Oct 11, 2026', 'Oct 17, 2026'],
    ['2026-03-08', '2026-03-14', 'Mar 8, 2026', 'Mar 14, 2026'],
    ['2026-11-01', '2026-11-07', 'Nov 1, 2026', 'Nov 7, 2026'],
    ['2026-12-27', '2027-01-02', 'Dec 27, 2026', 'Jan 2, 2027'],
  ])('keeps %s through %s identical to the email, including exports and boundary filters', (start, end, startLabel, endLabel) => inTimezone(() => {
    const invoice = { id: 2441, billing_period_start: cast(start), billing_period_end: cast(end), total_amount: 100, items: [] } as unknown as WeeklyInvoice;
    expect(formatBillingPeriod(cast(start), cast(end))).toBe(`${startLabel} - ${endLabel}`);
    expect(buildWeeklyInvoiceExportRows([invoice])[0].week).toBe(`${startLabel} - ${endLabel}`);
    for (const boundary of [start, end]) {
      expect(filterWeeklyInvoicesByDate([invoice], { preset: 'custom', customRange: { startDate: boundary, endDate: boundary } })).toEqual([invoice]);
    }
    const previous = parseInvoiceCalendarDate(start)!;
    previous.setDate(previous.getDate() - 1);
    const next = parseInvoiceCalendarDate(end)!;
    next.setDate(next.getDate() + 1);
    for (const outside of [previous, next]) {
      const day = format(outside, 'yyyy-MM-dd');
      expect(filterWeeklyInvoicesByDate([invoice], { preset: 'custom', customRange: { startDate: day, endDate: day } })).toEqual([]);
    }
  }));

  it('keeps plain dates and offset-serialized calendar fields on the recorded day', () => inTimezone(() => {
    for (const date of ['2026-10-11', cast('2026-10-11'), '2026-10-11T00:00:00+14:00']) {
      expect(formatInvoiceCalendarDate(date)).toBe('Oct 11, 2026');
    }
    expect(formatWeeklyBillingPeriod(cast('2026-10-11'), cast('2026-10-17'))).toBe('Oct 11 – Oct 17, 2026');
    expect(formatWeeklyBillingPeriod(cast('2026-12-27'), cast('2027-01-02'))).toBe('Dec 27, 2026 – Jan 2, 2027');
    expect(formatWeeklyBillingPeriod(cast('2026-10-14'), cast('2026-10-14'))).toBe('Oct 14, 2026');
  }));

  it('continues treating activity and payment timestamps as absolute instants', () => inTimezone(() => {
    const timestamp = cast('2026-10-11');
    expect(parseInvoiceDateInput(timestamp)?.getTime()).toBe(Date.parse(timestamp));
  }));
});

it.each([null, undefined, '', 'not-a-date', '2026-02-30', '2026-13-01'])('rejects invalid invoice calendar date %j', value => {
  expect(parseInvoiceCalendarDate(value)).toBeNull();
  expect(formatInvoiceCalendarDate(value)).toBe('N/A');
});
