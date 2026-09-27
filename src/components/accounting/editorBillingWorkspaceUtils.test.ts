import { describe, expect, it } from 'vitest';
import type { EditorEarningsLineItem } from '@/services/invoiceService';
import { filterEditorLedger, groupEditorPayouts, resolveEditorEarning, summarizeEditorRecordedEarnings } from './editorBillingWorkspaceUtils';

const line = (overrides: Partial<EditorEarningsLineItem> = {}): EditorEarningsLineItem => ({ id: 1, shoot_id: 10, service_id: 4, service_name: 'Photo editing', quantity_snapshot: 5, rate_snapshot: 2, payout_amount: 10, completed_at: '2026-09-12T12:00:00Z', is_paid: false, ...overrides });
const rates = [{ service_id: 4, service_name: 'Photo editing', rate: 9 }];

describe('editor billing snapshot and reporting scope', () => {
  it('never reprices saved rate/payout snapshots when rates change', () => {
    expect(resolveEditorEarning(line(), rates)).toEqual({ rate: 2, payout: 10, isFallback: false });
    expect(resolveEditorEarning(line({ payout_amount: 0 }), rates)).toEqual({ rate: 2, payout: 0, isFallback: false });
    expect(resolveEditorEarning(line({ rate_snapshot: 0 }), rates)).toEqual({ rate: 0, payout: 10, isFallback: false });
    expect(resolveEditorEarning(line({ is_paid: true, rate_snapshot: 0, payout_amount: 0 }), rates)).toEqual({ rate: 0, payout: 0, isFallback: false });
  });
  it('labels missing snapshots as estimates and excludes estimates from recorded totals', () => {
    const missing = line({ id: 2, shoot_id: 11, rate_snapshot: 0, payout_amount: 0 });
    expect(resolveEditorEarning(missing, rates)).toEqual({ rate: 9, payout: 45, isFallback: true });
    expect(summarizeEditorRecordedEarnings([line(), missing])).toEqual({ recorded: 10, unpaid: 10, shoots: 2, average: 5 });
    expect(resolveEditorEarning(missing, [])).toEqual({ rate: 0, payout: 0, isFallback: false });
  });
  it('uses completion dates for earnings and recorded payment dates for history', () => {
    const paid = line({ is_paid: true, completed_at: '2026-08-30T12:00:00Z', paid_at: '2026-09-15T12:00:00Z', payout_batch_id: 'batch-9' });
    expect(filterEditorLedger([paid], { start: '2026-09-01', end: '2026-09-30' })).toEqual([]);
    expect(groupEditorPayouts([paid], '2026-09-01', '2026-09-30')).toEqual([{ id: 'batch-9', paidAt: paid.paid_at, amount: 10, items: [paid] }]);
  });
  it('does not merge unrelated legacy payments without batch identifiers', () => {
    const one = line({ is_paid: true, paid_at: '2026-09-15T12:00:00Z' }), two = line({ id: 2, is_paid: true, paid_at: '2026-09-15T12:00:00Z' });
    expect(groupEditorPayouts([one, two])).toHaveLength(2);
  });
  it('applies status, exact service, and search filters without changing source records', () => {
    const rows = [line({ client: { id: 5, name: 'Northstar', email: 'northstar@example.test' } }), line({ id: 2, is_paid: true, service_name: 'Video editing' })];
    expect(filterEditorLedger(rows, { status: 'unpaid', service: 'Photo editing', search: 'north' }).map((item) => item.id)).toEqual([1]);
    expect(rows).toHaveLength(2);
    expect(filterEditorLedger(rows, { start: '2026-09-30', end: '2026-09-01' })).toEqual([]);
  });
});
