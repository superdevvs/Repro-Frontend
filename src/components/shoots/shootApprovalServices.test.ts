import { describe, expect, it } from 'vitest';
import { getApprovalPricing, getApprovalServices } from './shootApprovalServices';

describe('approval quantity pricing', () => {
  it('retains tax when an older response omits the rate and recalculates an unstored tax amount', () => {
    const shoot = { service_items: [{ service_id: 10, price: 100, quantity: 2 }], payment: { baseQuote: 200, taxAmount: 20 } };
    const services = getApprovalServices(shoot);
    expect(getApprovalPricing(shoot, services, { '10': 3 })).toEqual({ baseQuote: 300, taxAmount: 30, totalQuote: 330 });
    expect(getApprovalPricing({ ...shoot, tax_percent: 10, payment: { baseQuote: 200, taxAmount: 0 } }, services, { '10': 2 }))
      .toEqual({ baseQuote: 200, taxAmount: 20, totalQuote: 220 });
  });

  it('preserves percentage discounts, tax and invoice adjustments after quantity changes', () => {
    const shoot = {
      service_items: [{ service_id: 10, price: 100, quantity: 2 }, { id: 'fee', is_invoice_adjustment: true, price: 25, total_amount: 25, quantity: 1 }],
      services: [{ id: 10, name: 'Photos', allow_multiple: true, price: 150 }],
      discount_type: 'percent', discount_value: 10, tax_percent: 10,
      payment: { baseQuote: 180, taxAmount: 18, totalQuote: 223 },
    };
    const services = getApprovalServices(shoot);
    expect(services).toHaveLength(1);
    expect(getApprovalPricing(shoot, services, { '10': 2 })).toEqual({ baseQuote: 180, taxAmount: 18, totalQuote: 223 });
    expect(getApprovalPricing(shoot, services, { '10': 3 })).toEqual({ baseQuote: 270, taxAmount: 27, totalQuote: 322 });
  });
});
