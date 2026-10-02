import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TravelFeasibilityPanel } from './TravelFeasibilityPanel';
import type { TravelController } from './useTravelFeasibility';

afterEach(cleanup);
const controller = (overrides: Partial<TravelController> = {}): TravelController => ({
  result: { enabled: true, status: 'conflict', available: false, reason_codes: ['insufficient_travel_time'], can_override: true,
    policy_version: '1', schedule_version: '1', alternatives: [], transitions: [
      { id: 'a', direction: 'incoming', source: 'google_routes', required_minutes: 25, available_minutes: 10, shortfall_minutes: 15, reason_code: 'insufficient_travel_time', attribution: 'Google Maps', drive_minutes: 20, distance_miles: 9.5 },
      { id: 'b', direction: 'outgoing', source: 'mileage_band', required_minutes: 30, available_minutes: 45, shortfall_minutes: 0, reason_code: 'available' },
    ] }, enabled: true, loading: false, requestedOnly: false, timezone: 'America/New_York', proposedLocation: '1 Main St', error: null, visible: true, blocked: true,
  confirmation: {}, canOverride: true, confirmSave: vi.fn(), overrideDialog: { open: false, reason: '', setReason: vi.fn(), cancel: vi.fn(), complete: vi.fn() }, locationConfirmed: false, setLocationConfirmed: vi.fn(),
  retry: vi.fn(), loadAlternatives: vi.fn(), alternativesRequested: false, acceptServerError: vi.fn(), ...overrides,
});
describe('travel explanations and permission controls', () => {
  it('explains both legs, precise shortfall, estimate source, and maps attribution', () => {
    render(<TravelFeasibilityPanel travel={controller()} />);
    expect(screen.getByText('From previous appointment')).toBeInTheDocument(); expect(screen.getByText('To next appointment')).toBeInTheDocument();
    expect(screen.getByText('25 min needed · 10 min available · 15 min short')).toBeInTheDocument();
    expect(screen.getByText('30 min needed · 45 min available')).toBeInTheDocument(); expect(screen.getByText('Google Maps')).toBeInTheDocument();
    expect(screen.getByText('Google Maps')).toHaveAttribute('translate', 'no');
    expect(screen.getByText('Google Maps')).toHaveClass('whitespace-nowrap', 'font-normal', 'not-italic', 'text-xs', 'text-[#5E5E5E]', 'dark:text-white');
    expect(screen.getByText('Estimated travel based on distance; actual road travel may take longer.')).toBeInTheDocument();
  });
  it('requires an explicit exception action and reason and loads alternatives on demand', () => {
    const travel = controller(); render(<TravelFeasibilityPanel travel={travel} />);
    expect(screen.getByText(/Saving will ask you to review/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Approve an exception to this travel allowance')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Find up to 3 alternatives' })); expect(travel.loadAlternatives).toHaveBeenCalledOnce();
  });
  it('directs manual alternatives to the schedule form without assuming its position', () => {
    const travel = controller();
    render(<TravelFeasibilityPanel travel={{ ...travel, result: { ...travel.result!, alternatives: [{ scheduled_at: '2026-10-05T15:00:00Z', photographer_id: 9 }] } }} />);
    expect(screen.getByText('Adjust the visit times in the schedule form to use this option.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this time' })).not.toBeInTheDocument();
  });
  it('shows warnings and no exception control for client requests', () => {
    render(<TravelFeasibilityPanel travel={controller({ requestedOnly: true })} />);
    expect(screen.getByText(/You can submit your request/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Approve an exception to this travel allowance')).not.toBeInTheDocument();
  });
  it('only offers explicit building confirmation for unknown locations with server capability', () => {
    const travel = controller(); const result = { ...travel.result!, transitions: [{ ...travel.result!.transitions[0], source: 'unknown' as const }] };
    const view = render(<TravelFeasibilityPanel travel={{ ...travel, result }} />);
    fireEvent.click(screen.getByLabelText(/I confirm this is the correct building address/)); expect(travel.setLocationConfirmed).toHaveBeenCalledWith(true);
    view.rerender(<TravelFeasibilityPanel travel={{ ...travel, result: { ...result, can_override: false } }} />);
    expect(screen.queryByLabelText(/I confirm this is the correct building address/)).not.toBeInTheDocument();
  });
  it.each([75, 90, 100] as const)('shows the admin %s budget warning', alert_level => {
    const travel = controller(); render(<TravelFeasibilityPanel travel={{ ...travel, result: { ...travel.result!, budget: { used_elements: alert_level, limit_elements: 100, remaining_elements: 100 - alert_level, usage_percent: alert_level, alert_level, budget_usd: 100 } } }} />);
    expect(screen.getByText(new RegExp(`${alert_level}% threshold reached`))).toBeInTheDocument();
  });
});
