import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import type { ShootData } from '@/types/shoots';
import { formatEditorShortDate } from './editorEarningsUtils';
import { getShootCompletedDate, getShootScheduledDate } from './photographerEarningsUtils';

describe('accounting shoot schedule days', () => {
  it('retains the booked day for editor earnings', () => {
    expect(formatEditorShortDate('2026-09-09T00:00:00Z', true))
      .toBe(new Date(2026, 8, 9).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
  });
  it('retains the booked day for photographer tables and completion-date fallbacks', () => {
    const shoot = { scheduledDate: '2026-09-09T00:00:00Z', status: 'delivered' } as ShootData;
    expect(format(getShootScheduledDate(shoot)!, 'yyyy-MM-dd')).toBe('2026-09-09');
    expect(format(getShootCompletedDate(shoot)!, 'yyyy-MM-dd')).toBe('2026-09-09');
  });
  it('continues to treat actual completion and activity timestamps as instants', () => {
    const completedDate = '2026-09-10T01:00:00Z';
    const shoot = { scheduledDate: '2026-09-09', completedDate, status: 'delivered' } as ShootData;
    expect(getShootCompletedDate(shoot)?.toISOString()).toBe(completedDate.replace('Z', '.000Z'));
    expect(formatEditorShortDate(completedDate)).toBe(new Date(completedDate)
      .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
  });
});
