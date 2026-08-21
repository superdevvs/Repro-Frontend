import { describe, expect, it } from 'vitest';

import { buildShootPaymentDialogModel } from './shootPaymentDialogModel';

describe('buildShootPaymentDialogModel', () => {
  it('normalizes a newly-created requested ShootResource payment snapshot', () => {
    const model = buildShootPaymentDialogModel({
      id: '42',
      status: 'requested',
      location: {
        address: '100 Main St',
        city: 'Arlington',
        state: 'VA',
        zip: '22201',
        fullAddress: '100 Main St, Arlington, VA 22201',
      },
      client: { name: 'Client', email: 'client@example.test' },
      scheduledDate: '2026-09-15',
      time: '13:00',
      serviceItems: [
        {
          id: '9',
          shoot_service_id: '101',
          name: 'Photos',
          subtotal: 200,
          paid_amount: 50,
          balance_due: 150,
        },
        {
          id: '10',
          shoot_service_id: '102',
          name: 'Floor plan',
          subtotal: 100,
          paid_amount: 0,
          balance_due: 100,
        },
      ],
      payment: {
        serviceSubtotal: 300,
        discountedSubtotal: 300,
        discountAmount: 0,
        taxAmount: 0,
        totalQuote: 300,
        totalPaid: 50,
        remainingBalance: 250,
        paymentStatus: 'partial',
      },
    });

    expect(model).toMatchObject({
      shootId: '42',
      amount: 250,
      totalQuote: 300,
      totalPaid: 50,
      paymentStatus: 'partial',
      shootAddress: '100 Main St, Arlington, VA 22201',
      shootServices: ['Photos', 'Floor plan'],
      clientName: 'Client',
      clientEmail: 'client@example.test',
    });
    expect(model?.serviceItems.map((item) => item.id)).toEqual(['101', '102']);
  });

  it('accepts Presenter aliases after a missing creation snapshot is refetched', () => {
    const model = buildShootPaymentDialogModel({
      id: 7,
      address: '500 Refetch Rd',
      city: 'Fairfax',
      state: 'VA',
      zip: '22030',
      total_quote: '125.50',
      total_paid: '25.50',
      remaining_balance: '100.00',
      service_items: [{
        id: 4,
        shoot_service_id: 88,
        name: 'HDR',
        subtotal: 125.5,
        paid_amount: 25.5,
        balance_due: 100,
      }],
    });

    expect(model?.shootId).toBe('7');
    expect(model?.amount).toBe(100);
    expect(model?.serviceItems[0].id).toBe('88');
  });

  it('refuses to open payment without both an id and canonical service items', () => {
    expect(buildShootPaymentDialogModel({ payment: { totalQuote: 100 } })).toBeNull();
    expect(buildShootPaymentDialogModel({ id: 4, payment: { totalQuote: 100 } })).toBeNull();
  });
});
