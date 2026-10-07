import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ShootData } from '@/types/shoots';
import { submitShootServiceMutation } from '@/utils/shootServiceMutation';
import { useShootDetailsModalSave } from './useShootDetailsModalSave';

vi.mock('@/utils/shootServiceMutation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/shootServiceMutation')>();
  return { ...actual, submitShootServiceMutation: vi.fn() };
});

const shoot = {
  id: '42',
  scheduledDate: '2026-09-01',
  time: '10:00',
  client: { name: 'Client', email: 'client@example.test', totalShoots: 1 },
  photographer: { id: 9, name: 'Pat' },
  location: { address: '42 Service Lane', city: 'Baltimore', state: 'MD', zip: '21201', fullAddress: '42 Service Lane' },
  services: ['Photography'],
  payment: { baseQuote: 125, totalQuote: 125, totalPaid: 0 },
} as unknown as ShootData;

describe('useShootDetailsModalSave comp forwarding', () => {
  it('saves the staged day adjustment and separate notification choices through Overview confirmation', async () => {
    const adjustment = { shoot_id: 43, photographer_id: 9, from_start: '2026-09-01T14:30:00Z',
      scheduled_at: '2026-09-01T13:00:00Z', expected_edit_version: 'a'.repeat(64) };
    const { result } = renderHook(() => useShootDetailsModalSave({
      shoot, setShoot: vi.fn(), setIsEditMode: vi.fn(), refreshShoot: vi.fn().mockResolvedValue(shoot),
      updateShoot: vi.fn().mockResolvedValue(undefined), toast: vi.fn(),
      canNotifyClient: true, canNotifyPhotographer: true, isRep: true,
    }));
    act(() => result.current.handleSaveRequest({ schedule_adjustments: [adjustment],
      notify_client: false, notify_photographer: true } as never));
    expect(result.current.notifyClientOnSave).toBe(false);
    expect(result.current.notifyPhotographerOnSave).toBe(true);
    expect(submitShootServiceMutation).not.toHaveBeenCalled();
    await act(async () => result.current.handleConfirmSave());
    expect(submitShootServiceMutation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      payload: { schedule_adjustments: [adjustment], notify_client: false, notify_photographer: true },
    }));
  });

  it('does not enable notifications when the user lacks that permission', async () => {
    const { result } = renderHook(() => useShootDetailsModalSave({
      shoot, setShoot: vi.fn(), setIsEditMode: vi.fn(), refreshShoot: vi.fn().mockResolvedValue(shoot),
      updateShoot: vi.fn().mockResolvedValue(undefined), toast: vi.fn(),
      canNotifyClient: false, canNotifyPhotographer: true,
    }));
    act(() => result.current.handleSaveRequest({ notify_client: true, notify_photographer: false } as never));
    expect(result.current.notifyClientOnSave).toBe(false);
    expect(result.current.notifyPhotographerOnSave).toBe(false);
    await act(async () => result.current.handleConfirmSave());
    expect(submitShootServiceMutation).toHaveBeenCalledWith(expect.objectContaining({
      payload: { notify_client: false, notify_photographer: false },
    }));
  });

  it('forwards changed discount inputs without client-computed prices', async () => {
    const { result } = renderHook(() => useShootDetailsModalSave({
      shoot, setShoot: vi.fn(), setIsEditMode: vi.fn(), refreshShoot: vi.fn().mockResolvedValue(shoot),
      updateShoot: vi.fn().mockResolvedValue(undefined), toast: vi.fn(),
      canNotifyClient: false, canNotifyPhotographer: false,
    }));
    await act(async () => {
      await result.current.handleSaveChanges({
        payment: { ...shoot.payment, discountType: 'fixed', discountValue: 30, discountAmount: 30, baseQuote: 95, totalQuote: 95 },
      });
    });
    expect(submitShootServiceMutation).toHaveBeenCalledWith(expect.objectContaining({
      payload: { discount_type: 'fixed', discount_value: 30 },
    }));
  });

  beforeEach(() => {
    localStorage.setItem('authToken', 'test-token');
    vi.mocked(submitShootServiceMutation).mockResolvedValue({
      kind: 'success',
      data: { data: shoot },
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('forwards complimentary_service_options unchanged in the existing PATCH payload', async () => {
    const complimentaryOptions = {
      idempotency_key: '11111111-1111-4111-8111-111111111111',
      reason_code: 'company_error',
      pay_photographer: true,
      pay_sales_rep: false,
      service_items: [{
        source_shoot_service_id: 501,
        service_id: 10,
        photographer_id: 9,
        scheduled_at: '2026-09-12T11:30:00',
      }],
    };
    const setShoot = vi.fn();
    const updateShoot = vi.fn().mockResolvedValue(undefined);
    const refreshShoot = vi.fn().mockResolvedValue(shoot);
    const { result } = renderHook(() => useShootDetailsModalSave({
      shoot,
      setShoot,
      setIsEditMode: vi.fn(),
      refreshShoot,
      updateShoot,
      toast: vi.fn(),
      canNotifyClient: false,
      canNotifyPhotographer: false,
    }));

    await act(async () => {
      await result.current.handleSaveChanges({
        complimentary_service_options: complimentaryOptions,
      } as never);
    });

    expect(submitShootServiceMutation).toHaveBeenCalledWith(expect.objectContaining({
      payload: { complimentary_service_options: complimentaryOptions },
    }));
  });

  it('strips photographer_id from services/service_items and keeps service_photographers', async () => {
    const { result } = renderHook(() => useShootDetailsModalSave({
      shoot, setShoot: vi.fn(), setIsEditMode: vi.fn(), refreshShoot: vi.fn().mockResolvedValue(shoot),
      updateShoot: vi.fn().mockResolvedValue(undefined), toast: vi.fn(),
      canNotifyClient: false, canNotifyPhotographer: false,
    }));

    await act(async () => {
      await result.current.handleSaveChanges({
        photographer: { id: 1163, name: 'Lee Gedansky' },
        services: [{
          id: 19,
          scheduled_at: '2026-09-30T18:30:00.000Z',
          photographer_id: 1163,
          photographer_pay: 75,
        }],
        service_items: [{
          service_id: 19,
          scheduled_at: '2026-09-30T18:30:00.000Z',
          photographer_id: 1163,
          price: 180,
        }],
        service_photographers: [{ service_id: 19, photographer_id: 1163 }],
      } as never);
    });

    expect(submitShootServiceMutation).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(submitShootServiceMutation).mock.calls[0][0].payload;
    expect(payload.photographer_id).toBe(1163);
    expect(payload.service_photographers).toEqual([{ service_id: 19, photographer_id: 1163 }]);
    expect(payload.services).toEqual([{
      id: 19,
      scheduled_at: '2026-09-30T18:30:00.000Z',
      photographer_pay: 75,
    }]);
    expect(payload.service_items).toEqual([{
      service_id: 19,
      scheduled_at: '2026-09-30T18:30:00.000Z',
      price: 180,
    }]);
    expect(JSON.stringify(payload.services)).not.toContain('photographer_id');
    expect(JSON.stringify(payload.service_items)).not.toContain('photographer_id');
  });

  it('preserves sales rep client, property and assignment edits without stale price echoes', async () => {
    const { result } = renderHook(() => useShootDetailsModalSave({
      shoot, setShoot: vi.fn(), setIsEditMode: vi.fn(), refreshShoot: vi.fn().mockResolvedValue(shoot),
      updateShoot: vi.fn().mockResolvedValue(undefined), toast: vi.fn(),
      canNotifyClient: true, canNotifyPhotographer: true, isAdmin: false, isRep: true,
    }));

    await act(async () => {
      await result.current.handleSaveChanges({
        scheduledDate: '2026-09-01',
        time: '10:00',
        photographer: { id: 1163, name: 'Lee Gedansky' },
        location: { address: '42 Service Lane', city: 'Baltimore', state: 'MD', zip: '21201', fullAddress: '42 Service Lane' },
        client: { id: 9, name: 'Client', email: 'client@example.test', totalShoots: 1 },
        propertyDetails: { sqft: 1200, presenceOption: 'self', source: 'echo' },
        services: [{ id: 19, scheduled_at: null, photographer_id: 1163 }],
        service_items: [{ service_id: 19, scheduled_at: null, photographer_id: 1163 }],
        service_photographers: [{ service_id: 19, photographer_id: 1163 }],
      } as never, { notifyClient: false, notifyPhotographer: true });
    });

    expect(submitShootServiceMutation).toHaveBeenCalledWith(expect.objectContaining({
      payload: {
        client_id: 9,
        address: '42 Service Lane', city: 'Baltimore', state: 'MD', zip: '21201', sqft: 1200,
        property_details: { presenceOption: 'self', source: 'echo', sqft: 1200, squareFeet: 1200 },
        photographer_id: 1163,
        service_photographers: [{ service_id: 19, photographer_id: 1163 }],
        notify_client: false,
        notify_photographer: true,
      },
    }));
  });
});
