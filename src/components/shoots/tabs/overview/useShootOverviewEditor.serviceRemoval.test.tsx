import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ShootData } from '@/types/shoots';
import { useShootOverviewEditor } from './useShootOverviewEditor';

vi.mock('@/hooks/useShootMutationRefresh', () => ({
  useShootMutationRefresh: () => vi.fn(),
}));

vi.mock('./shootOverviewEditorSupport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shootOverviewEditorSupport')>();

  return {
    ...actual,
    useOverviewLookupData: vi.fn(),
    usePhotographerAssignmentOptions: vi.fn(),
    usePhotographerDistanceAvailability: vi.fn(),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (!String(input).endsWith('/photographer/availability/feasibility')) throw new Error(`Unexpected fetch: ${String(input)}`);
    return new Response(JSON.stringify({ data: { enabled: false, status: 'available', available: true,
      reason_codes: [], transitions: [], alternatives: [], can_override: false, policy_version: '1', schedule_version: '1' } }));
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks(); vi.unstubAllGlobals();
});

const shoot = {
  id: 42,
  status: 'requested',
  workflowStatus: 'requested',
  scheduledDate: '2026-09-01',
  time: '10:00',
  location: {
    address: '42 Service Lane',
    city: 'Baltimore',
    state: 'MD',
    zip: '21201',
    fullAddress: '42 Service Lane, Baltimore, MD 21201',
  },
  services: [],
  serviceItems: [
    { service_id: 10, name: 'Photography', price: 100, quantity: 2 },
    { service_id: 11, name: 'Video', price: 50, quantity: 1 },
  ],
  serviceObjects: [],
  payment: {
    serviceSubtotal: 250,
    baseQuote: 250,
    discountAmount: 0,
    taxAmount: 0,
    totalQuote: 250,
    totalPaid: 0,
    remainingBalance: 250,
    paymentStatus: 'unpaid',
  },
  canRemoveAllServices: true,
} as unknown as ShootData;

describe('useShootOverviewEditor service mutation payload', () => {
  it('hydrates stored duration, edits one service and preserves both durations when applying date/time to all', async () => {
    const onSave = vi.fn();
    const durationShoot = { ...shoot, serviceItems: [
      { service_id: 10, name: 'Photography', price: 100, quantity: 2, duration_minutes: 30 },
      { service_id: 11, name: 'Video', price: 50, quantity: 1, duration_minutes: 85 },
    ] } as unknown as ShootData;
    const { result } = renderHook(() => useShootOverviewEditor({
      shoot: durationShoot, isAdmin: true, role: 'admin', isEditMode: true,
      onSave, onShootUpdate: vi.fn(), toast: vi.fn(),
    }));
    await waitFor(() => expect(result.current.state.selectedServiceIds).toEqual(['10', '11']));
    expect(result.current.state.serviceSchedules['10']).toEqual({ date: '', time: '', duration_minutes: 30 });
    expect(result.current.state.serviceSchedules['11'].duration_minutes).toBe(85);
    act(() => result.current.actions.updateServiceSchedule('11', 'duration_minutes', 120));
    act(() => result.current.actions.updateServiceSchedule('10', 'date', '2026-10-08'));
    act(() => result.current.actions.updateServiceSchedule('10', 'time', '12:00'));
    act(() => result.current.actions.applyServiceScheduleToAll('10'));
    await waitFor(() => expect(result.current.travel.result?.enabled).toBe(false));
    await act(async () => { await result.current.actions.handleSave(); });
    const payload = onSave.mock.calls.at(-1)?.[0];
    expect(payload.service_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: 10, duration_minutes: 30, scheduled_at: '2026-10-08T12:00:00' }),
      expect.objectContaining({ service_id: 11, duration_minutes: 120, scheduled_at: '2026-10-08T12:00:00' }),
    ]));
    expect(payload.services).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 10, duration_minutes: 30 }), expect.objectContaining({ id: 11, duration_minutes: 120 }),
    ]));
  });
  it('updates quantity, totals and save payload without changing the unit price', async () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useShootOverviewEditor({
      shoot, isAdmin: true, role: 'admin', isEditMode: true,
      onSave, onShootUpdate: vi.fn(), toast: vi.fn(),
    }));
    await waitFor(() => expect(result.current.state.selectedServiceIds).toEqual(['10', '11']));
    expect(result.current.state.serviceQuantities['10']).toBe(2);
    act(() => result.current.actions.updateServiceQuantity('10', 3));
    await waitFor(() => expect(result.current.state.editedShoot.payment?.serviceSubtotal).toBe(350));
    await waitFor(() => expect(result.current.travel.result?.enabled).toBe(false));
    await act(async () => { await result.current.actions.handleSave(); });
    const payload = onSave.mock.calls.at(-1)?.[0];
    expect(payload.service_items[0]).toEqual(expect.objectContaining({ service_id: 10, quantity: 3 }));
    expect(payload.services[0]).toEqual(expect.objectContaining({ id: 10, quantity: 3 }));
    expect(payload.service_items[0]).not.toHaveProperty('price');
  });

  it('starts a removed and reselected service at one without restoring its old count', async () => {
    const { result } = renderHook(() => useShootOverviewEditor({
      shoot, isAdmin: true, role: 'admin', isEditMode: true,
      onSave: vi.fn(), onShootUpdate: vi.fn(), toast: vi.fn(),
    }));
    await waitFor(() => expect(result.current.state.selectedServiceIds).toEqual(['10', '11']));
    act(() => result.current.actions.toggleServiceSelection('10'));
    act(() => result.current.actions.toggleServiceSelection('10'));
    await waitFor(() => expect(result.current.state.editedShoot.payment?.serviceSubtotal).toBe(150));
    expect(result.current.state.serviceQuantities['10']).toBe(1);
  });

  it('keeps edits open and explains a nonexistent daylight-saving time without saving', async () => {
    const onSave = vi.fn();
    const toast = vi.fn();
    const zonedShoot = { ...shoot, timezone: 'America/New_York' };
    const { result } = renderHook(() => useShootOverviewEditor({
      shoot: zonedShoot,
      isAdmin: true, role: 'admin', isEditMode: true,
      onSave, onShootUpdate: vi.fn(), toast,
    }));
    await waitFor(() => expect(result.current.state.selectedServiceIds).toEqual(['10', '11']));
    act(() => {
      result.current.actions.updateServiceSchedule('10', 'date', '2026-03-08');
      result.current.actions.updateServiceSchedule('10', 'time', '02:30');
    });
    await act(async () => { await result.current.actions.handleSave(); });
    expect(onSave).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('does not exist'), variant: 'destructive',
    }));
  });

  it('previews a changed discount and lets a booked discount be removed', async () => {
    const discountedShoot = {
      ...shoot,
      payment: { ...shoot.payment, discountType: 'fixed' as const, discountValue: 30, discountAmount: 30, taxRate: 0.06 },
    };
    const { result } = renderHook(() => useShootOverviewEditor({
      shoot: discountedShoot, isAdmin: true, role: 'admin', isEditMode: true,
      onSave: vi.fn(), onShootUpdate: vi.fn(), toast: vi.fn(),
    }));
    await waitFor(() => expect(result.current.state.editedShoot.payment?.baseQuote).toBe(220));
    act(() => result.current.actions.updateField('payment.discountValue', 40));
    await waitFor(() => expect(result.current.state.editedShoot.payment?.totalQuote).toBe(222.6));
    act(() => {
      result.current.actions.updateField('payment.discountType', null);
      result.current.actions.updateField('payment.discountValue', null);
    });
    await waitFor(() => expect(result.current.state.editedShoot.payment?.totalQuote).toBe(265));
    expect(result.current.state.editedShoot.payment?.discountAmount).toBe(0);
  });

  it('keeps an intentional empty selection and leaves retained prices and quantities to the server', async () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useShootOverviewEditor({
      shoot,
      isAdmin: true,
      role: 'admin',
      isEditMode: true,
      onSave,
      onShootUpdate: vi.fn(),
      toast: vi.fn(),
    }));

    await waitFor(() => {
      expect(result.current.state.selectedServiceIds).toEqual(['10', '11']);
    });
    await waitFor(() => {
      expect(result.current.state.editedShoot.payment?.serviceSubtotal).toBe(250);
    });

    await waitFor(() => expect(result.current.travel.result?.enabled).toBe(false));
    await act(async () => { await result.current.actions.handleSave(); });
    const retainedPayload = onSave.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(retainedPayload.services).toEqual([
      expect.not.objectContaining({ price: expect.anything(), quantity: expect.anything() }),
      expect.not.objectContaining({ price: expect.anything(), quantity: expect.anything() }),
    ]);

    act(() => {
      result.current.actions.toggleServiceSelection('10');
      result.current.actions.toggleServiceSelection('11');
    });

    await waitFor(() => {
      expect(result.current.state.selectedServiceIds).toEqual([]);
    });
    expect(result.current.state.selectedServiceIds).toEqual([]);

    await waitFor(() => expect(result.current.travel.result?.enabled).toBe(false));
    await act(async () => { await result.current.actions.handleSave(); });
    const emptyPayload = onSave.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(emptyPayload.services).toEqual([]);
    expect(emptyPayload.service_items).toEqual([]);
  });
});
