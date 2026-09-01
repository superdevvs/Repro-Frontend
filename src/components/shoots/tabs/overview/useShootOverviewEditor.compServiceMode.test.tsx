import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const buildShoot = (withPhotographer = true) => ({
  id: '42',
  status: 'scheduled',
  workflowStatus: 'scheduled',
  scheduledDate: '2026-09-01',
  time: '10:00',
  location: {
    address: '42 Service Lane',
    city: 'Baltimore',
    state: 'MD',
    zip: '21201',
    fullAddress: '42 Service Lane, Baltimore, MD 21201',
  },
  client: {
    id: 4,
    name: 'Client',
    email: 'client@example.test',
    totalShoots: 1,
    rep: { id: 18, name: 'Robin Rep' },
  },
  photographer: withPhotographer
    ? { id: 9, name: 'Pat Photographer', email: 'pat@example.test' }
    : { name: '', email: '' },
  services: ['Photography'],
  serviceItems: [{
    id: 501,
    shoot_service_id: 501,
    service_id: 10,
    name: 'Photography',
    price: 125,
    photographer: withPhotographer ? { id: 9, name: 'Pat Photographer' } : null,
  }],
  serviceObjects: [],
  payment: {
    serviceSubtotal: 125,
    baseQuote: 125,
    totalQuote: 125,
    totalPaid: 0,
  },
  canRemoveAllServices: true,
}) as unknown as ShootData;

const renderEditor = (shoot = buildShoot()) => {
  const onSave = vi.fn();
  const toast = vi.fn();
  const hook = renderHook(() => useShootOverviewEditor({
    shoot,
    isAdmin: true,
    role: 'admin',
    isEditMode: true,
    onSave,
    onShootUpdate: vi.fn(),
    toast,
  }));
  return { ...hook, onSave, toast };
};

describe('useShootOverviewEditor complimentary service mode', () => {
  it('keeps a separate comp selection when the same catalog service is already booked', async () => {
    const { result } = renderEditor();

    await waitFor(() => expect(result.current.state.selectedServiceIds).toEqual(['10']));
    expect(result.current.compSourceServiceOptions[0]).toMatchObject({
      sourceShootServiceId: '501',
      catalogServiceId: '10',
      name: 'Photography',
    });

    act(() => {
      result.current.actions.setCompServiceMode(true);
      result.current.actions.toggleCompServiceSelection('501');
    });

    expect(result.current.state.isCompServiceMode).toBe(true);
    expect(result.current.state.selectedServiceIds).toEqual(['10']);
    expect(result.current.state.selectedCompSourceServiceIds).toEqual(['501']);

    act(() => result.current.actions.setCompServiceMode(false));

    expect(result.current.state.selectedServiceIds).toEqual(['10']);
    expect(result.current.state.selectedCompSourceServiceIds).toEqual(['501']);
  });

  it('requires a reason plus a date, time, and photographer before saving a comp service', async () => {
    const { result, onSave, toast } = renderEditor(buildShoot(false));
    await waitFor(() => expect(result.current.state.selectedServiceIds).toEqual(['10']));

    act(() => result.current.actions.toggleCompServiceSelection('501'));
    act(() => result.current.actions.handleSave());
    expect(onSave).not.toHaveBeenCalled();
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Choose a comp reason' }));

    act(() => {
      result.current.actions.setCompReasonCode('company_error');
      result.current.actions.updateCompServiceSchedule('501', 'date', '2026-09-12');
      result.current.actions.updateCompServiceSchedule('501', 'time', '11:30');
    });
    act(() => result.current.actions.handleSave());

    expect(onSave).not.toHaveBeenCalled();
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Finish the comp schedule' }));
  });

  it('adds the transactional comp contract without resubmitting ordinary paid services', async () => {
    const { result, onSave } = renderEditor();
    await waitFor(() => expect(result.current.state.selectedServiceIds).toEqual(['10']));

    act(() => {
      result.current.actions.toggleCompServiceSelection('501');
      result.current.actions.setCompReasonCode('company_error');
      result.current.actions.setPayCompPhotographer(true);
      result.current.actions.setPayCompSalesRep(true);
      result.current.actions.updateCompServiceSchedule('501', 'date', '2026-09-12');
      result.current.actions.updateCompServiceSchedule('501', 'time', '11:30');
    });
    act(() => result.current.actions.handleSave());

    const payload = onSave.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('services');
    expect(payload).not.toHaveProperty('service_items');
    expect(payload).not.toHaveProperty('service_photographers');
    expect(payload.complimentary_service_options).toEqual({
      idempotency_key: expect.stringMatching(/^[0-9a-f-]{36}$/),
      reason_code: 'company_error',
      pay_photographer: true,
      pay_sales_rep: true,
      service_items: [{
        source_shoot_service_id: 501,
        service_id: 10,
        photographer_id: 9,
        scheduled_at: '2026-09-12T11:30:00',
      }],
    });
  });

  it('asks the admin to save ordinary service changes before a comp return visit', async () => {
    const { result, onSave, toast } = renderEditor();
    await waitFor(() => expect(result.current.state.selectedServiceIds).toEqual(['10']));

    act(() => {
      result.current.actions.toggleCompServiceSelection('501');
      result.current.actions.toggleServiceSelection('10');
    });
    act(() => result.current.actions.handleSave());

    expect(onSave).not.toHaveBeenCalled();
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({
      title: 'Save standard service changes first',
    }));
  });
});
