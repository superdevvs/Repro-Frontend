import { describe, expect, it } from 'vitest';
import { getBookedServiceQuantities, getBookedServiceUnitPrices, normalizeBookingQuantity } from './bookedServiceQuantity';

describe('booked service quantities', () => {
  it('reads booked lines before aliases and never treats catalog item count as booking quantity', () => {
    expect(getBookedServiceQuantities({
      serviceItems: [{ service_id: 1, quantity: 3 }],
      serviceObjects: [{ id: 1, quantity: 1 }],
      services: [{ id: 1, quantity: 25, pivot: { quantity: 2 } }, { id: 2, quantity: 10 }, { id: 3, quantity: 25, pivot: { quantity: 4 } }],
    })).toEqual({ '1': 3, '3': 4 });
  });

  it('normalizes invalid booked counts to one', () => {
    for (const value of [null, undefined, 0, -2, 1.5, 'bad', Infinity]) expect(normalizeBookingQuantity(value)).toBe(1);
    expect(normalizeBookingQuantity('4')).toBe(4);
  });

  it('uses booked prices including zero ahead of catalog or alias amounts', () => {
    expect(getBookedServiceUnitPrices({
      serviceItems: [{ service_id: 1, quantity: 3, price: 90 }, { service_id: 2, price: 0 }],
      services: [{ id: 1, price: 100, pivot: { price: 95 } }, { id: 2, price: 100 }, { id: 3, price: 100, pivot: { price: 75 } }],
    })).toEqual({ '1': 90, '2': 0, '3': 75 });
  });
});
