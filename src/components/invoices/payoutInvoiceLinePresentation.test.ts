import { describe, expect, it } from 'vitest';
import type { WeeklyInvoice, WeeklyInvoiceItem } from '@/services/invoiceService';
import { payoutInvoiceLines } from './payoutInvoiceLinePresentation';

const line = (id: number, overrides: Partial<WeeklyInvoiceItem> = {}): WeeklyInvoiceItem => ({
  id, invoice_id: 686, type: 'charge', description: `Shoot #${id} - HDR Photos`,
  shoot_id: id, quantity: 1, unit_amount: 78.75, total_amount: 78.75, ...overrides,
});
const invoice = (items: WeeklyInvoiceItem[], shoots: WeeklyInvoice['shoots'] = []): WeeklyInvoice => ({
  id: 686, billing_period_start: '2026-09-27', billing_period_end: '2026-10-03',
  total_amount: 1393.65, amount_paid: 0, status: 'draft', approval_status: 'pending',
  created_at: '2026-10-07', items, shoots,
});

describe('payout invoice line presentation', () => {
  it('sorts by shoot date newest first, not completion, creation, ID or input order', () => {
    const original = invoice([line(134, { recorded_at: '2026-10-07' }), line(145), line(160)], [
      { id: 134, scheduled_date: '2026-09-27T00:00:00.000000Z', completed_at: '2026-10-07' },
      { id: 145, scheduled_date: '2026-10-03T00:00:00.000000Z', completed_at: '2026-10-04' },
      { id: 160, scheduled_date: '2026-09-29', completed_at: '2026-10-05' },
    ]);
    expect(payoutInvoiceLines(original).map(row => row.item.id)).toEqual([145, 160, 134]);
    expect(payoutInvoiceLines(original)[0].dateLabel).toBe('Oct 3, 2026');
    expect(original.items?.map(item => item.id)).toEqual([134, 145, 160]);
    expect(original.total_amount).toBe(1393.65);
  });

  it('uses external work dates, snapshot dates and recorded dates, with missing/invalid dates last', () => {
    const original = invoice([
      line(1, { recorded_at: 'invalid' }),
      line(2, { shoot_id: undefined, meta: { source: 'external_work', work_date: '2026-09-27' }, recorded_at: '2026-10-07' }),
      line(3, { meta: { scheduled_date: '2026-10-01' }, recorded_at: '2026-10-07' }),
      line(4, { type: 'expense', recorded_at: '2026-09-30 12:00:00' }),
      line(5, { meta: { work_date: '2026-02-30' } }),
    ]);
    expect(payoutInvoiceLines(original).map(row => row.item.id)).toEqual([3, 4, 2, 1, 5]);
    expect(payoutInvoiceLines(original).at(-1)?.dateLabel).toBe('Date unavailable');
  });

  it('keeps same-day services together in their original order', () => {
    expect(payoutInvoiceLines(invoice([line(2), line(1)], [{ id: 1, scheduled_date: '2026-10-03' }, { id: 2, scheduled_date: '2026-10-03' }])).map(row => row.item.id)).toEqual([2, 1]);
  });

  it('never substitutes completion for a missing shoot date', () => {
    expect(payoutInvoiceLines(invoice([line(1, { recorded_at: '2026-10-04' })], [{ id: 1, completed_at: '2026-10-04' }]))[0].dateLabel).toBe('Date unavailable');
    expect(payoutInvoiceLines(invoice([line(2, { meta: { source: 'linked_work' }, recorded_at: '2026-10-04' })]))[0].dateLabel).toBe('Date unavailable');
  });

  it('does not repeat an existing shoot number, but retains it for custom descriptions', () => {
    const result = payoutInvoiceLines(invoice([
      line(134), line(145, { description: 'shoot # 145 - HDR' }),
      line(13, { description: 'Shoot #134 - another reference' }),
      line(160, { description: 'Adjusted HDR service' }),
      line(4, { shoot_id: undefined, description: 'External work' }),
    ]));
    expect(result.map(row => row.showShootNumber)).toEqual([false, false, true, true, false]);
  });
});
