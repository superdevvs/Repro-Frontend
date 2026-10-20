import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTravelFeasibility } from './useTravelFeasibility';
import { TravelFeasibilityPanel } from './TravelFeasibilityPanel';
import type { TravelConfirmation, TravelFeasibility } from './types';

const warning: TravelFeasibility = { enabled: true, status: 'conflict', available: false, reason_codes: ['outside_working_hours'],
  transitions: [], alternatives: [], can_override: false, can_override_working_hours: true, working_hours_confirmation_version: 'signed-hours-v1',
  policy_version: '1', schedule_version: '1', visits: [{ photographer_id: 9, start: '2026-10-20T20:55:00Z',
    end: '2026-10-20T21:10:00Z', scheduled_at: '2026-10-20T20:55:00Z', duration_minutes: 15, timezone: 'America/New_York', is_target: true }] };
const draft = { action_mode: 'create', client_id: 2, address: '1 Test Street', photographer_id: 9, scheduled_at: '2026-10-20T20:55:00Z' };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Harness({ save, client = false, action = 'create' }: {
  save: (value: TravelConfirmation) => void; response?: TravelFeasibility; client?: boolean; action?: string;
}) {
  const travel = useTravelFeasibility({ payload: { ...draft, action_mode: action }, requestedOnly: client, notificationsSupported: true });
  return <><button disabled={travel.blocked} onClick={async () => { const confirmed = await travel.confirmSave(); if (confirmed) save(confirmed); }}>Book Shoot</button>
    <TravelFeasibilityPanel travel={travel} /></>;
}

function preview(response = warning) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: response }))));
}

describe('superadmin working-hours booking confirmation', () => {
  it('unlocks booking only for a signed offer, requires a typed reason, and saves once with notification choices', async () => {
    preview(); const save = vi.fn(); render(<Harness save={save} />);
    await screen.findByText(/As superadmin/);
    const book = screen.getByRole('button', { name: 'Book Shoot' }); expect(book).toBeEnabled();
    fireEvent.click(book);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Book outside working hours' })).toBeVisible();
    expect(within(dialog).getByRole('region', { name: 'Appointment outside working hours' })).toHaveTextContent('15 min');
    const reason = within(dialog).getByLabelText('Working-hours exception reason');
    const confirm = within(dialog).getByRole('button', { name: 'Confirm and book outside hours' });
    expect(reason).toHaveValue(''); expect(confirm).toBeDisabled();
    fireEvent.change(reason, { target: { value: 'four' } }); expect(confirm).toBeDisabled();
    fireEvent.change(reason, { target: { value: 'x'.repeat(501) } }); expect(confirm).toBeDisabled();
    fireEvent.change(reason, { target: { value: 'Photographer agreed to work late.' } });
    fireEvent.click(within(dialog).getByLabelText('Notify client'));
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({ working_hours_override: true,
      working_hours_override_confirmed: true, working_hours_override_reason: 'Photographer agreed to work late.',
      working_hours_override_confirmation_version: 'signed-hours-v1', notify_client: false, notify_photographer: true }));
  });

  it('cancels without booking', async () => {
    preview(); const save = vi.fn(); render(<Harness save={save} />);
    await screen.findByText(/As superadmin/); fireEvent.click(screen.getByRole('button', { name: 'Book Shoot' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go back without saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(save).not.toHaveBeenCalled();
  });

  it.each(['permission', 'signature', 'overlap', 'edit'] as const)('keeps booking blocked for %s even if other offer fields are present', async scenario => {
    const response = { ...warning, ...(scenario === 'permission' ? { can_override_working_hours: false } : {}),
      ...(scenario === 'signature' ? { working_hours_confirmation_version: undefined } : {}),
      ...(scenario === 'overlap' ? { reason_codes: ['outside_working_hours', 'capture_overlap'] } : {}) };
    preview(response); render(<Harness save={vi.fn()} action={scenario === 'edit' ? 'update' : 'create'} />);
    await screen.findByText('The appointment is outside the photographer’s working hours.');
    expect(screen.getByRole('button', { name: 'Book Shoot' })).toBeDisabled();
  });
});
