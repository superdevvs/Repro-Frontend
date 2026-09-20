export type PayoutReportRole = 'all' | 'photographer' | 'salesRep' | 'editor';

export type PayoutReportGroup = 'photographer' | 'editor' | 'salesRep';

/** A photographer-only report should not spend mobile space on empty editor/rep cards. */
export function shouldShowPayoutGroup(
  role: PayoutReportRole,
  group: PayoutReportGroup,
): boolean {
  return role === 'all' || role === group;
}
