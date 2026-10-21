import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { RescheduleDialog } from './RescheduleDialog';
const mocks = vi.hoisted(() => ({ role: 'admin', post: vi.fn(), fetchShoots: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: mocks.role, user: { role: mocks.role } }) }));
vi.mock('@/context/shootsContextState', () => ({ useShoots: () => ({ fetchShoots: mocks.fetchShoots }) }));
vi.mock('axios', () => ({ default: { post: mocks.post, isAxiosError: () => false } }));
vi.mock('@/components/ui/time-select', () => ({ TimeSelect: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <input aria-label="New time" value={value} onChange={event => onChange(event.target.value)} /> }));
const shoot = { id: '42', timezone: 'America/New_York', scheduled_at: '2026-10-08T14:00:00Z', photographer: { id: '9' }, client: { id: '2' }, location: { address: '1 Main St' }, serviceObjects: [{ id: '6', name: 'Exterior', duration_minutes: 15 }] } as unknown as ShootData;
beforeEach(() => {
  mocks.role = 'admin'; mocks.post.mockResolvedValue({ data: { applied: true } }); localStorage.setItem('authToken', 'test');
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { enabled: true, status: 'conflict', available: false, can_override: mocks.role === 'admin', reason_codes: ['insufficient_travel_time'], transitions: [], alternatives: [], policy_version: '1', schedule_version: '1', confirmation_version: 'checked-itinerary' } })))));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
describe('reschedule travel confirmation integration', () => {
  it.each(['superadmin', 'salesRep'])('lets %s explicitly confirm a 4:30 PM working-hours reschedule', async role => {
    mocks.role = role;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { enabled: true, status: 'conflict', available: false,
      can_override: false, can_override_working_hours: true, working_hours_confirmation_version: 'signed-reschedule',
      reason_codes: ['outside_working_hours'], transitions: [], alternatives: [], policy_version: '1', schedule_version: '1',
      visits: [{ photographer_id: 9, start: '2026-10-08T20:30:00Z', end: '2026-10-08T21:05:00Z', scheduled_at: '2026-10-08T20:30:00Z', duration_minutes: 35, timezone: 'America/New_York' }] } }))));
    render(<RescheduleDialog shoot={shoot} isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('New time'), { target: { value: '4:30 PM' } });
    await screen.findByText(/You can approve this appointment outside working hours/);
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule Shoot' }));
    await screen.findByText('Save outside working hours');
    const confirm = screen.getByRole('button', { name: 'Confirm and save outside hours' });
    expect(confirm).toBeDisabled(); expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Working-hours exception reason'), { target: { value: 'Photographer approved this schedule.' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    expect(mocks.post.mock.calls[0][1]).toMatchObject({ requested_time: '16:30', working_hours_override: true,
      working_hours_override_confirmed: true, working_hours_override_confirmation_version: 'signed-reschedule' });
  });
  it('previews the requested schedule, blocks staff until an explained exception, and passes only that authorized confirmation', async () => {
    render(<RescheduleDialog shoot={shoot} isOpen onClose={vi.fn()} />);
    await screen.findByText('Review travel time'); expect(screen.getByRole('button', { name: 'Reschedule Shoot' })).toBeEnabled();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({ shoot_id: '42', action_mode: 'reschedule', requested_date: '2026-10-08', requested_time: '10:00' });
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule Shoot' }));
    await screen.findByText('Confirm travel exception');
    expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Travel exception reason'), { target: { value: 'Access coordinated with photographer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm travel exception and save' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    expect(mocks.post.mock.calls[0][1]).toMatchObject({ travel_override: true, travel_override_reason: 'Access coordinated with photographer', travel_override_confirmed: true });
  });
  it('lets clients request a conflicting time without receiving an exception control', async () => {
    mocks.role = 'client'; render(<RescheduleDialog shoot={shoot} isOpen onClose={vi.fn()} />);
    await screen.findByText('Review travel time'); expect(screen.queryByLabelText('Approve an exception to this travel allowance')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' })); await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('travel_override');
  });
});
