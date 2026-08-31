import { describe, expect, it, vi } from 'vitest';

import type { WeeklyInvoice } from '@/services/invoiceService';
import {
  fetchAllWeeklyInvoicePages,
  filterWeeklyInvoicesByDate,
  getWeeklyInvoiceExportScope,
  normalizeWeeklyInvoiceRole,
} from './weeklyInvoiceReviewUtils';

const makeInvoice = (
  id: number,
  start: string,
  end: string,
  overrides: Partial<WeeklyInvoice> = {},
): WeeklyInvoice => ({
  id,
  billing_period_start: start,
  billing_period_end: end,
  total_amount: 100,
  amount_paid: 0,
  status: 'sent',
  approval_status: 'pending',
  created_at: start,
  items: [],
  ...overrides,
});

describe('normalizeWeeklyInvoiceRole', () => {
  it.each([
    'salesRep',
    'sales_rep',
    'sales-rep',
    'sales rep',
    'salesrep',
    'Sales Representative',
    'sales_representative',
    'rep',
    'representative',
  ])('normalizes sales-rep alias %j', (role) => {
    expect(normalizeWeeklyInvoiceRole(role)).toBe('salesRep');
  });

  it('uses the photographer invoice surface for non-sales roles', () => {
    expect(normalizeWeeklyInvoiceRole('photographer')).toBe('photographer');
    expect(normalizeWeeklyInvoiceRole('admin')).toBe('photographer');
  });
});

describe('fetchAllWeeklyInvoicePages', () => {
  it('continues through every declared API page', async () => {
    const fetchPage = vi.fn(async ({ page = 1 }: { page?: number; per_page?: number }) => ({
      data: page === 1
        ? [makeInvoice(1, '2026-08-01', '2026-08-07'), makeInvoice(2, '2026-08-08', '2026-08-14')]
        : page === 2
          ? [makeInvoice(3, '2026-08-15', '2026-08-21'), makeInvoice(4, '2026-08-22', '2026-08-28')]
          : [makeInvoice(5, '2026-08-29', '2026-09-04')],
      current_page: page,
      last_page: 3,
      total: 5,
    }));

    const result = await fetchAllWeeklyInvoicePages(fetchPage, 2);

    expect(fetchPage.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 3]);
    expect(result.map((invoice) => invoice.id)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('weekly invoice filtering and export scope', () => {
  const invoices = [
    makeInvoice(1, '2026-08-23', '2026-08-29'),
    makeInvoice(2, '2026-08-30', '2026-09-05'),
  ];

  it('uses inclusive period overlap for custom date filters', () => {
    const result = filterWeeklyInvoicesByDate(invoices, {
      preset: 'custom',
      customRange: { startDate: '2026-08-29', endDate: '2026-08-30' },
    });

    expect(result.map((invoice) => invoice.id)).toEqual([1, 2]);
  });

  it('exports matching selections, or every filtered invoice without a selection', () => {
    expect(getWeeklyInvoiceExportScope(invoices, new Set([2])).map(({ id }) => id)).toEqual([2]);
    expect(getWeeklyInvoiceExportScope(invoices, new Set()).map(({ id }) => id)).toEqual([1, 2]);
    expect(getWeeklyInvoiceExportScope(invoices, new Set([999])).map(({ id }) => id)).toEqual([1, 2]);
  });
});
