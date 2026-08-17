import { describe, expect, it } from 'vitest';

import { resolvePaymentInvoiceAdjustmentsTotal, type ShootDetails } from './paymentPageModel';

const shoot = (overrides: Partial<ShootDetails>): ShootDetails => ({
  id: 1,
  address: 'Test property',
  total_quote: 120,
  base_quote: 100,
  tax_amount: 0,
  services: [],
  ...overrides,
});

describe('resolvePaymentInvoiceAdjustmentsTotal', () => {
  it('reads the public API snake-case value', () => {
    expect(resolvePaymentInvoiceAdjustmentsTotal(shoot({ invoice_adjustments_total: 20 }))).toBe(20);
  });

  it('supports normalized camel-case data and never renders a negative charge', () => {
    expect(resolvePaymentInvoiceAdjustmentsTotal(shoot({ invoiceAdjustmentsTotal: 12.5 }))).toBe(12.5);
    expect(resolvePaymentInvoiceAdjustmentsTotal(shoot({ invoice_adjustments_total: -10 }))).toBe(0);
  });
});
