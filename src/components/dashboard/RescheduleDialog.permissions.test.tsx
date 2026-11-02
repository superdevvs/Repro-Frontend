import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transformShootFromApi } from '@/context/shootNormalization';
import { RescheduleDialog } from './RescheduleDialog';

const state = vi.hoisted(() => ({ role: 'salesRep', secondary: [] as string[], loading: false, error: false,
  grants: new Set(['update', 'manage']), post: vi.fn(), preview: vi.fn(), confirm: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: state.role,
  user: { id: '1080', role: state.role, secondary_roles: state.secondary }, isLoading: false }) }));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({
  can: (_resource: string, action: string) => state.grants.has(action), isLoading: state.loading, hasError: state.error,
}) }));
vi.mock('@/context/shootsContextState', () => ({ useShoots: () => ({ fetchShoots: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('axios', () => ({ default: { post: state.post, isAxiosError: () => false } }));
vi.mock('@/features/travel/useTravelFeasibility', () => ({ useTravelFeasibility: (input: unknown) => {
  state.preview(input); return { blocked: false, confirmSave: state.confirm, acceptServerError: vi.fn() };
} }));
vi.mock('@/features/travel/TravelFeasibilityPanel', () => ({ TravelFeasibilityPanel: () => null }));
vi.mock('@/components/ui/calendar', () => ({ Calendar: ({ selected, onSelect }: { selected?: Date; onSelect: (value: Date) => void }) =>
  <input aria-label="New date" value={selected ? `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}` : ''}
    onChange={event => onSelect(new Date(`${event.target.value}T12:00:00`))} /> }));
vi.mock('@/components/ui/time-select', () => ({ TimeSelect: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
  <input aria-label="New time" value={value} onChange={event => onChange(event.target.value)} /> }));
const shoot = transformShootFromApi({ id: '5866', status: 'scheduled', scheduled_at: '2026-11-04T18:00:00Z',
  timezone: 'America/New_York', canApproveReschedule: true, canRequestReschedule: false,
});

beforeEach(() => {
  state.role = 'salesRep'; state.secondary = []; state.loading = false; state.error = false;
  state.grants = new Set(['update', 'manage']); state.post.mockResolvedValue({ data: { applied: true } });
  state.confirm.mockResolvedValue({});
  localStorage.setItem('authToken', 'local-fixture');
});
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('server-backed reschedule controls', () => {
  it.each(['editor', 'photographer', 'client'])('applies an authorized secondary sales role on a primary %s account', async role => {
    state.role = role; state.secondary = ['sales_rep'];
    render(<RescheduleDialog shoot={shoot} isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Select a new date and time. This is applied to the shoot straight away.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule Shoot' }));
    await waitFor(() => expect(state.post).toHaveBeenCalledOnce());
    expect(state.post.mock.calls[0][0]).toContain('/shoots/5866/reschedule');
  });

  it.each(['admin', 'editing_manager', 'salesRep'])('prevents denied %s edit rights from becoming a pending client request', role => {
    state.role = role; state.grants.delete('update');
    render(<RescheduleDialog shoot={{ ...shoot, canRequestReschedule: true }} isOpen onClose={vi.fn()} />);
    expect(screen.getByText('You do not have permission to reschedule this appointment.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule unavailable' }));
    expect(state.post).not.toHaveBeenCalled();
    expect(state.preview).toHaveBeenLastCalledWith(expect.objectContaining({ payload: null }));
  });

  it('honors a per-shoot server denial despite effective role grants', () => {
    render(<RescheduleDialog shoot={{ ...shoot, canApproveReschedule: false }} isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Reschedule unavailable' })).toBeDisabled();
  });

  it('blocks submission and travel requests while permission data is loading or failed', () => {
    state.loading = true;
    const view = render(<RescheduleDialog shoot={shoot} isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Checking permissions...' })).toBeDisabled();
    expect(state.preview).toHaveBeenLastCalledWith(expect.objectContaining({ payload: null }));
    state.loading = false; state.error = true;
    view.rerender(<RescheduleDialog shoot={shoot} isOpen onClose={vi.fn()} />);
    expect(screen.getByText(/Scheduling permissions could not be loaded/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reschedule unavailable' })).toBeDisabled();
    expect(state.post).not.toHaveBeenCalled();
  });

  it('requires explicit appointment capabilities instead of guessing from an admin role', () => {
    state.role = 'admin';
    render(<RescheduleDialog shoot={{ ...shoot, canApproveReschedule: undefined, canRequestReschedule: undefined }} isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Reschedule unavailable' })).toBeDisabled();
  });

  it('does not submit a stale confirmation after effective access changes', async () => {
    let confirm: (value: object) => void = () => {};
    state.confirm.mockReturnValue(new Promise(resolve => { confirm = resolve; }));
    const props = { shoot, isOpen: true, onClose: vi.fn() };
    const view = render(<RescheduleDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule Shoot' }));
    expect(state.confirm).toHaveBeenCalledOnce();
    state.grants.delete('update');
    view.rerender(<RescheduleDialog {...props} />);
    await act(async () => { confirm({}); });
    expect(state.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reschedule unavailable' })).toBeDisabled();
  });

  it.each(['closed', 'open'])('opens a fresh date, time, and reason when switching shoot A (%s) to shoot B', async previousState => {
    const props = { shoot, isOpen: true, onClose: vi.fn() };
    const view = render(<RescheduleDialog {...props} />);
    fireEvent.change(screen.getByLabelText('New date'), { target: { value: '2026-11-05' } });
    fireEvent.change(screen.getByLabelText('New time'), { target: { value: '2:15 PM' } });
    fireEvent.change(screen.getByPlaceholderText('Enter the reason for rescheduling...'), { target: { value: 'Draft for shoot A' } });
    if (previousState === 'closed') view.rerender(<RescheduleDialog {...props} isOpen={false} />);
    const shootB = transformShootFromApi({ id: '5900', status: 'scheduled', scheduled_date: '2026-11-10',
      time: '09:30', timezone: 'America/New_York', canApproveReschedule: true, canRequestReschedule: false });
    view.rerender(<RescheduleDialog {...props} shoot={shootB} />);
    expect(screen.getByLabelText('New date')).toHaveValue('2026-11-10');
    expect(screen.getByLabelText('New time')).toHaveValue('9:30 AM');
    expect(screen.getByPlaceholderText('Enter the reason for rescheduling...')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule Shoot' }));
    await waitFor(() => expect(state.post).toHaveBeenCalledOnce());
    expect(state.post.mock.calls[0][0]).toContain('/shoots/5900/reschedule');
    expect(state.post.mock.calls[0][1]).toMatchObject({ requested_date: '2026-11-10', requested_time: '09:30' });
    expect(state.post.mock.calls[0][1].reason).toBeUndefined();
  });

  it('preserves an active draft during same-shoot refresh and uses the latest schedule on reopen', () => {
    const props = { shoot, isOpen: true, onClose: vi.fn() };
    const view = render(<RescheduleDialog {...props} />);
    fireEvent.change(screen.getByLabelText('New date'), { target: { value: '2026-11-05' } });
    fireEvent.change(screen.getByLabelText('New time'), { target: { value: '2:15 PM' } });
    fireEvent.change(screen.getByPlaceholderText('Enter the reason for rescheduling...'), { target: { value: 'Keep this draft' } });
    const refreshed = { ...shoot, scheduledDate: '2026-11-06', time: '11:45' };
    view.rerender(<RescheduleDialog {...props} shoot={refreshed} />);
    expect(screen.getByLabelText('New date')).toHaveValue('2026-11-05');
    expect(screen.getByLabelText('New time')).toHaveValue('2:15 PM');
    expect(screen.getByPlaceholderText('Enter the reason for rescheduling...')).toHaveValue('Keep this draft');
    view.rerender(<RescheduleDialog {...props} shoot={refreshed} isOpen={false} />);
    view.rerender(<RescheduleDialog {...props} shoot={refreshed} />);
    expect(screen.getByLabelText('New date')).toHaveValue('2026-11-06');
    expect(screen.getByLabelText('New time')).toHaveValue('11:45 AM');
    expect(screen.getByPlaceholderText('Enter the reason for rescheduling...')).toHaveValue('');
  });

  it('discards confirmation from an earlier session when the same shoot is closed and reopened', async () => {
    let confirm: (value: object) => void = () => {};
    state.confirm.mockReturnValue(new Promise(resolve => { confirm = resolve; }));
    const props = { shoot, isOpen: true, onClose: vi.fn() };
    const view = render(<RescheduleDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule Shoot' }));
    view.rerender(<RescheduleDialog {...props} isOpen={false} />);
    view.rerender(<RescheduleDialog {...props} />);
    expect(screen.getByRole('button', { name: 'Reschedule Shoot' })).toBeEnabled();
    await act(async () => { confirm({}); });
    expect(state.post).not.toHaveBeenCalled();
  });
});
