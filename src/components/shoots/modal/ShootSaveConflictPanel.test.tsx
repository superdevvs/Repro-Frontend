import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootServiceMutationError, submitShootServiceMutation } from '@/utils/shootServiceMutation';
import { useShootOverviewEditor } from '../tabs/overview/useShootOverviewEditor';
import { useOverviewLookupData } from '../tabs/overview/shootOverviewEditorSupport';
import { ShootSaveConflictPanel } from './ShootSaveConflictPanel';
import { useShootDetailsModalSave } from './useShootDetailsModalSave';

vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));
vi.mock('@/utils/shootServiceMutation', async original => ({
  ...await original<typeof import('@/utils/shootServiceMutation')>(), submitShootServiceMutation: vi.fn(),
}));
vi.mock('../tabs/overview/shootOverviewEditorSupport', async original => ({
  ...await original<typeof import('../tabs/overview/shootOverviewEditorSupport')>(),
  useOverviewLookupData: vi.fn(), usePhotographerAssignmentOptions: vi.fn(), usePhotographerDistanceAvailability: vi.fn(),
}));

const catalog = [
  { id: '10', name: 'HDR Photos' }, { id: '11', name: '2D Floor plans' },
  { id: '12', name: 'Virtual staging' }, { id: '13', name: 'Basic object removal' },
];
const shoot = {
  id: '6022', status: 'delivered', workflowStatus: 'delivered', editVersion: 'original',
  location: { address: '432 Washington Avenue' }, canManageBooking: true,
  scheduledDate: '2026-11-19', time: '11:00', services: [],
  serviceItems: catalog.slice(0, 2).map(item => ({ ...item, service_id: item.id, quantity: 1 })),
} as unknown as ShootData;
const latest = (staging?: number, removal?: number): ShootData => ({
  ...shoot, editVersion: 'latest',
  serviceItems: [...shoot.serviceItems!, { id: '14', service_id: '14', name: 'Other new service', price: 20, quantity: 1 },
    ...[staging, removal].flatMap((quantity, i) => quantity === undefined ? []
      : [{ ...catalog[2 + i], service_id: catalog[2 + i].id, quantity, price: i ? 25 : 45 }])],
});
const mutation = vi.mocked(submitShootServiceMutation);
const refresh = vi.fn<() => Promise<ShootData | null>>();
const setEditMode = vi.fn();
const updateShoot = vi.fn().mockResolvedValue(undefined);
const conflict = () => new ShootServiceMutationError('Version changed', 409, { code: 'shoot_edit_conflict' });

function Editor({ record = shoot, session = '6022', admin = false }: { record?: ShootData; session?: string | null; admin?: boolean }) {
  const save = useShootDetailsModalSave({
    shoot: record, editSessionKey: session, setShoot: vi.fn(), setIsEditMode: setEditMode, refreshShoot: refresh,
    updateShoot, toast: vi.fn(), isAdmin: admin, isRep: !admin, canNotifyClient: true, canNotifyPhotographer: false,
  });
  const editor = useShootOverviewEditor({
    shoot: record, role: admin ? 'admin' : 'salesRep', isAdmin: admin, canEditServicePlan: true,
    canEditAppointments: admin, isEditMode: true, onSave: save.handleSaveRequest, onShootUpdate: vi.fn(), toast: vi.fn(),
  });
  return <ShootSaveConflictPanel review={save.conflictReview} saving={save.isSavingChanges}>
    <button onClick={() => {
      editor.actions.toggleServiceSelection('12'); editor.actions.toggleServiceSelection('13');
      editor.actions.updateServiceQuantity('12', 2); editor.actions.updateServiceQuantity('13', 3);
    }}>Choose add-ons</button>
    <button onClick={() => editor.actions.setPropertyYearBuiltEdit('1985')}>Change property year</button>
    <button disabled={editor.travel.blocked} onClick={() => editor.actions.handleSave()}>Save changes</button>
    {save.isSaveConfirmOpen && <button onClick={save.handleConfirmSave}>Confirm changes</button>}
  </ShootSaveConflictPanel>;
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
async function firstSave() {
  mutation.mockRejectedValueOnce(conflict());
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(false));
  click('Save changes');
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm changes' }));
  await screen.findByRole('heading', { name: 'This booking changed while you were editing' });
  expect(screen.getByText('Virtual staging × 2')).toBeTruthy();
  expect(screen.getByText('Basic object removal × 3')).toBeTruthy();
  expect(mutation.mock.calls[0][0].payload).not.toHaveProperty('serviceAdditionDraft');
}

beforeEach(() => {
  localStorage.setItem('authToken', 'fixture');
  vi.mocked(useOverviewLookupData).mockImplementation(function useCatalog(_editing, _shoot, _sqft, _price, _clients, setCatalog) {
    useEffect(() => setCatalog(catalog), [setCatalog]);
  });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    data: { enabled: false, available: true, status: 'available', reason_codes: [], transitions: [] },
  }))));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); mutation.mockReset(); refresh.mockReset(); vi.clearAllMocks(); });

describe('recovering a concurrent Overview save', () => {
  it.each([false, true])('confirms only missing quantities against the reviewed version (admin=%s)', async admin => {
    const view = render(<Editor admin={admin} />);
    click('Choose add-ons');
    view.rerender(<Editor admin={admin} record={latest(2)} />);
    await firstSave();
    expect(mutation.mock.calls[0][0].payload.expected_edit_version).toBe('original');
    refresh.mockResolvedValue(latest(2));
    click('Review changes');
    await screen.findByText('Already saved');
    expect(within(screen.getAllByRole('listitem')[1]).getByText('Missing')).toBeTruthy();
    expect(refresh).toHaveBeenCalledWith({ requireFresh: true });
    expect(mutation).toHaveBeenCalledTimes(1);
    mutation.mockResolvedValueOnce({ kind: 'success', data: { data: latest(2, 3) } });
    click('Save missing services');
    await waitFor(() => expect(setEditMode).toHaveBeenCalledWith(false));
    expect(mutation.mock.calls[1][0].payload).toEqual({
      expected_edit_version: 'latest', service_items: [{ service_id: 13, quantity: 3 }], service_change_intent: 'new_work',
      notify_client: true, notify_photographer: false,
    });
  });

  it('reviews unexpected removals on an additions-only draft without offering a detach confirmation', async () => {
    render(<Editor />); click('Choose add-ons');
    mutation.mockResolvedValueOnce({ kind: 'confirmation_required', confirmation: {
      token: 'remove-line-token', message: 'Confirm removal', impact: {
        removedServices: [{ serviceId: 14, name: 'Other new service' }], currentTotal: 200, newTotal: 180,
        filesDetached: 1, albumsDetached: 0, uploadAttemptsDetached: 0, assignmentsRemoved: 0, progressRowsRemoved: 0,
        paymentAllocationsReleased: 0, leavesNoServices: false, totalPaid: 0, newBalance: 180, refundCreditDue: 0,
      },
    } });
    click('Save changes');
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm changes' }));
    await screen.findByRole('button', { name: 'Review changes' });
    expect(screen.queryByRole('button', { name: 'Confirm changes' })).toBeNull();
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it('finishes an already-saved draft without another PATCH or notification', async () => {
    render(<Editor />); click('Choose add-ons'); await firstSave();
    refresh.mockResolvedValue(latest(2, 3)); click('Review changes');
    await screen.findByText('These services are already saved'); click('Done');
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(updateShoot).toHaveBeenCalledWith('6022', latest(2, 3), { skipApi: true });
  });

  it.each([true, false])('requires manual review for a different quantity or mixed draft (mixed=%s)', async mixed => {
    render(<Editor />); click('Choose add-ons');
    if (mixed) click('Change property year');
    await firstSave();
    refresh.mockResolvedValue(mixed ? latest(2, 3) : latest(1));
    click('Review changes');
    await screen.findByRole('button', { name: 'Discard draft and open latest booking' });
    if (!mixed) expect(screen.getByText('Currently booked × 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save missing services' })).toBeNull();
    click('Back to draft');
    expect(setEditMode).not.toHaveBeenCalled();
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft on read failure and rechecks both quantities after a second conflict', async () => {
    render(<Editor />); click('Choose add-ons'); await firstSave();
    refresh.mockResolvedValueOnce(null).mockResolvedValueOnce(latest()).mockResolvedValueOnce(latest(2, 3));
    click('Review changes'); await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Save missing services' })).toBeNull();
    click('Review changes');
    await screen.findByRole('button', { name: 'Save missing services' });
    mutation.mockRejectedValueOnce(conflict());
    click('Save missing services');
    await screen.findByRole('button', { name: 'Review changes' }); click('Review changes');
    await screen.findByText('These services are already saved');
    expect(mutation).toHaveBeenCalledTimes(2);
  });

  it('ignores a review response after closing the editing session', async () => {
    const view = render(<Editor />); click('Choose add-ons'); await firstSave();
    let resolve!: (value: ShootData) => void;
    refresh.mockReturnValue(new Promise(done => { resolve = done; }));
    click('Review changes');
    view.rerender(<Editor session={null} />);
    view.rerender(<Editor />);
    await act(async () => resolve(latest()));
    expect(screen.queryByRole('region', { name: 'Booking changes' })).toBeNull();
    expect(mutation).toHaveBeenCalledTimes(1);
  });
});
