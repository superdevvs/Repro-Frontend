import { describe, expect, it } from 'vitest';

import { normalizeReportingWeekRange } from './reportingWeek';

describe('normalizeReportingWeekRange', () => {
  it('expands dates inside one week to Sunday through Saturday', () => {
    expect(normalizeReportingWeekRange({
      startDate: '2026-08-31',
      endDate: '2026-09-02',
    })).toEqual({
      startDate: '2026-08-30',
      endDate: '2026-09-05',
    });
  });

  it('expands multi-week selections to full outer weeks', () => {
    expect(normalizeReportingWeekRange({
      startDate: '2026-08-31',
      endDate: '2026-09-09',
    })).toEqual({
      startDate: '2026-08-30',
      endDate: '2026-09-12',
    });
  });

  it('turns a single selected date into its complete reporting week', () => {
    expect(normalizeReportingWeekRange({ startDate: '2026-08-31', endDate: '' })).toEqual({
      startDate: '2026-08-30',
      endDate: '2026-09-05',
    });
  });

  it('keeps an empty filter empty so the server can use the last completed week', () => {
    expect(normalizeReportingWeekRange({ startDate: '', endDate: '' })).toEqual({
      startDate: '',
      endDate: '',
    });
  });
});
