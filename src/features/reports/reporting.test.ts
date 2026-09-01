import { describe, expect, it } from 'vitest';

import type { InvoiceData } from '@/types/invoice';
import {
  buildPeriodRows,
  buildPhotographerRows,
  buildReportCsv,
  buildServiceRows,
  getReportRange,
  type ReportShootRecord,
} from './reporting';

const makeInvoice = (overrides: Partial<InvoiceData> = {}): InvoiceData => ({
  id: 'invoice-1',
  number: 'INV-1',
  client: 'Client',
  property: '1 Main St',
  date: '2026-01-15',
  dueDate: '2026-02-15',
  amount: 100,
  amountPaid: 100,
  status: 'paid',
  services: [],
  paymentMethod: 'card',
  role: 'client',
  ...overrides,
});

const makeShoot = (overrides: Partial<ReportShootRecord> = {}): ReportShootRecord => ({
  id: 1,
  scheduledDate: '2026-01-20',
  status: 'delivered',
  client: { id: 10, name: 'Client' },
  address: { street: '1 Main St', city: 'Miami', state: 'FL', zip: '33101', full: '1 Main St, Miami, FL 33101' },
  photographer: { id: 20, name: 'Alex Photo' },
  services: ['HDR Photos'],
  financials: {
    baseQuote: 100,
    taxPercent: 0,
    taxAmount: 0,
    totalQuote: 100,
    totalPaid: 100,
  },
  tourPurchased: false,
  notes: {},
  ...overrides,
});

describe('reporting', () => {
  it('builds calendar ranges for the selected timeframe', () => {
    const now = new Date(2026, 8, 1);

    expect(getReportRange('monthly', now)).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
      label: '2026',
    });
    expect(getReportRange('yearly', now)).toEqual({
      start: '2022-01-01',
      end: '2026-12-31',
      label: '2022–2026',
    });
  });

  it('aggregates collected client revenue and shoots without counting payout invoices', () => {
    const invoices = [
      makeInvoice({ id: 'client-paid', amountPaid: 75 }),
      makeInvoice({ id: 'legacy-paid', date: '2026-02-10', amount: 50, amountPaid: 0, status: 'paid' }),
      makeInvoice({ id: 'partial', date: '2026-02-11', amount: 80, amountPaid: 20, status: 'pending' }),
      makeInvoice({ id: 'payout', role: 'photographer', amountPaid: 500 }),
    ];
    const shoots = [
      makeShoot(),
      makeShoot({ id: 2, scheduledDate: '2026-03-03' }),
    ];

    const rows = buildPeriodRows(invoices, shoots, 'monthly', new Date(2026, 8, 1));

    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ period: 'Jan', revenue: 75, shoots: 1 });
    expect(rows[1]).toEqual({ period: 'Feb', revenue: 70, shoots: 0 });
    expect(rows[2]).toEqual({ period: 'Mar', revenue: 0, shoots: 1 });
  });

  it('uses per-service photographer assignments and payment allocations', () => {
    const shoot = makeShoot({
      serviceItems: [
        {
          name: 'HDR Photos',
          paidAmount: 80,
          resolvedPhotographer: { id: 20, name: 'Alex Photo' },
        },
        {
          name: 'Drone',
          paid_amount: 120,
          resolved_photographer: { id: 21, name: 'Dana Drone' },
        },
      ],
      financials: {
        baseQuote: 200,
        taxPercent: 0,
        taxAmount: 0,
        totalQuote: 200,
        totalPaid: 200,
      },
    });

    expect(buildPhotographerRows([shoot])).toEqual([
      { name: 'Dana Drone', revenue: 120, shoots: 1 },
      { name: 'Alex Photo', revenue: 80, shoots: 1 },
    ]);
    expect(buildServiceRows([shoot])).toEqual([
      { name: 'Drone', revenue: 120, shoots: 1 },
      { name: 'HDR Photos', revenue: 80, shoots: 1 },
    ]);
  });

  it('exports the selected rows as safe, escaped CSV', () => {
    const csv = buildReportCsv(
      'photographer',
      [],
      [{ name: '=HYPERLINK("bad")', revenue: 125.5, shoots: 2 }],
      [],
    );

    expect(csv).toContain('Photographer,Shoots,Collected Revenue');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")",2,125.50');
  });
});
