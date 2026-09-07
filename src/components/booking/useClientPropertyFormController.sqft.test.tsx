import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useClientPropertyFormController, type ClientPropertyFormProps, type PackageOption } from './useClientPropertyFormController';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(cleanup);

const service: PackageOption = {
  id: '10', name: 'Area-based photography', description: '', price: 400, pricing_type: 'variable',
  sqft_ranges: [
    { sqft_from: 1, sqft_to: 1500, price: 310, photographer_pay: 100, duration: 60 },
    { sqft_from: 1501, sqft_to: 2500, price: 400, photographer_pay: 125, duration: 90 },
  ],
};

const props = (): ClientPropertyFormProps => ({
  initialData: {
    clientId: '1', clientName: 'Test client', clientEmail: '', clientPhone: '', clientCompany: '',
    propertyType: 'residential', propertyAddress: 'Test Street', propertyCity: 'Baltimore', propertyState: 'MD', propertyZip: '21201',
    sqft: 1800, bedRooms: 3, bathRooms: 2,
    property_details: { sqft: 1800, squareFeet: 1800, livingArea: 1800, living_area: 1800, square_feet: 1800, zpid: 'old-property' },
  },
  isClientAccount: true, clients: [], packages: [service], selectedServices: [service],
  onComplete: vi.fn(), onPropertyDraftChange: vi.fn(), onSelectedServicesChange: vi.fn(),
});

describe('booking square footage consistency', () => {
  it('seeds an existing lookup-only draft into the visible field before pricing', () => {
    const input = props();
    input.initialData.sqft = undefined;
    const { result } = renderHook(() => useClientPropertyFormController(input));
    expect(result.current.form.getValues('sqft')).toBe(1800);
    expect(result.current.effectiveSqft).toBe(1800);
  });

  it('uses a manual correction for the selected pricing tier and every saved sqft alias', async () => {
    const input = props();
    const { result } = renderHook(() => useClientPropertyFormController(input));
    act(() => result.current.form.setValue('sqft', 1370, { shouldDirty: true }));

    await waitFor(() => expect(result.current.effectiveSqft).toBe(1370));
    expect(input.onSelectedServicesChange).toHaveBeenLastCalledWith([expect.objectContaining({ price: 310 })]);
    const draft = result.current.buildPropertyDraftData();
    expect(draft.sqft).toBe(1370);
    expect(draft.property_details).toMatchObject({ sqft: 1370, squareFeet: 1370, livingArea: 1370, living_area: 1370, square_feet: 1370 });
    act(() => result.current.handleSubmit(result.current.form.getValues()));
    expect(input.onComplete).toHaveBeenLastCalledWith(expect.objectContaining({
      sqft: 1370, property_details: expect.objectContaining({ sqft: 1370, squareFeet: 1370 }),
    }));
  });

  it('does not use stale provider footage after the manual field is cleared', async () => {
    const input = props();
    const { result } = renderHook(() => useClientPropertyFormController(input));
    act(() => result.current.form.setValue('sqft', undefined, { shouldDirty: true }));
    expect(result.current.effectiveSqft).toBeNull();
    const details = result.current.buildPropertyDraftData().property_details;
    for (const key of ['sqft', 'squareFeet', 'square_feet', 'livingArea', 'living_area']) {
      expect(details?.[key]).toBeUndefined();
    }
    let valid = true;
    await act(async () => { valid = await result.current.form.trigger('sqft'); });
    expect(valid).toBe(false);
  });

  it('removes old lookup metadata when a different address selection begins', () => {
    const input = props();
    const { result } = renderHook(() => useClientPropertyFormController(input));
    act(() => result.current.clearAddressDerivedState({ keepSearchField: false }));
    const draft = vi.mocked(input.onPropertyDraftChange!).mock.calls.at(-1)?.[0];
    expect(draft?.property_details?.zpid).toBeUndefined();
    expect(draft?.property_details?.livingArea).toBeUndefined();
    expect(result.current.effectiveSqft).toBeNull();
  });
});
