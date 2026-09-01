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
});
