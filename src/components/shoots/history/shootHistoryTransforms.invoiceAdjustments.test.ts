import { describe, expect, it } from 'vitest';
import {
  getShootInvoiceAdjustmentTotal,
  getShootServiceItems,
} from '@/utils/shootServiceItems';
import { mapShootApiToShootData } from './shootHistoryTransforms';

describe('shoot history invoice adjustments', () => {
  it('keeps adjustments out of operational service identity and maps order totals', () => {
    const shoot = mapShootApiToShootData({
      id: 42,
      address: '123 Main St',
      services: [{
        id: 10,
        name: 'HDR Photography',
        price: 100,
        quantity: 1,
      }],
      services_list: ['HDR Photography', 'Rush fee'],
      serviceItems: [{
        id: 501,
        service_id: 10,
        shoot_service_id: 501,
        name: 'HDR Photography',
        price: 100,
        quantity: 1,
        subtotal: 100,
      }, {
        id: 'invoice-adjustment-77',
        invoice_id: 9,
        invoice_item_id: 77,
        source: 'invoice_adjustment',
        isInvoiceAdjustment: true,
        service_id: null,
        shoot_service_id: null,
        name: 'Rush fee',
        price: 25,
        unitAmount: 25,
        quantity: 1,
        subtotal: 25,
        totalAmount: 25,
        billsClient: true,
        chargeType: 'rush',
        isDeliverable: false,
        balanceDue: 25,
      }],
      total_quote: 125,
      payment: {
        invoiceAdjustmentsTotal: 25,
        orderTotal: 125,
      },
    });

    const rawAdjustment = shoot.serviceItems?.find((item) => item.id === 'invoice-adjustment-77');
    expect(rawAdjustment).toMatchObject({
      invoiceId: '9',
      invoiceItemId: '77',
      source: 'invoice_adjustment',
      isInvoiceAdjustment: true,
      serviceId: null,
      shootServiceId: null,
      unitAmount: 25,
      totalAmount: 25,
      billsClient: true,
      chargeType: 'rush',
      isDeliverable: false,
    });

    const adjustment = getShootServiceItems(shoot).find((item) => item.isInvoiceAdjustment);
    expect(adjustment).toMatchObject({
      id: 'invoice-adjustment-77',
      serviceId: undefined,
      shootServiceId: undefined,
      subtotal: 25,
      balanceDue: 0,
      isDeliverable: false,
    });
    expect(shoot.payment.invoiceAdjustmentsTotal).toBe(25);
    expect(shoot.payment.orderTotal).toBe(125);
    expect(shoot.services).toEqual(['HDR Photography', 'Rush fee']);
  });

  it('replaces a stale zero aggregate with the billable adjustment totalAmount', () => {
    const shoot = mapShootApiToShootData({
      id: 42,
      serviceItems: [{
        id: 'invoice-adjustment-77',
        source: 'invoice_adjustment',
        isInvoiceAdjustment: true,
        service_id: null,
        shoot_service_id: null,
        name: 'Rush fee',
        unitAmount: 25,
        quantity: 2,
        subtotal: 25,
        totalAmount: 50,
      }],
      invoice_adjustments_total: 0,
    });

    expect(shoot.payment.invoiceAdjustmentsTotal).toBe(50);
    expect(getShootInvoiceAdjustmentTotal(shoot)).toBe(50);
  });
});
