import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { ShootActionRequestBadges, ShootActionRequestBanner } from './ShootActionRequests';
import { mapShootApiToShootData } from './history/shootHistoryTransforms';
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils';
import { transformDashboardOverview } from '@/utils/dashboardTransformers';
import { getPendingShootActionRequests, normalizeShootActionRequests } from '@/utils/shootActionRequests';
import { transformShootFromApi } from '@/context/shootNormalization';
import { buildPipelineWorkflow } from '@/features/dashboard/pipelineWorkflow';
import { CalendarShootButton } from './history/calendar/CalendarShootCards';
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext';

const request = {
  id: 524, status: 'on_hold', address: '14013 Wheel Wright Place',
  cancellation_requested_at: '2026-10-01T12:00:00Z', cancellation_reason: 'Client requested cancellation',
  hold_requested_at: '2026-10-01T12:30:00Z', hold_requested_by: 12, hold_reason: 'Waiting for staging',
};

describe('requested action visibility', () => {
  it('preserves both pending actions through history and dashboard list transformations while on hold', () => {
    const shoot = mapShootApiToShootData(request);
    const summary = shootDataToSummary(shoot);
    expect(summary.cancellationRequestedAt).toBe(request.cancellation_requested_at);
    expect(summary.cancellationReason).toBe(request.cancellation_reason);
    expect(summary.holdRequestedAt).toBe(request.hold_requested_at);
    expect(summary.holdRequestedBy).toBe(12);
    render(<ShootActionRequestBanner shoot={summary} />);
    expect(screen.getByText('Cancellation requested · Awaiting review')).toBeInTheDocument();
    expect(screen.getByText('Hold requested · Awaiting review')).toBeInTheDocument();
    expect(screen.getByText('Client requested cancellation')).toBeInTheDocument();
    expect(screen.getByText('Waiting for staging')).toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-10-01T12:00:00Z"]')).toBeInTheDocument();
  });

  it('preserves pending metadata from dashboard overview projections', () => {
    const summary = transformDashboardOverview({
      stats: { total_shoots: 1, scheduled_today: 0, flagged_shoots: 0, pending_reviews: 0 },
      upcoming_shoots: [{ ...request, services: [], is_flagged: false }], photographers: [],
      pending_reviews: [], activity_log: [], issues: [], workflow: { columns: [] },
    }).upcomingShoots[0];
    expect(getPendingShootActionRequests(summary).map(action => action.type)).toEqual(['cancellation', 'hold']);
    render(<ShootActionRequestBadges shoot={summary} />);
    expect(screen.getByText('Cancellation requested')).toBeInTheDocument();
    expect(screen.getByText('Hold requested')).toBeInTheDocument();
  });

  it('does not mark retained reasons or on-hold status as pending after review', () => {
    const resolved = mapShootApiToShootData({ ...request, cancellation_requested_at: null, hold_requested_at: null });
    render(<><ShootActionRequestBadges shoot={resolved} /><ShootActionRequestBanner shoot={resolved} /></>);
    expect(screen.queryByLabelText('Requested actions')).not.toBeInTheDocument();
    expect(getPendingShootActionRequests(shootDataToSummary(resolved))).toEqual([]);
  });

  it('honors an explicit cleared date over a stale alias in both API normalizers', () => {
    const cleared = { ...request, cancellationRequestedAt: null, holdRequestedAt: null };
    expect(getPendingShootActionRequests(normalizeShootActionRequests(cleared))).toEqual([]);
    expect(getPendingShootActionRequests(mapShootApiToShootData(cleared))).toEqual([]);
    expect(getPendingShootActionRequests(transformShootFromApi(cleared as Parameters<typeof transformShootFromApi>[0]))).toEqual([]);
  });

  it.each(['cancelled', 'canceled', 'declined'])('hides retained request timestamps on %s shoots across normalization flows', (status) => {
    const terminal = { ...request, status, workflow_status: 'scheduled' };
    const detail = transformShootFromApi(terminal as Parameters<typeof transformShootFromApi>[0]);
    const history = mapShootApiToShootData(terminal);
    const overview = transformDashboardOverview({
      stats: { total_shoots: 1, scheduled_today: 0, flagged_shoots: 0, pending_reviews: 0 },
      upcoming_shoots: [{ ...terminal, services: [], is_flagged: false }], photographers: [],
      pending_reviews: [], activity_log: [], issues: [], workflow: { columns: [] },
    }).upcomingShoots[0];
    for (const source of [terminal, normalizeShootActionRequests(terminal), detail, history, shootDataToSummary(history), overview]) {
      expect(getPendingShootActionRequests(source)).toEqual([]);
    }
    const { container } = render(<><ShootActionRequestBadges shoot={overview} /><ShootActionRequestBanner shoot={detail} /></>);
    expect(container).toBeEmptyDOMElement();
  });

  it('honors terminal workflow status aliases without using a stale snake_case alias', () => {
    expect(getPendingShootActionRequests({ ...request, status: 'scheduled', workflow_status: 'declined' })).toEqual([]);
    expect(getPendingShootActionRequests({ ...request, workflowStatus: ' CANCELED ' })).toEqual([]);
    expect(getPendingShootActionRequests({ ...request, workflowStatus: 'on_hold', workflow_status: 'cancelled', hold_requested_at: null }).map(action => action.type)).toEqual(['cancellation']);
  });

  it('keeps a cancellation request visible when a hold request alone is resolved', () => {
    expect(getPendingShootActionRequests({ ...request, hold_requested_at: null }).map(action => action.type)).toEqual(['cancellation']);
  });

  it('clears stale overview pipeline badges immediately using refreshed shoot metadata', () => {
    const pending = shootDataToSummary(mapShootApiToShootData({ ...request, status: 'scheduled', workflow_status: 'scheduled' }));
    const resolved = shootDataToSummary(mapShootApiToShootData({ ...request, status: 'scheduled', workflow_status: 'scheduled', cancellation_requested_at: null, hold_requested_at: null }));
    const workflow = buildPipelineWorkflow({ columns: [{ key: 'booked', label: 'Scheduled', accent: '#3b82f6', count: 1, shoots: [pending] }] }, [resolved]);
    expect(getPendingShootActionRequests(workflow!.columns[0].shoots[0])).toEqual([]);
  });

  it('includes requested actions in calendar button labels and removes resolved indicators', () => {
    const shoot = mapShootApiToShootData(request);
    const entry = { shoot, date: '2026-10-01', time: '10:00', minutes: 600 };
    const { rerender } = render(<UserPreferencesProvider><CalendarShootButton entry={entry} onShootSelect={() => undefined} compact /></UserPreferencesProvider>);
    expect(screen.getByRole('button', { name: /Cancellation requested/ })).toBeInTheDocument();
    rerender(<UserPreferencesProvider><CalendarShootButton entry={{ ...entry, shoot: { ...shoot, cancellationRequestedAt: undefined, holdRequestedAt: undefined } }} onShootSelect={() => undefined} compact /></UserPreferencesProvider>);
    expect(screen.getByRole('button')).not.toHaveAccessibleName(/requested/i);
  });
});
