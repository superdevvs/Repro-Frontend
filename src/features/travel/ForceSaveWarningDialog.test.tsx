import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTravelFeasibility } from './useTravelFeasibility';
import { TravelFeasibilityPanel } from './TravelFeasibilityPanel';
import { buildForceSaveChanges } from './forceSaveChanges';
import type { TravelConfirmation, TravelFeasibility } from './types';

const response: TravelFeasibility = { enabled: true, status: 'conflict', available: false, reason_codes: ['outside_working_hours'],
  transitions: [], alternatives: [], can_override: false, can_force_save: true, force_save_confirmation_version: 'signed-edit-v1',
  policy_version: '1', schedule_version: '1', visits: [{ photographer_id: 1141, start: '2026-10-13T15:30:00Z',
    end: '2026-10-13T17:00:00Z', scheduled_at: '2026-10-13T15:30:00Z', duration_minutes: 90, timezone: 'America/New_York', is_target: true }],
};
const source = { id: 2379, photographer: { id: 1141, name: 'Harrison Hart' }, service_items: [
  { service_id: 2, name: 'HDR Photos', price: 275, quantity: 1, duration_minutes: 75, photographer_id: 1141 },
] };
const draft = { shoot_id: 2379, action_mode: 'update', address: '8132 Winding Ross Way', city: 'Ellicott City',
  scheduled_at: '2026-10-13T15:30:00Z', photographer_id: 1141, timezone: 'America/New_York',
  service_items: [{ service_id: 8, duration_minutes: 90, scheduled_at: '2026-10-13T15:30:00Z', photographer_id: 1141 }],
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Harness({ save, result = response, client = false, action = 'update' }: { save: (confirmation: TravelConfirmation) => void; result?: TravelFeasibility; client?: boolean; action?: string }) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: result }))));
  const travel = useTravelFeasibility({ payload: { ...draft, action_mode: action }, requestedOnly: client, notificationsSupported: true });
  const warningTravel = { ...travel, warningChanges: buildForceSaveChanges(source, draft, [{ id: 8, name: '55 HDR Photos', price: 350 }]),
    onSaveWithWarning: async () => { const confirmation = await travel.confirmForceSave(); if (confirmation) save(confirmation); } };
  return <><button disabled={travel.blocked} onClick={async () => { const confirmation = await travel.confirmSave(); if (confirmation) save(confirmation); }}>Normal Save</button><TravelFeasibilityPanel compact travel={warningTravel} /></>;
}

describe('save with warning acknowledgement', () => {
  it('shows actual proposed changes and hours warning, requires a typed reason and submits exactly once', async () => {
    const save = vi.fn(); render(<Harness save={save} />);
    const warningButton = await screen.findByRole('button', { name: 'Save with warning' });
    expect(screen.getByRole('button', { name: 'Normal Save' })).toBeDisabled();
    fireEvent.click(warningButton);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('The appointment is outside the photographer’s working hours.')).toBeVisible();
    expect(within(dialog).getByText('Current: HDR Photos ($275.00)')).toBeVisible();
    expect(within(dialog).getByText('Proposed: 55 HDR Photos ($350.00)')).toBeVisible();
    expect(within(dialog).getByText('Current: 75 min')).toBeVisible();
    expect(within(dialog).getByText('Proposed: 90 min')).toBeVisible();
    expect(within(dialog).getByRole('region', { name: 'Proposed appointment' })).toHaveTextContent('90 min');
    const reason = screen.getByLabelText('Reason for saving with warning');
    const confirm = screen.getByRole('button', { name: 'Confirm and save with warning' });
    expect(reason).toHaveValue(''); expect(confirm).toBeDisabled();
    fireEvent.change(reason, { target: { value: 'four' } }); expect(confirm).toBeDisabled();
    fireEvent.change(reason, { target: { value: 'x'.repeat(501) } }); expect(confirm).toBeDisabled();
    fireEvent.change(reason, { target: { value: 'Photographer confirmed the package change.' } });
    fireEvent.click(within(dialog).getByLabelText('Notify client'));
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({ force_save: true, force_save_confirmed: true,
      force_save_reason: 'Photographer confirmed the package change.', force_save_confirmation_version: 'signed-edit-v1',
      notify_client: false, notify_photographer: true }));
  });
  it('cancels the warning acknowledgement without saving', async () => {
    const save = vi.fn(); render(<Harness save={save} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save with warning' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go back without saving' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(save).not.toHaveBeenCalled();
  });
  it.each(['permission', 'signature', 'overlap', 'client', 'pending'] as const)('does not offer the action for %s', async scenario => {
    const result = { ...response, ...(scenario === 'permission' ? { can_force_save: false } : {}),
      ...(scenario === 'signature' ? { force_save_confirmation_version: undefined } : {}),
      ...(scenario === 'overlap' ? { reason_codes: ['capture_overlap'] } : {}) };
    render(<Harness save={vi.fn()} result={result} client={scenario === 'client'} action={scenario === 'pending' ? 'approve' : 'update'} />);
    await screen.findByText(scenario === 'overlap' ? 'Already booked at this time' : 'Review travel time');
    expect(screen.queryByRole('button', { name: 'Save with warning' })).not.toBeInTheDocument();
  });
});
