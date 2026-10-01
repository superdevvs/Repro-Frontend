import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import type { ShootData } from '@/types/shoots';
import type { UserData } from '@/types/auth';
import { useDashboardDerivedData } from '@/hooks/useDashboardDerivedData';
import { filterDeliveredShoots, filterUpcomingShoots } from './dashboardDerivedUtils';

afterEach(cleanup);

const summary = (status: string, overrides: Partial<DashboardShootSummary> = {}) => ({
  id: 1, scheduledLocalDate: '2026-09-30', startTime: '2026-09-30T14:00:00Z',
  workflowStatus: status, status, paymentStatus: 'paid', ...overrides,
}) as DashboardShootSummary;

describe('staff unfinished dashboard flow', () => {
  it.each(['photographer', 'editor', 'salesRep', 'sales_rep'])(
    'retains ready, review and legacy uploaded work for %s until actual delivery', (role) => {
      const items = ['ready', 'ready_for_review', 'pending_review', 'completed', 'editing', 'delivered', 'finalized', 'ready_for_client', 'admin_verified', 'delivered_to_client', 'requested', 'cancelled', 'declined', 'archived']
        .map((status, index) => summary(status, { id: index + 1 }));
      expect(filterUpcomingShoots(items, role).map((shoot) => shoot.workflowStatus))
        .toEqual(['ready', 'ready_for_review', 'pending_review', 'completed', 'editing']);
      expect(filterDeliveredShoots(items, role).map((shoot) => shoot.workflowStatus))
        .toEqual(['delivered', 'finalized', 'ready_for_client', 'admin_verified', 'delivered_to_client']);
    },
  );

  it.each(['delivered', 'client_delivered', 'delivered_to_client', 'workflow_completed', 'ready_for_client', 'admin_verified', 'finalized'])('keeps remaining editor work active after whole-shoot status %s', (status) => {
    const partial = summary(status, { hasPendingEditorWork: true });
    expect(filterUpcomingShoots([partial], 'editor')).toEqual([partial]);
    expect(filterDeliveredShoots([partial], 'editor')).toEqual([]);
    expect(filterUpcomingShoots([partial], 'photographer')).toEqual([]);
  });

  it('preserves the existing client payment/delivery filtering', () => {
    const paidReady = summary('ready');
    const unpaidDelivered = summary('delivered', { id: 2, paymentStatus: 'unpaid' });
    expect(filterUpcomingShoots([paidReady, unpaidDelivered], 'client')).toEqual([unpaidDelivered]);
  });

  it.each(['photographer', 'salesRep'])(
    'passes past ready work through the %s derived queue and excludes it from completed cards', (role) => {
      const shoots = ['ready', 'delivered'].map((status, index) => ({
        id: String(index + 1), status, workflowStatus: status, scheduledDate: '2026-09-30',
        time: '10:00 AM', location: { address: '118 Cedar Grove Lane', city: 'Columbia', state: 'MD', zip: '21044' },
        services: [], client: { id: '9', name: 'Client' }, photographer: { id: '7', name: 'Photographer' },
      }) as ShootData);
      const { result } = renderHook(() => useDashboardDerivedData({ shoots, role, user: { id: '7' } as UserData }));
      const upcoming = role === 'photographer' ? result.current.photographerUpcoming : result.current.repUpcoming;
      const delivered = role === 'photographer' ? result.current.photographerDelivered : result.current.repDelivered;
      expect(upcoming.map((shoot) => shoot.id)).toEqual([1]);
      expect(delivered.map((shoot) => shoot.id)).toEqual([2]);
    },
  );
});
