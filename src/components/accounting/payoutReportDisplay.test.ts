import { describe, expect, it } from 'vitest';

import { shouldShowPayoutGroup } from './payoutReportDisplay';

describe('shouldShowPayoutGroup', () => {
  it('shows every group on the combined report', () => {
    expect(shouldShowPayoutGroup('all', 'photographer')).toBe(true);
    expect(shouldShowPayoutGroup('all', 'editor')).toBe(true);
    expect(shouldShowPayoutGroup('all', 'salesRep')).toBe(true);
  });

  it('keeps photographer accounting limited to photographer totals', () => {
    expect(shouldShowPayoutGroup('photographer', 'photographer')).toBe(true);
    expect(shouldShowPayoutGroup('photographer', 'editor')).toBe(false);
    expect(shouldShowPayoutGroup('photographer', 'salesRep')).toBe(false);
  });
});
