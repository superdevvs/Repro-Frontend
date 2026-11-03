import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharedShootCard } from '@/components/shoots/SharedShootCard';
import { ClientShootTile } from '@/features/dashboard/components/ClientShootTile';
import { ServiceChangeIntentControl } from '@/components/shoots/ServiceChangeIntentControl';
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms';
import { isEditorActiveOperationalShoot } from '@/components/shoots/history/shootHistoryUtils';
import { matchesDashboardStatus } from '@/components/dashboard/v2/dashboardFilterModel';
import { transformShootFromApi } from '@/context/shootNormalization';
import type { UserData } from '@/types/auth';
import type { ShootData } from '@/types/shoots';
import { filterCompletedShoots, filterDeliveredShoots, filterUpcomingShoots, isAssignmentMatch, isClientVisibleCompletedRecord, shootDataToSummary } from './dashboardDerivedUtils';
import { getShootDisplayStatus, getShootOperationalDate, getShootOperationalTime } from './activeShootWork';
import { getShootLocalDate } from './shootLocalDate';

vi.mock('@/contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({ formatTemperature: String, formatTime: String, formatDate: String }),
}));

afterEach(cleanup);

const api = {
  id: 5925, address: '1447 York Road', city: 'Lutherville', state: 'MD', zip: '21093',
  scheduled_date: '2026-11-02', scheduled_at: '2026-11-02T18:30:00Z', time: '13:30',
  timezone: 'America/New_York', status: 'active', workflow_status: 'editing',
  has_active_work: true, display_status: 'active', active_work_at: '2026-11-04T20:45:00Z',
  active_work_date: '2026-11-04', active_work_time: '15:45', active_work_started_at: '2026-11-03T08:20:32Z',
  admin_verified_at: '2026-11-03T08:20:32Z',
};

describe('additional work visibility', () => {
  it('keeps the original appointment while every API normalization path carries the new work date and badge', () => {
    for (const shoot of [transformShootFromApi(api), mapShootApiToShootData(api)]) {
      expect(getShootLocalDate(shoot)).toBe('2026-11-02');
      expect(getShootOperationalDate(shoot)).toBe('2026-11-04');
      expect(getShootOperationalTime(shoot)).toBe('15:45');
      expect(getShootDisplayStatus(shoot)).toBe('active');
      const summary = shootDataToSummary(shoot);
      expect(summary.scheduledLocalDate).toBe('2026-11-04');
      expect(summary.startTime).toBe('2026-11-04T20:45:00.000Z');
      expect(summary.timeLabel).toBe('15:45');
      expect(getShootDisplayStatus(summary)).toBe('active');
      expect(shoot.scheduledDate).toBe('2026-11-02');
    }
  });

  it.each(['admin', 'salesRep', 'photographer', 'editor', 'editing_manager'])(
    'keeps reopened work in the %s working queue and out of delivered work', role => {
      const shoot = mapShootApiToShootData(api);
      const summary = shootDataToSummary(shoot);
      expect(filterUpcomingShoots([summary], role)).toEqual([summary]);
      expect(filterCompletedShoots([summary])).toEqual([summary]);
      expect(filterDeliveredShoots([summary], role)).toEqual([]);
      expect(isEditorActiveOperationalShoot(shoot)).toBe(true);
      expect(matchesDashboardStatus(getShootDisplayStatus(summary), ['active'])).toBe(true);
      expect(matchesDashboardStatus(getShootDisplayStatus(summary), ['editing'])).toBe(false);
    },
  );

  it('matches the outstanding service assignees instead of a previously delivered team', () => {
    const shoot = { ...mapShootApiToShootData(api), photographer: { id: '1', name: 'Earlier photographer' },
      editor: { id: '4', name: 'Earlier editor' }, serviceItems: [
        { service_id: '43', workflow_status: 'delivered', delivery_status: 'delivered', photographer_id: '1', editor_id: '4' },
        { service_id: '2', workflow_status: 'scheduled', delivery_status: 'not_started', photographer_id: '2', editor_id: '3' },
      ] } as ShootData;
    expect(isAssignmentMatch(shoot, { id: '1' } as UserData, 'photographer')).toBe(false);
    expect(isAssignmentMatch(shoot, { id: '2' } as UserData, 'photographer')).toBe(true);
    expect(isAssignmentMatch(shoot, { id: '4' } as UserData, 'editor')).toBe(false);
    expect(isAssignmentMatch(shoot, { id: '3' } as UserData, 'editor')).toBe(true);
  });

  it.each([
    ['pending', 'delivered', true],
    ['delivered', 'not_started', true],
    ['delivered', 'delivered', false],
    ['cancelled', 'not_started', false],
    ['pending', 'cancelled', false],
  ] as const)('keeps Active assignments consistent for workflow=%s, delivery=%s', (workflow, delivery, expected) => {
    const shoot = { ...mapShootApiToShootData(api), serviceItems: [{
      service_id: '2', workflow_status: workflow, delivery_status: delivery,
      photographer_id: '21', editor_id: '31', is_deliverable: true,
    }] } as ShootData;
    expect(isAssignmentMatch(shoot, { id: '21' } as UserData, 'photographer')).toBe(expected);
    expect(isAssignmentMatch(shoot, { id: '31' } as UserData, 'editor')).toBe(expected);
  });

  it('preserves the client delivered-service path while another service is unfinished', () => {
    const shoot = { ...mapShootApiToShootData(api), serviceItems: [
      { service_id: '43', name: 'Drone', is_deliverable: true, delivery_status: 'delivered',
        workflow_status: 'delivered', payment_status: 'paid', force_unlock_delivery: true },
      { service_id: '2', name: 'HDR', is_deliverable: true, delivery_status: 'not_started', workflow_status: 'scheduled' },
    ] } as ShootData;
    expect(isClientVisibleCompletedRecord({ data: shoot, summary: shootDataToSummary(shoot) })).toBe(true);
  });

  it('renders a single Active status instead of the underlying editing stage', () => {
    const shoot = mapShootApiToShootData(api);
    render(<SharedShootCard shoot={shoot} role="admin" hideHeroImage />);
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.queryByText('Editing')).toBeNull();
    expect(screen.getByText('2026-11-04')).not.toBeNull();
    expect(screen.queryByText('2026-11-02')).toBeNull();
  });

  it('keeps delivered client media visible with a single Active badge', () => {
    const data = mapShootApiToShootData(api);
    const noop = vi.fn();
    render(<ClientShootTile record={{ data, summary: shootDataToSummary(data) }} variant="completed"
      onSelect={noop} onReschedule={noop} onCancel={noop} onContactSupport={noop}
      onDownload={noop} onRebook={noop} onRequestRevision={noop} onHoldAction={noop} />);
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.queryByText('Delivered')).toBeNull();
    expect(screen.getByText(/2026-11-04/)).not.toBeNull();
  });

  it('respects a suspended active cycle instead of inferring Active from its history', () => {
    const shoot = mapShootApiToShootData({ ...api, status: 'on_hold', workflow_status: 'on_hold',
      has_active_work: false, display_status: 'on_hold' });
    expect(getShootDisplayStatus(shoot)).toBe('on_hold');
    expect(getShootOperationalDate(shoot)).toBe('2026-11-02');
  });

  it('uses activation time in the property timezone when new work has no schedule', () => {
    const shoot = { ...mapShootApiToShootData(api), activeWorkAt: null, activeWorkDate: null, activeWorkTime: null,
      activeWorkStartedAt: '2026-11-06T01:30:00Z' };
    expect(getShootOperationalDate(shoot)).toBe('2026-11-05');
    expect(getShootOperationalTime(shoot)).toBe('');
  });

  it('returns to the original delivery display after the additional-work cycle closes', () => {
    const shoot = mapShootApiToShootData({ ...api, status: 'delivered', workflow_status: 'delivered',
      has_active_work: false, display_status: 'delivered', active_work_completed_at: '2026-11-05T12:00:00Z' });
    expect(getShootDisplayStatus(shoot)).toBe('delivered');
    expect(getShootOperationalDate(shoot)).toBe('2026-11-02');
    expect(filterDeliveredShoots([shootDataToSummary(shoot)], 'admin')).toHaveLength(1);
  });

  it('orders newly completed additional work by its latest completion without replacing the first delivery', () => {
    const earlierOriginal = shootDataToSummary(mapShootApiToShootData({ ...api, status: 'delivered', workflow_status: 'delivered',
      has_active_work: false, display_status: 'delivered', active_work_completed_at: '2026-11-08T12:00:00Z' }));
    const laterOriginal = { ...earlierOriginal, id: 99, activeWorkCompletedAt: null, deliveredAt: '2026-11-07T12:00:00Z' };
    expect(filterDeliveredShoots([laterOriginal, earlierOriginal], 'admin').map(shoot => shoot.id)).toEqual([5925, 99]);
    expect(earlierOriginal.deliveredAt).not.toBe('2026-11-08T12:00:00Z');
  });

  it('lets the user explicitly classify an added service as billing only', () => {
    const onChange = vi.fn();
    render(<ServiceChangeIntentControl value="new_work" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Added services'), { target: { value: 'billing_correction' } });
    expect(onChange).toHaveBeenCalledWith('billing_correction');
  });
});
