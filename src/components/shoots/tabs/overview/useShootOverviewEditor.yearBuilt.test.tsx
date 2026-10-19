import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { submitShootServiceMutation } from '@/utils/shootServiceMutation';
import { useShootDetailsModalSave } from '../../modal/useShootDetailsModalSave';
import { useShootOverviewEditor } from './useShootOverviewEditor';

vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));
vi.mock('@/utils/shootServiceMutation', async (original) => ({
  ...await original<typeof import('@/utils/shootServiceMutation')>(), submitShootServiceMutation: vi.fn(),
}));
vi.mock('./shootOverviewEditorSupport', async (original) => ({
  ...await original<typeof import('./shootOverviewEditorSupport')>(),
  useOverviewLookupData: vi.fn(), usePhotographerAssignmentOptions: vi.fn(), usePhotographerDistanceAvailability: vi.fn(),
}));

const shoot = {
  id: '2405', editVersion: 'version-1', status: 'delivered', workflowStatus: 'delivered',
  scheduledDate: '2026-10-13', time: '10:00', canManageBooking: true,
  client: { id: '1198', name: 'Client' }, photographer: { id: '9', name: 'Photographer' },
  location: { address: '63 Inness Road', city: 'Tenafly', state: 'NJ', zip: '07670' },
  services: [], serviceItems: [{ service_id: 10, name: 'Photography', price: 660, quantity: 1 }],
  propertyDetails: { year_built: 1941, yearBuilt: 1941, bedrooms: 6, beds: 6, bathrooms: 7, baths: 7,
    sqft: 4500, squareFeet: 4500, custom_fact: { keep: true } },
  payment: { baseQuote: 660, totalQuote: 700.40, totalPaid: 700.40, taxAmount: 40.40, discountType: null, discountValue: null },
} as unknown as ShootData;

const mount = (record = shoot, isAdmin = false) => renderHook(() => {
  const toast = vi.fn();
  const save = useShootDetailsModalSave({
    shoot: record, setShoot: vi.fn(), setIsEditMode: vi.fn(), refreshShoot: vi.fn().mockResolvedValue(record),
    updateShoot: vi.fn().mockResolvedValue(undefined), toast, isRep: !isAdmin, isAdmin,
    canNotifyClient: true, canNotifyPhotographer: true,
  });
  const editor = useShootOverviewEditor({
    shoot: record, isAdmin, role: isAdmin ? 'admin' : 'salesRep', isEditMode: true,
    canEditServicePlan: isAdmin, onSave: save.handleSaveRequest, onShootUpdate: vi.fn(), toast,
  });
  return { editor, save, toast };
});

beforeEach(() => {
  localStorage.setItem('authToken', 'test-token');
  vi.mocked(submitShootServiceMutation).mockResolvedValue({ kind: 'success', data: { data: shoot } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
    enabled: false, status: 'available', available: true, reason_codes: [], transitions: [], alternatives: [],
    can_override: false, policy_version: '1', schedule_version: '1',
  } }))));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('Overview year built save', () => {
  it.each([false, true])('saves a unit correction in the street and property metadata (admin=%s)', async isAdmin => {
    const record = { ...shoot, address: '4016 47th St NW',
      location: { ...shoot.location, address: '4016 47th St NW, Unit 101' },
      propertyDetails: { ...shoot.propertyDetails, aptSuite: 'Unit 101' },
    } as ShootData;
    const { result } = mount(record, isAdmin);
    await waitFor(() => expect(result.current.editor.state.addressInput).toBe('4016 47th St NW'));
    act(() => result.current.editor.actions.updateField('location.address', '4016 47th St NW Unit 1'));
    if (isAdmin) await waitFor(() => expect(result.current.editor.travel.result?.enabled).toBe(false));
    await act(async () => { await result.current.editor.actions.handleSave(); });
    await act(async () => { await result.current.save.handleConfirmSave(); });
    expect(vi.mocked(submitShootServiceMutation).mock.calls[0][0].payload).toMatchObject({
      address: '4016 47th St NW Unit 1', property_details: { aptSuite: 'Unit 1', custom_fact: { keep: true } },
    });
  });

  it('does not feed a stale appended unit back into the address editor', async () => {
    const record = { ...shoot, address: '4016 47th St NW Unit 1',
      location: { ...shoot.location, address: '4016 47th St NW Unit 1, Unit 101' },
      propertyDetails: { ...shoot.propertyDetails, aptSuite: 'Unit 101' },
    } as ShootData;
    const { result } = mount(record);
    await waitFor(() => expect(result.current.editor.state.addressInput).toBe('4016 47th St NW Unit 1'));
    expect(result.current.editor.state.editedShoot.location?.address).toBe('4016 47th St NW Unit 1');
  });

  it('clears saved unit aliases when a unit is removed from the address', async () => {
    const record = { ...shoot, address: '4016 47th St NW Unit 101',
      location: { ...shoot.location, address: '4016 47th St NW, Unit 101' },
      propertyDetails: { ...shoot.propertyDetails, aptSuite: 'Unit 101', apt_suite: '101' },
    } as ShootData;
    const { result } = mount(record, true);
    await waitFor(() => expect(result.current.editor.state.addressInput).toContain('Unit 101'));
    act(() => result.current.editor.actions.updateField('location.address', '4016 47th St NW'));
    await waitFor(() => expect(result.current.editor.travel.result?.enabled).toBe(false));
    await act(async () => { await result.current.editor.actions.handleSave(); });
    await act(async () => { await result.current.save.handleConfirmSave(); });
    expect(vi.mocked(submitShootServiceMutation).mock.calls[0][0].payload).toMatchObject({
      address: '4016 47th St NW', property_details: { aptSuite: null, apt_suite: null },
    });
  });

  it.each([false, true])('sends only paired year aliases through existing confirmation (admin=%s)', async isAdmin => {
    const view = mount(shoot, isAdmin);
    await waitFor(() => expect(view.result.current.editor.state.propertyYearBuiltEdit).toBe('1941'));
    act(() => view.result.current.editor.actions.setPropertyYearBuiltEdit('2026'));
    await act(async () => { await view.result.current.editor.actions.handleSave(); });
    expect(submitShootServiceMutation).not.toHaveBeenCalled();
    await act(async () => { await view.result.current.save.handleConfirmSave(); });
    expect(submitShootServiceMutation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      url: expect.stringMatching(/\/api\/shoots\/2405$/),
      payload: { property_details: { year_built: 2026, yearBuilt: 2026 }, notify_client: true, notify_photographer: true, expected_edit_version: 'version-1' },
    }));
    expect(shoot.propertyDetails).toHaveProperty('custom_fact', { keep: true });
    view.unmount();
    const reopened = mount({ ...shoot, propertyDetails: { ...shoot.propertyDetails, year_built: 2026, yearBuilt: 2026 } });
    await waitFor(() => expect(reopened.result.current.editor.state.propertyYearBuiltEdit).toBe('2026'));
  });

  it('hydrates a legacy alias and clears both aliases without resurrecting the old year', async () => {
    const record = { ...shoot, propertyDetails: { ...shoot.propertyDetails, year_built: undefined, yearBuilt: 1941 } };
    const view = mount(record);
    await waitFor(() => expect(view.result.current.editor.state.propertyYearBuiltEdit).toBe('1941'));
    act(() => view.result.current.editor.actions.setPropertyYearBuiltEdit('  '));
    await act(async () => { await view.result.current.editor.actions.handleSave(); });
    await act(async () => { await view.result.current.save.handleConfirmSave(); });
    expect(vi.mocked(submitShootServiceMutation).mock.calls[0][0].payload).toEqual({
      property_details: { year_built: null, yearBuilt: null }, notify_client: true, notify_photographer: true, expected_edit_version: 'version-1',
    });
    view.unmount();
    const reopened = mount({ ...record, propertyDetails: { ...record.propertyDetails, year_built: null, yearBuilt: null } });
    await waitFor(() => expect(reopened.result.current.editor.state.propertyYearBuiltEdit).toBe(''));
  });

  it('keeps a deliberate discount when year built is edited at the same time', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.editor.state.propertyYearBuiltEdit).toBe('1941'));
    act(() => {
      result.current.editor.actions.setPropertyYearBuiltEdit('2026');
      result.current.editor.actions.updateField('payment.discountType', 'fixed');
      result.current.editor.actions.updateField('payment.discountValue', 30);
    });
    await act(async () => { await result.current.editor.actions.handleSave(); });
    await act(async () => { await result.current.save.handleConfirmSave(); });
    expect(vi.mocked(submitShootServiceMutation).mock.calls[0][0].payload).toMatchObject({
      discount_type: 'fixed', discount_value: 30, property_details: { year_built: 2026, yearBuilt: 2026 },
    });
  });

  it('preserves other property edits and existing custom facts in a mixed save', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.editor.state.propertyYearBuiltEdit).toBe('1941'));
    act(() => {
      result.current.editor.actions.setPropertyYearBuiltEdit('2026');
      result.current.editor.actions.setPropertyMetricsEdit({ beds: '8', baths: '7', sqft: '4500' });
    });
    await act(async () => { await result.current.editor.actions.handleSave(); });
    await act(async () => { await result.current.save.handleConfirmSave(); });
    expect(vi.mocked(submitShootServiceMutation).mock.calls[0][0].payload).toMatchObject({
      bedrooms: 8, property_details: { bedrooms: 8, beds: 8, year_built: 2026, yearBuilt: 2026, custom_fact: { keep: true } },
    });
  });

  it('keeps a changed service quantity with the year edit', async () => {
    const { result } = mount(shoot, true);
    await waitFor(() => expect(result.current.editor.state.selectedServiceIds).toEqual(['10']));
    act(() => {
      result.current.editor.actions.setPropertyYearBuiltEdit('2026');
      result.current.editor.actions.updateServiceQuantity('10', 2);
    });
    await waitFor(() => expect(result.current.editor.travel.result?.enabled).toBe(false));
    await act(async () => { await result.current.editor.actions.handleSave(); });
    await act(async () => { await result.current.save.handleConfirmSave(); });
    expect(vi.mocked(submitShootServiceMutation).mock.calls[0][0].payload).toMatchObject({
      property_details: { year_built: 2026, yearBuilt: 2026 },
      service_items: [expect.objectContaining({ service_id: 10, quantity: 2 })],
    });
  });

  it('keeps an address correction with the year edit and existing travel checks', async () => {
    const { result } = mount(shoot, true);
    await waitFor(() => expect(result.current.editor.state.propertyYearBuiltEdit).toBe('1941'));
    act(() => {
      result.current.editor.actions.setPropertyYearBuiltEdit('2026');
      result.current.editor.actions.updateField('location.address', '65 Inness Road');
    });
    await waitFor(() => expect(result.current.editor.travel.result?.enabled).toBe(false));
    await act(async () => { await result.current.editor.actions.handleSave(); });
    await act(async () => { await result.current.save.handleConfirmSave(); });
    expect(fetch).toHaveBeenCalled();
    expect(vi.mocked(submitShootServiceMutation).mock.calls[0][0].payload).toMatchObject({
      address: '65 Inness Road', property_details: { year_built: 2026, yearBuilt: 2026 },
    });
  });

  it.each(['1941.5', 'abc', '10000', '999', '-2026', '1e3'])('rejects invalid year %s before confirmation', async value => {
    const { result } = mount();
    await waitFor(() => expect(result.current.editor.state.propertyYearBuiltEdit).toBe('1941'));
    act(() => result.current.editor.actions.setPropertyYearBuiltEdit(value));
    await act(async () => { await result.current.editor.actions.handleSave(); });
    expect(result.current.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Check year built', variant: 'destructive' }));
    expect(result.current.save.isSaveConfirmOpen).toBe(false);
    expect(submitShootServiceMutation).not.toHaveBeenCalled();
  });
});
