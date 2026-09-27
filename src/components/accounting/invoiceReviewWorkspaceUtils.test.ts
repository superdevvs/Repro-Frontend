import { describe, expect, it } from 'vitest';
import type { WeeklyInvoice } from '@/services/invoiceService';
import { getSalesRepCommissionSummary } from './invoiceReviewWorkspaceUtils';

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
