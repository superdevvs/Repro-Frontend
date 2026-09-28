import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';

describe('multiple service normalization', () => {
  it('retains allow-multiple and booked quantity through both API service shapes', () => {
    const shoot = transformShootFromApi({
      id: 42,
      services: [{ id: 10, name: 'Photos', quantity: 25, allow_multiple: true, pivot: { quantity: 3, price: 100 } }],
      serviceItems: [
        { service_id: 10, shoot_service_id: 50, name: 'Photos', quantity: 3, price: 100, allow_multiple: '1' },
        { service_id: 11, shoot_service_id: 51, name: 'Floorplan', quantity: 2, price: 50, allow_multiple: false, service: { allow_multiple: true } },
      ],
    });
    expect(shoot.serviceObjects?.[0]).toMatchObject({ quantity: 3, allow_multiple: true });
    expect(shoot.serviceItems?.[0]).toMatchObject({ quantity: 3, price: 100, subtotal: 300, allow_multiple: true });
    expect(shoot.serviceItems?.[1]).toMatchObject({ quantity: 2, allow_multiple: false });
  });
});
