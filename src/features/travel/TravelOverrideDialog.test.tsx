import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('Exterior photography')).toBeVisible(); expect(screen.getByText('Start: Oct 5, 9:00 AM EDT')).toBeVisible(); expect(screen.getByText('End: Oct 5, 9:50 AM EDT')).toBeVisible();
    expect(screen.getByText('Photographer: Pat Example')).toBeVisible();
    expect(screen.getByText(/5 Proposed Road, Baltimore/)).toBeVisible(); expect(screen.getByText(/Approximate Google drive time to the proposed location: 25 min/)).toBeVisible();
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
});
