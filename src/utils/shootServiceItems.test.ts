import { describe, expect, it } from 'vitest';

import {
  getShootInvoiceAdjustmentTotal,
  getShootServiceItems,
} from './shootServiceItems';

describe('invoice adjustment order rows', () => {
  it('normalizes nameless legacy service and invoice rows without losing their assigned photographer or totals', () => {
    const items = getShootServiceItems({ serviceItems: [
      { service_id: 10, price: 100, quantity: 2, photographer: { id: '7', name: 'Legacy Photographer' } },
      { id: 'invoice-adjustment-42', is_invoice_adjustment: true, price: 25, quantity: 1 },
    ] });
    expect(items[0]).toMatchObject({ name: 'Service', photographerName: 'Legacy Photographer', subtotal: 200 });
    expect(items[1]).toMatchObject({ name: 'Service', isInvoiceAdjustment: true, subtotal: 25, balanceDue: 0 });
  });
  it.each([undefined, null, 42, { oldLabel: 'Legacy' }])('tolerates a legacy name %j while respecting the no-photographer flag', name => {
    const [optional, digital, legacy] = getShootServiceItems({ serviceItems: [
      { service_id: 10, name, photographer_required: false, photographer: { id: '7', name: 'Legacy Photographer' } },
      { service_id: 51, name, category: { name: 'Digital Enhancements' }, photographer_required: true, photographer: { id: '7', name: 'Legacy Photographer' } },
      { service_id: 11, name, photographer_required: true, photographer: { id: '7', name: 'Legacy Photographer' } },
    ] });
    expect(optional.photographerName).toBeNull();
    expect(digital.photographerName).toBeNull();
    expect(legacy.photographerName).toBe('Legacy Photographer');
  });
  it('keeps the row visible but excludes it from service-level payment allocation', () => {
    const [adjustment] = getShootServiceItems({
      serviceItems: [{
        id: 'invoice-adjustment-42',
        name: 'Virtual Staging Charge',
        price: 25,
        unit_amount: 25,
        quantity: 2,
        subtotal: 50,
        balance_due: 50,
        source: 'invoice_adjustment',
        is_invoice_adjustment: true,
        is_deliverable: false,
      }],
    });

    expect(adjustment.name).toBe('Virtual Staging Charge');
    expect(adjustment.subtotal).toBe(50);
    expect(adjustment.isInvoiceAdjustment).toBe(true);
    expect(adjustment.isDeliverable).toBe(false);
    expect(adjustment.shootServiceId).toBeUndefined();
    expect(adjustment.balanceDue).toBe(0);
  });

  it('prefers the explicit aggregate and falls back to adjustment total_amount', () => {
    const adjustmentRow = {
      id: 'invoice-adjustment-42',
      name: 'Virtual Staging Charge',
      price: 25,
      unit_amount: 25,
      quantity: 2,
      subtotal: 50,
      total_amount: 80,
      source: 'invoice_adjustment',
      is_invoice_adjustment: true,
    };

    expect(getShootInvoiceAdjustmentTotal({
      serviceItems: [adjustmentRow],
      payment: {
        baseQuote: 0,
        taxRate: 0,
        taxAmount: 0,
        totalQuote: 0,
        totalPaid: 0,
        invoiceAdjustmentsTotal: 75,
      },
    })).toBe(75);

    expect(getShootInvoiceAdjustmentTotal({
      serviceItems: [adjustmentRow],
    })).toBe(80);

    expect(getShootInvoiceAdjustmentTotal({
      serviceItems: [adjustmentRow],
      invoiceAdjustmentsTotal: 0,
    })).toBe(80);

    expect(getShootInvoiceAdjustmentTotal({
      serviceItems: [{ ...adjustmentRow, bills_client: false }],
      invoiceAdjustmentsTotal: 0,
    })).toBe(0);

    expect(getShootInvoiceAdjustmentTotal({
      invoice_adjustments_total: '62.5',
    })).toBe(62.5);
  });
});
