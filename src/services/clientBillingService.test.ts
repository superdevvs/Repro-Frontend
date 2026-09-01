import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getRequest } = vi.hoisted(() => ({ getRequest: vi.fn() }));

vi.mock('@/services/api', () => ({
  apiClient: { get: getRequest },
}));

import { fetchClientBilling, toClientBillingInvoiceViewData } from './clientBillingService';

describe('client billing complimentary receipts', () => {
  beforeEach(() => getRequest.mockReset());

  it('preserves no-payment status, bucket, document type, and summary', async () => {
    getRequest.mockResolvedValue({
      data: {
        summary: {
          dueNow: { amount: 0, count: 0 },
          upcoming: { amount: 0, count: 0 },
          paid: { amount: 0, count: 0 },
          noPaymentRequired: { amount: 0, count: 1 },
          paymentRequiredToReleaseCount: 0,
        },
        items: [{
          id: 'invoice-44',
          source: 'invoice',
          sourceLabel: 'Invoice',
          documentType: 'complimentary_receipt',
          paymentRequired: false,
          property: '10 Main Street',
          amount: 0,
          amountPaid: 0,
          balance: 0,
          status: 'no_payment_required',
          bucket: 'no_payment_required',
          paymentRequiredToRelease: false,
        }],
      },
    });

    const response = await fetchClientBilling();
    const item = response.items[0];

    expect(response.summary.noPaymentRequired).toEqual({ amount: 0, count: 1 });
    expect(item).toMatchObject({
      documentType: 'complimentary_receipt',
      paymentRequired: false,
      status: 'no_payment_required',
      bucket: 'no_payment_required',
    });
    expect(toClientBillingInvoiceViewData(item)).toMatchObject({
      documentType: 'complimentary_receipt',
      paymentRequired: false,
      status: 'no_payment_required',
    });
  });
});
