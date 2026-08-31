import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';

import {
  filterInvoiceItemsByDate,
  matchesInvoiceDateFilter,
  parseInvoiceDateInput,
  resolveInvoiceDateFilterRange,
  type InvoiceDateFilter,
} from './invoiceDateFilters';

const REFERENCE_DATE = new Date(2026, 7, 31, 14, 30, 45, 123);

const printableRange = (filter: InvoiceDateFilter) => {
  const range = resolveInvoiceDateFilterRange(filter, REFERENCE_DATE);
  const print = (date: Date | null) => date ? format(date, 'yyyy-MM-dd HH:mm:ss.SSS') : null;
  return { start: print(range.start), end: print(range.end) };
};

describe('parseInvoiceDateInput', () => {
  it('keeps a date-only value on its local calendar day', () => {
    const parsed = parseInvoiceDateInput('2026-08-31');

    expect(parsed).not.toBeNull();
    expect(parsed && [parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate()]).toEqual([
      2026,
      8,
      31,
    ]);
  });

  it('does not shift a date-only value to the prior day in a western timezone', () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';

    try {
      // This assertion proves the test is exercising the UTC-date parsing trap
      // that previously made an Aug 31 invoice display as Aug 30 in US zones.
      expect(format(new Date('2026-08-31'), 'yyyy-MM-dd')).toBe('2026-08-30');

      const parsed = parseInvoiceDateInput('2026-08-31');
      expect(parsed && format(parsed, 'yyyy-MM-dd HH:mm')).toBe('2026-08-31 00:00');
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });
});

describe('resolveInvoiceDateFilterRange', () => {
  it.each([
    ['day', '2026-08-31 00:00:00.000', '2026-08-31 23:59:59.999'],
    ['week', '2026-08-30 00:00:00.000', '2026-09-05 23:59:59.999'],
    ['month', '2026-08-01 00:00:00.000', '2026-08-31 23:59:59.999'],
    ['quarter', '2026-07-01 00:00:00.000', '2026-09-30 23:59:59.999'],
    ['year', '2026-01-01 00:00:00.000', '2026-12-31 23:59:59.999'],
  ] as const)('resolves the %s preset to inclusive calendar boundaries', (preset, start, end) => {
    expect(printableRange({ preset })).toEqual({ start, end });
  });

  it('uses Sunday through Saturday for the week preset', () => {
    expect(printableRange({ preset: 'week' })).toEqual({
      start: '2026-08-30 00:00:00.000',
      end: '2026-09-05 23:59:59.999',
    });
  });

  it('normalizes a reversed custom range and includes both complete days', () => {
    expect(printableRange({
      preset: 'custom',
      customRange: { startDate: '2026-09-02', endDate: '2026-08-30' },
    })).toEqual({
      start: '2026-08-30 00:00:00.000',
      end: '2026-09-02 23:59:59.999',
    });
  });

  it('treats one selected custom date as a full single-day range', () => {
    expect(printableRange({
      preset: 'custom',
      customRange: { startDate: '2026-08-27', endDate: '' },
    })).toEqual({
      start: '2026-08-27 00:00:00.000',
      end: '2026-08-27 23:59:59.999',
    });
  });

  it('leaves All and an empty custom selection unbounded', () => {
    expect(printableRange({ preset: 'all' })).toEqual({ start: null, end: null });
    expect(printableRange({
      preset: 'custom',
      customRange: { startDate: '', endDate: '' },
    })).toEqual({ start: null, end: null });
  });
});

describe('matchesInvoiceDateFilter', () => {
  const filter: InvoiceDateFilter = {
    preset: 'custom',
    customRange: { startDate: '2026-08-10', endDate: '2026-08-12' },
  };

  it('includes point dates on both outer boundaries', () => {
    expect(matchesInvoiceDateFilter(new Date(2026, 7, 10, 0, 0, 0, 0), filter)).toBe(true);
    expect(matchesInvoiceDateFilter(new Date(2026, 7, 12, 23, 59, 59, 999), filter)).toBe(true);
    expect(matchesInvoiceDateFilter(new Date(2026, 7, 13, 0, 0, 0, 0), filter)).toBe(false);
  });

  it('uses inclusive overlap semantics for invoice periods', () => {
    expect(matchesInvoiceDateFilter({
      startDate: '2026-08-01',
      endDate: '2026-08-10',
    }, filter)).toBe(true);
    expect(matchesInvoiceDateFilter({
      startDate: '2026-08-12T23:59:59.999',
      endDate: '2026-08-20',
    }, filter)).toBe(true);
    expect(matchesInvoiceDateFilter({
      startDate: '2026-08-01',
      endDate: '2026-08-09T23:59:59.999',
    }, filter)).toBe(false);
    expect(matchesInvoiceDateFilter({
      startDate: '2026-08-13',
      endDate: '2026-08-20',
    }, filter)).toBe(false);
  });

  it('matches a reversed invoice period after ordering its boundaries', () => {
    expect(matchesInvoiceDateFilter({
      startDate: '2026-08-15',
      endDate: '2026-08-11',
    }, filter)).toBe(true);
  });

  it('lets All retain records with missing or invalid dates', () => {
    expect(matchesInvoiceDateFilter(null, { preset: 'all' }, REFERENCE_DATE)).toBe(true);
    expect(matchesInvoiceDateFilter('not-a-date', { preset: 'all' }, REFERENCE_DATE)).toBe(true);
  });

  it('uses the injected reference date instead of the system clock', () => {
    expect(matchesInvoiceDateFilter('2026-08-31', { preset: 'day' }, REFERENCE_DATE)).toBe(true);
    expect(matchesInvoiceDateFilter('2026-08-30', { preset: 'day' }, REFERENCE_DATE)).toBe(false);
  });
});

describe('filterInvoiceItemsByDate', () => {
  it('filters point-date invoice rows through a selector', () => {
    const invoices = [
      { id: 1, issuedAt: '2026-08-01' },
      { id: 2, issuedAt: '2026-08-31T23:59:59.999' },
      { id: 3, issuedAt: '2026-09-01' },
      { id: 4, issuedAt: null },
    ];

    expect(filterInvoiceItemsByDate(
      invoices,
      { preset: 'month' },
      (invoice) => invoice.issuedAt,
      REFERENCE_DATE,
    ).map((invoice) => invoice.id)).toEqual([1, 2]);
  });

  it('filters period-based billing rows by overlap', () => {
    const billingPeriods = [
      { id: 'before', starts: '2026-08-01', ends: '2026-08-09' },
      { id: 'overlaps-start', starts: '2026-08-09', ends: '2026-08-10' },
      { id: 'inside', starts: '2026-08-11', ends: '2026-08-12' },
      { id: 'spans', starts: '2026-08-01', ends: '2026-08-31' },
      { id: 'after', starts: '2026-08-13', ends: '2026-08-20' },
    ];

    expect(filterInvoiceItemsByDate(
      billingPeriods,
      {
        preset: 'custom',
        customRange: { startDate: '2026-08-10', endDate: '2026-08-12' },
      },
      (period) => ({ startDate: period.starts, endDate: period.ends }),
      REFERENCE_DATE,
    ).map((period) => period.id)).toEqual(['overlaps-start', 'inside', 'spans']);
  });
});
