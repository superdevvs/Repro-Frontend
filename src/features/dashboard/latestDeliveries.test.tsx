import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary, DashboardOverviewResponse } from '@/types/dashboard';
import { transformDashboardOverview } from '@/utils/dashboardTransformers';
import { selectLatestDeliveries } from './latestDeliveries';
import { useWorkflowPipeline } from './hooks/useWorkflowPipeline';

const shoot = (id: number, completedAt: string, overrides: Partial<DashboardShootSummary> = {}) => ({
  id, status: 'delivered', workflowStatus: 'delivered', completedAt,
  startTime: '2026-08-01T12:00:00Z', services: [], paymentStatus: 'paid',
  ...overrides,
}) as DashboardShootSummary;

describe('latest deliveries card', () => {
  it('sorts by original completion, deduplicates, limits to six and excludes ready work', () => {
    const oldImport = shoot(500, '2026-08-29', { startTime: '2026-09-30' });
    const recent = Array.from({ length: 8 }, (_, i) => shoot(i + 1, `2026-09-${22 + i}`));
    const ready = shoot(700, '2026-10-01', { status: 'ready', workflowStatus: 'ready' });
    expect(selectLatestDeliveries([oldImport, ready, recent[0], ...recent]).map(s => s.id))
      .toEqual([8, 7, 6, 5, 4, 3]);
    expect(oldImport.completedAt).toBe('2026-08-29');
  });

  it('uses the complete server delivery selection rather than the recently updated workflow subset', () => {
    const latest = [shoot(138, '2026-09-30'), shoot(137, '2026-09-29', { paymentStatus: 'unpaid' })];
    const params = { refresh: vi.fn(), toast: vi.fn(), allSummaries: [shoot(409, '2026-09-01')], latestDeliveries: latest };
    const { result, rerender } = renderHook((props) => useWorkflowPipeline(props), { initialProps: params });
    expect(result.current.deliveredShoots.map(s => [s.id, s.paymentStatus])).toEqual([[138, 'paid'], [137, 'unpaid']]);
    rerender({ ...params, latestDeliveries: [] });
    expect(result.current.deliveredShoots).toEqual([]);
  });

  it('preserves the separate delivery feed and completion date through API normalization', () => {
    const response = {
      stats: {}, upcoming_shoots: [], photographers: [], pending_reviews: [], activity_log: [], issues: [], workflow: { columns: [] },
      latest_deliveries: [{ id: 138, status: 'delivered', services: [], completed_at: '2026-09-30T12:56:58Z', payment_status: 'paid' }],
    } as DashboardOverviewResponse;
    const overview = transformDashboardOverview(response);
    expect(overview.latestDeliveries?.[0]).toMatchObject({ id: 138, completedAt: '2026-09-30T12:56:58Z', paymentStatus: 'paid' });
    expect(overview.upcomingShoots).toEqual([]);
  });
});
