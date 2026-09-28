import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { useShootEditModalController } from './useShootEditModalController';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  projectFetched: (shoot: unknown) => shoot,
  buildPayload: (payload: unknown) => payload,
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => true }));
vi.mock('@/features/shoot-units/useUnitScopedEdit', () => ({
  useUnitScopedEdit: () => ({ projectFetched: mocks.projectFetched, buildPayload: mocks.buildPayload }),
  useUnitEditDirtyTracking: () => false,
}));
vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('./shootEditModalTypes', async (importOriginal) => ({
  ...await importOriginal<typeof import('./shootEditModalTypes')>(),
  loadPhotographerOptions: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  vi.mocked(axios.get).mockResolvedValue({ data: { data: [
    { id: 10, name: 'Photos', price: 100, allow_multiple: true, quantity: 25, photographer_required: false },
    { id: 11, name: 'Floorplan', price: 50, allow_multiple: false, quantity: 10, photographer_required: false },
  ] } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
    id: 42, address: '42 Service Lane', scheduled_at: '2026-10-01T10:00:00Z', timezone: 'UTC',
    service_items: [{ service_id: 10, name: 'Photos', price: 90, quantity: 2 }, { service_id: 11, name: 'Floorplan', price: 50, quantity: 3 }],
  } }) }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('shoot approval and modify service quantities', () => {
  it('hydrates booked counts, retains disabled counts and saves picker changes in both payload forms', async () => {
    const { result } = renderHook(() => useShootEditModalController({ isOpen: true, onClose: vi.fn(), shootId: '42', onSaved: vi.fn() }));
    await waitFor(() => expect(result.current.selectedServiceSelectionOptions).toHaveLength(2));
    expect(result.current.selectedServiceSelectionOptions.map(service => service.quantity)).toEqual([2, 3]);
    expect(result.current.selectedServiceSelectionOptions[0].allow_multiple).toBe(true);
    expect(result.current.selectedServiceSelectionOptions[0].price).toBe(90);
    expect(result.current.selectedServiceSelectionOptions[1].allow_multiple).toBe(false);
    expect(result.current.selectedServicesPricing.servicesTotal).toBe(330);
    act(() => result.current.handleSelectedServicesChange(result.current.selectedServiceSelectionOptions.map(service => (
      service.id === '10' ? { ...service, quantity: 4 } : service
    ))));
    expect(result.current.selectedServicesPricing.servicesTotal).toBe(510);
    const payload = result.current.buildApprovalPayload();
    expect(payload?.service_items).toEqual([
      expect.objectContaining({ service_id: 10, quantity: 4 }),
      expect.objectContaining({ service_id: 11, quantity: 3 }),
    ]);
    expect(payload?.services).toEqual([
      expect.objectContaining({ id: 10, quantity: 4 }),
      expect.objectContaining({ id: 11, quantity: 3 }),
    ]);
  });
});
