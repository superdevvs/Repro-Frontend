import type { PayoutReport, PayoutSummary } from '@/services/invoiceService';

export type PayoutReportRole = 'all' | 'photographer' | 'salesRep' | 'editor';

export type PayoutReportGroup = 'photographer' | 'editor' | 'salesRep';

/** A photographer-only report should not spend mobile space on empty editor/rep cards. */
export function shouldShowPayoutGroup(
  role: PayoutReportRole,
  group: PayoutReportGroup,
): boolean {
  return role === 'all' || role === group;
}

export interface PayoutReportRow extends PayoutSummary {
  key: string;
  group: PayoutReportGroup;
  payout: number;
}

export function getPayoutReportRows(report: PayoutReport | null, role: PayoutReportRole): PayoutReportRow[] {
  if (!report) return [];
  const groups: Array<[PayoutReportGroup, PayoutSummary[]]> = [
    ['photographer', report.photographers], ['editor', report.editors], ['salesRep', report.sales_reps],
  ];
  return groups.flatMap(([group, entries]) => shouldShowPayoutGroup(role, group)
    ? entries.map((entry) => ({
      ...entry, key: `${group}:${entry.id}`, group,
      payout: Number(group === 'salesRep' ? entry.commission_total ?? 0 : entry.gross_total),
    })) : []);
}
