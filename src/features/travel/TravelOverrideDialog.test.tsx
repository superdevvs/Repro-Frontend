import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTravelFeasibility } from './useTravelFeasibility';
import { TravelFeasibilityPanel } from './TravelFeasibilityPanel';
import type { TravelConfirmation, TravelFeasibility } from './types';

const result: TravelFeasibility = { enabled: true, status: 'conflict', available: false, can_override: true, confirmation_version: 'itinerary-digest', schedule_version: '1', policy_version: '1', alternatives: [], reason_codes: ['insufficient_travel_time'], transitions: [
  { id: 'before', direction: 'incoming', source: 'google_routes', required_minutes: 30, available_minutes: 10, shortfall_minutes: 20, reason_code: 'insufficient_travel_time', drive_minutes: 24.3, attribution: 'Google Maps', candidate_start: '2026-10-05T14:00:00Z', candidate_end: '2026-10-05T14:15:00Z',
    neighbor: { shoot_id: 123, scheduled_at: '2026-10-05T13:00:00Z', end_at: '2026-10-05T13:50:00Z', timezone: 'America/New_York', can_view_details: true, services: [{ id: 6, name: 'Exterior photography' }], photographer: { id: 9, name: 'Pat Example' } } },
] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Harness({ save, response = result, client = false }: { save: (value: TravelConfirmation) => void; response?: TravelFeasibility; client?: boolean }) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: response })))));
  const travel = useTravelFeasibility({ payload: { address: '5 Proposed Road', city: 'Baltimore', scheduled_at: '2026-10-05T14:00:00Z', timezone: 'America/New_York' }, requestedOnly: client });
  return <><button onClick={async () => { const confirmation = await travel.confirmSave(); if (confirmation) save(confirmation); }}>Save schedule</button><TravelFeasibilityPanel travel={travel} /></>;
}
describe('deliberate travel override dialog', () => {
  it('shows authorized neighboring schedule/service and proposed location, then saves exactly once after a reason and final keyboard confirmation', async () => {
    const save = vi.fn(); render(<Harness save={save} />); await screen.findByText('Travel needs attention');
    fireEvent.click(screen.getByText('Save schedule')); await screen.findByRole('dialog');
    expect(screen.getByText('Exterior photography')).toBeVisible(); expect(screen.getByText('Oct 5 · 9:00 AM – 9:50 AM EDT')).toBeVisible();
    expect(screen.getByText('Photographer: Pat Example')).toBeVisible();
    expect(screen.getByText(/5 Proposed Road, Baltimore/)).toBeVisible(); expect(screen.getByText('25 min.')).toBeVisible();
    const slider = screen.getByRole('slider'); expect(slider).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Travel exception reason'), { target: { value: 'Coordinated access with photographer' } });
    fireEvent.keyDown(slider, { key: 'Enter' }); expect(save).not.toHaveBeenCalled();
    fireEvent.keyDown(slider, { key: 'End' }); expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Travel exception reason'), { target: { value: 'Coordinated access with photographer.' } });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(slider, { key: 'End' });
    fireEvent.keyDown(slider, { key: 'Enter' }); fireEvent.keyDown(slider, { key: 'Enter' });
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({ travel_override: true, travel_override_confirmed: true, travel_override_reason: 'Coordinated access with photographer.', travel_override_confirmation_version: 'itinerary-digest' }));
  });
  it('cancels without saving and does not invent hidden neighbor details or Google estimates', async () => {
    const save = vi.fn(); render(<Harness save={save} response={{ ...result, transitions: [{ ...result.transitions[0], neighbor: undefined, source: 'mileage_band', attribution: undefined }] }} />);
    await screen.findByText('Travel needs attention'); fireEvent.click(screen.getByText('Save schedule')); await screen.findByRole('dialog');
    expect(screen.getByText('Booking details are not available with your access.')).toBeVisible(); expect(screen.queryByText('Exterior photography')).not.toBeInTheDocument();
    expect(screen.queryByText(/Approximate Google drive time/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Go back without saving')); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(save).not.toHaveBeenCalled();
  });
  it('summarizes one shared proposed interval while keeping both neighboring bookings', async () => {
    const second = { ...result.transitions[0], id: 'after', direction: 'outgoing' as const, neighbor: { ...result.transitions[0].neighbor!, shoot_id: 124, photographer: { id: 10, name: 'Robin Example' } } };
    render(<Harness save={vi.fn()} response={{ ...result, transitions: [result.transitions[0], second] }} />);
    await screen.findByText('Travel needs attention'); fireEvent.click(screen.getByText('Save schedule')); await screen.findByRole('dialog');
    expect(screen.getAllByText('Oct 5 · 10:00 AM – 10:15 AM EDT')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Proposed booking' })).getByText('Oct 5 · 10:00 AM – 10:15 AM EDT')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Previous booking' })).toBeVisible(); expect(screen.getByRole('region', { name: 'Next booking' })).toBeVisible();
    expect(screen.getByText('Photographer: Pat Example')).toBeVisible(); expect(screen.getByText('Photographer: Robin Example')).toBeVisible();
  });
  it('retains each proposed interval when a multi-visit schedule has different candidate times', async () => {
    const second = { ...result.transitions[0], id: 'after', direction: 'outgoing' as const, candidate_start: '2026-10-05T16:00:00Z', candidate_end: '2026-10-05T16:30:00Z' };
    render(<Harness save={vi.fn()} response={{ ...result, transitions: [result.transitions[0], second] }} />);
    await screen.findByText('Travel needs attention'); fireEvent.click(screen.getByText('Save schedule')); await screen.findByRole('dialog');
    expect(screen.getByRole('region', { name: 'Proposed booking' })).not.toHaveTextContent('10:00 AM');
    expect(screen.getByRole('region', { name: 'Previous booking' })).toHaveTextContent('Proposed: Oct 5 · 10:00 AM – 10:15 AM EDT');
    expect(screen.getByRole('region', { name: 'Next booking' })).toHaveTextContent('Proposed: Oct 5 · 12:00 PM – 12:30 PM EDT');
  });
  it('labels both time zones when a booking spans the fall-back clock change', async () => {
    const leg = { ...result.transitions[0], neighbor: { ...result.transitions[0].neighbor!, scheduled_at: '2026-11-01T05:30:00Z', end_at: '2026-11-01T06:45:00Z' } };
    render(<Harness save={vi.fn()} response={{ ...result, transitions: [leg] }} />);
    await screen.findByText('Travel needs attention'); fireEvent.click(screen.getByText('Save schedule')); await screen.findByRole('dialog');
    expect(screen.getByText('Nov 1 · 1:30 AM EDT – 1:45 AM EST')).toBeVisible();
  });
});
