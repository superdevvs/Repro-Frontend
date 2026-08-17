import { describe, expect, it } from 'vitest';
import {
  addInvoiceAdjustmentToCatalogTotal,
  getShootEditCatalogServiceEntries,
} from './shootEditInvoiceAdjustments';

describe('shoot edit invoice adjustments', () => {
  it('keeps only real catalog identities from structured service rows', () => {
    const entries = getShootEditCatalogServiceEntries({
      services: [],
      serviceItems: [{
        id: 501,
        service_id: 10,
        name: 'HDR Photography',
      }, {
        id: 'invoice-adjustment-77',
        service_id: null,
        source: 'invoice_adjustment',
        is_invoice_adjustment: true,
        name: 'Rush fee',
      }],
    });

    expect(entries).toEqual([{
      id: '10',
      service_id: '10',
      name: 'HDR Photography',
      label: undefined,
    }]);
  });

  it('adds the invoice adjustment to the catalog total exactly once', () => {
    expect(addInvoiceAdjustmentToCatalogTotal(120, 25)).toBe(145);
  });
});
