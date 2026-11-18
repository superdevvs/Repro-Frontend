import { describe, expect, it } from 'vitest';
import type { WeeklyInvoice } from '@/services/invoiceService';
import { buildReviewQueueExport, formatApprovedDate, getSalesRepCommissionSummary } from './invoiceReviewWorkspaceUtils';

describe('Sales commission review amounts', () => {
  it('preserves a frozen zero rate and zero excluded fees over current item metadata', () => {
    const invoice = {
      total_amount: 0,
      approval_snapshot: { commissionable_gross: 500, commission_rate: 0, excluded_fees_total: 0, excluded_fee_total: 75 },
      items: [{ meta: { commission_rate: 15, commissionable_gross: 900 } }],
    } as unknown as WeeklyInvoice;
    expect(getSalesRepCommissionSummary(invoice)).toEqual({
      commissionableGross: 500, excludedFeeTotal: 0, commissionRate: 0, commissionAmount: 0, isFrozen: true,
    });
  });
  it('does not invent a commission rate when no snapshot or rate metadata exists', () => {
    expect(getSalesRepCommissionSummary({ total_amount: 30, items: [] } as unknown as WeeklyInvoice).commissionRate).toBeNull();
  });
  it('totals current commissionable lines and supports legacy excluded-fee metadata', () => {
    const invoice = { total_amount: 18, items: [
      { meta: { commissionable_gross: 100, excluded_fee_total: 10, commission_rate: 12 } },
      { meta: { commissionable_gross: 50, excluded_fees_total: 5 } },
    ] } as unknown as WeeklyInvoice;
    expect(getSalesRepCommissionSummary(invoice)).toMatchObject({ commissionableGross: 150, excludedFeeTotal: 15, commissionRate: 12, isFrozen: false });
  });
});

const approved = {
  id: 7, photographer: { id: 11, name: 'Alice', email: 'alice@example.com' }, approval_status: 'accounts_approved', total_amount: 100,
  billing_period_start: '2026-11-01', billing_period_end: '2026-11-07',
  // Submitted on the 9th, approved on the 12th: the export must show the 12th.
  modified_at: '2026-11-09T15:00:00.000Z', last_activity_at: '2026-11-09T15:00:00.000Z',
  approved_at: '2026-11-12T15:00:00.000Z', approvedBy: { id: 3, name: 'Accounts Admin', email: 'accounts@example.com' },
} as unknown as WeeklyInvoice;
const waiting = { ...approved, id: 8, approval_status: 'pending_approval', approved_at: undefined, approvedBy: null } as unknown as WeeklyInvoice;

describe('payout review queue export', () => {
  it('shows the calendar day accounts approved the invoice, and who approved it', () => {
    const { columns, rows } = buildReviewQueueExport([approved, waiting], 'photographer', 'Photographer');
    expect(columns.map((column) => column.label)).toEqual(expect.arrayContaining(['Approved On', 'Approved By', 'Last Updated']));
    expect(rows[0]).toMatchObject({ payee: 'Alice', approvedOn: 'Nov 12, 2026', approvedBy: 'Accounts Admin' });
    expect(rows[1]).toMatchObject({ approvedOn: '', approvedBy: '' });
  });

  it('leaves the approval date blank for missing or invalid values', () => {
    expect(formatApprovedDate(null)).toBe('');
    expect(formatApprovedDate('not-a-date')).toBe('');
  });
});
