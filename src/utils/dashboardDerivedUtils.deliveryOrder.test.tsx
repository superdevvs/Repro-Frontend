import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from '@/context/shootNormalization';
import { useDashboardDerivedData } from '@/hooks/useDashboardDerivedData';
import type { DashboardShootSummary } from '@/types/dashboard';
import { selectLatestDeliveries } from '@/features/dashboard/latestDeliveries';
import { filterDeliveredShoots, shootDataToSummary, sortByDeliveryDesc } from './dashboardDerivedUtils';

const summary = (id: number, startTime: string, deliveredAt?: string | null) => ({
  id, startTime, deliveredAt, status: 'delivered', workflowStatus: 'delivered',
} as DashboardShootSummary);

describe('delivered dashboard ordering', () => {
  it.each(['admin', 'superadmin', 'editing_manager', 'salesRep', 'photographer', 'editor', 'client'])(
    'puts an old shoot delivered today ahead of newer appointments for %s', (role) => {
      const newest = summary(1, '2026-10-12T10:00:00Z', '2026-10-19T12:00:00Z');
      const previous = summary(2, '2026-10-18T10:00:00Z', '2026-10-18T12:00:00Z');
      expect(filterDeliveredShoots([previous, newest], role).map(shoot => shoot.id)).toEqual([1, 2]);
    },
  );

  it('retains appointment order for matching delivery times and missing legacy timestamps', () => {
    const records = [
      summary(1, '2026-10-12T10:00:00Z', '2026-10-19T12:00:00Z'),
      summary(2, '2026-10-18T10:00:00Z', '2026-10-19T12:00:00Z'),
      summary(3, '2026-10-11T10:00:00Z'),
      summary(4, '2026-10-13T10:00:00Z', 'invalid'),
    ];
    expect([...records].sort(sortByDeliveryDesc).map(shoot => shoot.id)).toEqual([2, 1, 4, 3]);
    expect(records.map(shoot => shoot.id)).toEqual([1, 2, 3, 4]);
  });

  it('applies delivery order before the admin dashboard card limit', () => {
    const older = Array.from({ length: 8 }, (_, index) => summary(index + 2, '2026-10-18T10:00:00Z', '2026-10-18T12:00:00Z'));
    const recent = summary(1, '2026-10-12T10:00:00Z', '2026-10-19T12:00:00Z');
    expect(selectLatestDeliveries([...older, recent])).toHaveLength(6);
    expect(selectLatestDeliveries([...older, recent])[0].id).toBe(1);
  });

  it('preserves the delivery timestamp through normalization for client and staff dashboards', () => {
    const shoot = transformShootFromApi({
      id: 1, status: 'delivered', workflow_status: 'delivered',
      scheduled_date: '2026-10-12', time: '10:00',
      editing_completed_at: '2026-10-13T12:00:00Z',
      admin_verified_at: '2026-10-19T12:00:00Z',
      client: { id: 7, name: 'Test Client', email: 'client@example.test' },
    });
    expect(shootDataToSummary(shoot).deliveredAt).toBe('2026-10-19T12:00:00Z');
    const other = transformShootFromApi({
      id: 2, status: 'delivered', workflow_status: 'delivered',
      scheduled_date: '2026-10-18', time: '10:00', completed_at: '2026-10-18T12:00:00Z',
      client: { id: 7, name: 'Test Client', email: 'client@example.test' },
    });
    const { result } = renderHook(() => useDashboardDerivedData({
      shoots: [other, shoot], role: 'client',
      user: { id: '7', name: 'Test Client', email: 'client@example.test', role: 'client' },
    }));
    expect(result.current.clientCompletedRecords.map(record => record.summary.id)).toEqual([1, 2]);
  });
});
