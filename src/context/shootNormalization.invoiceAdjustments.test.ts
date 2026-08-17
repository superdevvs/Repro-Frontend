import { describe, expect, it } from 'vitest';
import {
  getShootInvoiceAdjustmentTotal,
  getShootServiceItems,
} from '@/utils/shootServiceItems';
import { transformShootFromApi } from './shootNormalization';

describe('transformShootFromApi invoice adjustments', () => {
  it('preserves billing metadata without manufacturing service identifiers', () => {
    const shoot = transformShootFromApi({
      id: 42,
      address: '123 Main St',
      services: [{
        id: 10,
        name: 'HDR Photography',
        price: 100,
      }],
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
        is_invoice_adjustment: true,
        service_id: null,
        shoot_service_id: null,
        name: 'Rush fee',
        price: 25,
        unit_amount: 25,
        quantity: 1,
        subtotal: 25,
        total_amount: 25,
        bills_client: true,
        charge_type: 'rush',
        is_deliverable: false,
        balance_due: 25,
      }],
      total_quote: 125,
      invoice_adjustments_total: 25,
      order_total: 125,
    });

    const rawAdjustment = shoot.serviceItems?.find((item) => item.id === 'invoice-adjustment-77');
    expect(rawAdjustment).toMatchObject({
      id: 'invoice-adjustment-77',
      invoice_id: '9',
      invoice_item_id: '77',
      source: 'invoice_adjustment',
      is_invoice_adjustment: true,
      service_id: null,
      shoot_service_id: null,
      unit_amount: 25,
      total_amount: 25,
      bills_client: true,
      charge_type: 'rush',
      is_deliverable: false,
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
  });

  it('derives an omitted aggregate from adjustment total_amount', () => {
    const shoot = transformShootFromApi({
      id: 42,
      serviceItems: [{
        id: 'invoice-adjustment-77',
        source: 'invoice_adjustment',
        is_invoice_adjustment: true,
        service_id: null,
        shoot_service_id: null,
        name: 'Rush fee',
        unit_amount: 25,
        quantity: 2,
        subtotal: 25,
        total_amount: 50,
      }],
    });

    expect(shoot.payment.invoiceAdjustmentsTotal).toBe(50);
    expect(getShootInvoiceAdjustmentTotal(shoot)).toBe(50);
  });
});
