import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServicePackage } from '@/pages/bookShootModel';
import { normalizeCompReshootTemplate } from './model';
import { getComplimentaryReshootTemplate } from './api';
import { useCompReshootBooking } from './useCompReshootBooking';

vi.mock('./api', () => ({ getComplimentaryReshootTemplate: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const options = (selectedServices: ServicePackage[], enabled = false) => ({
  selectedServices, enabled, sourceShootId: enabled ? '42' : null, photographerId: '9', servicePhotographers: {}, propertySqft: 2000,
  setClient: vi.fn(), setAddress: vi.fn(), setCity: vi.fn(), setState: vi.fn(), setZip: vi.fn(), setPropertyDetails: vi.fn(),
  setPropertySqft: vi.fn(), setSelectedServices: vi.fn(), setServicePhotographers: vi.fn(), setServiceSchedules: vi.fn(),
  setShootType: vi.fn(), setBypassPayment: vi.fn(), setAdjustedTotalInput: vi.fn(), remountPropertyForm: vi.fn(),
});
const service: ServicePackage = { id: '10', name: 'Photos', description: '', price: 100, photographer_pay: 75, quantity: 3 };

describe('complimentary return-visit quantity compensation', () => {
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
