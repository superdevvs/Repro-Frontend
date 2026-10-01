import { describe, expect, it } from 'vitest';
import { transformDashboardOverview } from './dashboardTransformers';
import { getClientPaymentBadgeInfo } from '@/features/dashboard/utils';

/**
 * Counterexample: 12000 Market Street, 222 (shoot 440) — historical import,
 * payment_status=paid on the shoot row. Delivered card must show Paid once
 * overview formatShoots includes payment_status (same signal as detail header).
 */
describe('dashboard overview payment_status → Delivered pill', () => {
  it('maps paid payment_status for Market Street historical shoot', () => {
    const overview = transformDashboardOverview({
      stats: { total_shoots: 1, scheduled_today: 0, flagged_shoots: 0, pending_reviews: 0 },
      upcoming_shoots: [],
      photographers: [],
      pending_reviews: [],
      activity_log: [],
      issues: [],
      workflow: {
        columns: [
          {
            key: 'ready',
            label: 'Ready / Delivered',
            accent: '#22c55e',
            count: 1,
            shoots: [
              {
                id: 440,
                day_label: 'Wed',
                time_label: '10:00 AM',
                address_line: '12000 Market Street, 222',
                city_state_zip: 'Reston, VA',
                status: 'delivered',
                workflow_status: 'delivered',
                is_flagged: false,
                services: [],
                payment_status: 'paid',
                total_paid: 286.2,
                total_quote: '286.20',
              },
            ],
          },
        ],
      },
    });

    const shoot = overview.workflow?.columns?.[0]?.shoots?.[0];
    expect(shoot?.addressLine).toBe('12000 Market Street, 222');
    expect(shoot?.paymentStatus).toBe('paid');
    expect(getClientPaymentBadgeInfo(shoot?.paymentStatus).label).toBe('Paid');
  });

  it('still maps unpaid when payment_status is unpaid', () => {
    const overview = transformDashboardOverview({
      stats: { total_shoots: 1, scheduled_today: 0, flagged_shoots: 0, pending_reviews: 0 },
      upcoming_shoots: [],
      photographers: [],
      pending_reviews: [],
      activity_log: [],
      issues: [],
      workflow: {
        columns: [
          {
            key: 'ready',
            label: 'Ready / Delivered',
            accent: '#22c55e',
            count: 1,
            shoots: [
              {
                id: 999,
                day_label: 'Thu',
                address_line: 'Unpaid Example',
                city_state_zip: '',
                status: 'delivered',
                workflow_status: 'delivered',
                is_flagged: false,
                services: [],
                payment_status: 'unpaid',
              },
            ],
          },
        ],
      },
    });

    const shoot = overview.workflow?.columns?.[0]?.shoots?.[0];
    expect(shoot?.paymentStatus).toBe('unpaid');
    expect(getClientPaymentBadgeInfo(shoot?.paymentStatus).label).toBe('Unpaid');
  });
});
