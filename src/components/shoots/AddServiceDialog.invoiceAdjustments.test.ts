import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import {
  calculateAddServiceQuote,
  getCatalogServiceEntries,
} from './addServiceInvoiceAdjustments';

describe('AddServiceDialog invoice adjustments', () => {
  it('excludes billing rows from catalog payloads and adds their total once', () => {
    const shoot = {
      services: [],
      serviceItems: [{
        id: '501',
        service_id: '10',
        shoot_service_id: '501',
        name: 'HDR Photography',
        price: 100,
        quantity: 1,
      }, {
        id: 'invoice-adjustment-77',
        service_id: null,
        shoot_service_id: null,
        source: 'invoice_adjustment',
        is_invoice_adjustment: true,
        name: 'Rush fee',
        price: 25,
        subtotal: 25,
        quantity: 1,
      }],
    } as Pick<ShootData, 'serviceItems' | 'service_items' | 'serviceObjects' | 'services'>;

    const catalogEntries = getCatalogServiceEntries(shoot);
    expect(catalogEntries).toHaveLength(1);
    expect(catalogEntries[0]).toMatchObject({ service_id: '10' });

    const quote = calculateAddServiceQuote(
      [
        { price: 100, quantity: 1 },
        { price: 50, quantity: 1 },
      ],
      10,
      25,
    );
    expect(quote).toEqual({
      baseQuote: 150,
      taxAmount: 15,
      totalQuote: 190,
    });

    expect(calculateAddServiceQuote(
      [{ price: 150, quantity: 1 }],
      0.1,
      25,
    )).toEqual(quote);
  });
});
