import { describe, expect, it } from 'vitest';
import type { AutomationRule } from '@/types/messaging';
import { triggerLabels } from '@/components/messaging/automations/workflow-utils';
import { automationMoments, momentForTrigger, recipientSummary, whenSummary } from './automationMoments';

describe('automation moments', () => {
  it('groups live triggers into the job moments', () => {
    expect(momentForTrigger('ACCOUNT_CREATED')).toBe('Account');
    expect(momentForTrigger('SHOOT_BOOKED')).toBe('Booking');
    expect(momentForTrigger('PROPERTY_CONTACT_REMINDER')).toBe('On site');
    expect(momentForTrigger('EDITING_COMPLETE')).toBe('Delivery');
    expect(momentForTrigger('WEEKLY_SALES_REPORT')).toBe('Money');
  });

  it('keeps an unknown trigger visible under Booking', () => {
    expect(momentForTrigger('SOMETHING_NEW')).toBe('Booking');
  });

  it('places every live trigger in exactly one moment', () => {
    const placed = automationMoments.flatMap((moment) => moment.triggers);
    expect(new Set(placed).size).toBe(placed.length);
    expect(placed.sort()).toEqual(Object.keys(triggerLabels).sort());
  });

  it('reads recipient roles from either stored shape', () => {
    expect(recipientSummary({ recipients_json: ['client', 'photographer'] } as AutomationRule)).toBe('Client, Photographer');
    expect(recipientSummary({ recipients_json: { roles: ['admin'] } } as AutomationRule)).toBe('Admin');
    expect(recipientSummary({} as AutomationRule)).toBe('Default');
  });

  it('describes timing from the stored schedule', () => {
    expect(whenSummary({ schedule_json: { offset: '-24h' } } as AutomationRule)).toBe('24 hours before');
    expect(whenSummary({ schedule_json: { offset: '-1d' } } as AutomationRule)).toBe('1 day before');
    expect(whenSummary({ schedule_json: { type: 'weekly', day_of_week: 5, time: '08:00' } } as AutomationRule)).toBe('Fridays at 08:00');
    expect(whenSummary({} as AutomationRule)).toBe('Right away');
  });
});
