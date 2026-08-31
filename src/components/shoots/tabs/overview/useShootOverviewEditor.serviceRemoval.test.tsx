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

    act(() => result.current.actions.handleSave());
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

    act(() => result.current.actions.handleSave());
    const emptyPayload = onSave.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(emptyPayload.services).toEqual([]);
    expect(emptyPayload.service_items).toEqual([]);
  });
});
