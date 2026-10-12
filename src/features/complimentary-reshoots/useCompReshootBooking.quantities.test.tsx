import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServicePackage } from '@/pages/bookShootModel';
import { normalizeCompReshootTemplate } from './model';
import { getComplimentaryReshootTemplate } from './api';
import { useCompReshootBooking } from './useCompReshootBooking';

vi.mock('./api', () => ({ getComplimentaryReshootTemplate: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

const options = (selectedServices: ServicePackage[], enabled = false) => ({
  selectedServices, enabled, sourceShootId: enabled ? '42' : null, photographerId: '9', servicePhotographers: {}, propertySqft: 2000,
  setClient: vi.fn(), setAddress: vi.fn(), setCity: vi.fn(), setState: vi.fn(), setZip: vi.fn(), setPropertyDetails: vi.fn(),
  setPropertySqft: vi.fn(), setSelectedServices: vi.fn(), setServicePhotographers: vi.fn(), setServiceSchedules: vi.fn(),
  setShootType: vi.fn(), setBypassPayment: vi.fn(), setAdjustedTotalInput: vi.fn(), remountPropertyForm: vi.fn(),
});
const service: ServicePackage = { id: '10', name: 'Photos', description: '', price: 100, photographer_pay: 75, quantity: 3 };

describe('complimentary return-visit quantity compensation', () => {
  it('restores the reason, custom compensation and retry key without clearing saved services', async () => {
    const draftCacheKey = 'booking-reshoot-test';
    localStorage.setItem(draftCacheKey, JSON.stringify({ address: 'Saved property', compReshootDraft: {
      sourceShootId: '42', idempotencyKey: 'same-retry-key', reasonCode: 'other', reasonNote: 'Saved reason',
      photographerMode: 'custom', serviceCompensations: { '10': { mode: 'custom', customAmount: '110' } },
      repMode: 'none', compensationDirty: true,
    } }));
    vi.mocked(getComplimentaryReshootTemplate).mockResolvedValue(normalizeCompReshootTemplate({
      source: { id: 42 }, client: { id: 8 }, source_service_items: [{ id: 501, service_id: 10, name: 'Photos' }],
    }));
    const props = { ...options([service], true), draftCacheKey };
    const { result } = renderHook(() => useCompReshootBooking(props));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.reasonCode).toBe('other'); expect(result.current.reasonNote).toBe('Saved reason');
    expect(result.current.idempotencyKey).toBe('same-retry-key'); expect(result.current.photographerMode).toBe('custom');
    expect(props.setSelectedServices).not.toHaveBeenCalledWith([]);
    act(() => result.current.setReasonNote('Updated reason'));
    expect(JSON.parse(localStorage.getItem(draftCacheKey)!).compReshootDraft.reasonNote).toBe('Updated reason');
    expect(JSON.parse(localStorage.getItem(draftCacheKey)!).address).toBe('Saved property');
  });
  it('multiplies the standard unit rate and keeps a custom line total exact', () => {
    const props = options([service]);
    const { result } = renderHook(() => useCompReshootBooking(props));
    act(() => result.current.setPhotographerMode('standard'));
    expect(result.current.getStandardPay(service)).toBe(225);
    expect(result.current.photographerCompensationTotal).toBe(225);
    act(() => {
      result.current.setPhotographerMode('custom');
      result.current.setServiceCompensationMode('10', 'custom');
      result.current.setServiceCustomAmount('10', '110');
    });
    expect(result.current.photographerCompensationTotal).toBe(110);
    expect(result.current.getServiceCompensation(service)).toEqual({ mode: 'custom', amount: 110 });
  });

  it('divides source line total before applying requested quantity when the catalog pay is unset', async () => {
    vi.mocked(getComplimentaryReshootTemplate).mockResolvedValue(normalizeCompReshootTemplate({
      source: { id: 42 }, client: { id: 8 },
      source_service_items: [{ id: 501, service_id: 10, name: 'Photos', quantity: 2, standard_photographer_pay: 150, nominal_total: 200 }],
    }));
    const noCatalogPay = { ...service, photographer_pay: null };
    const props = options([noCatalogPay], true);
    const { result } = renderHook(() => useCompReshootBooking(props));
    await waitFor(() => expect(result.current.getMappedSourceService('10')?.quantity).toBe(2));
    act(() => result.current.setPhotographerMode('standard'));
    expect(result.current.photographerCompensationTotal).toBe(225);
    expect(result.current.getStandardPay({ ...noCatalogPay, photographer_pay: 0 })).toBe(0);
  });
});
