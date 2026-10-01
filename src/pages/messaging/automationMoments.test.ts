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

  it('describes the client calendar instead of a retained legacy 24-hour wait', () => {
    const rule = {
      id: 3, name: 'Shoot Reminder', is_active: true, scope: 'SYSTEM', created_at: '', updated_at: '',
      trigger_type: 'SHOOT_REMINDER',
      schedule_json: { offset: '-24h', client_email_schedule: {} },
      workflow_definition_json: {
        nodes: [
          { id: 'trigger', position: { x: 0, y: 0 }, type: 'trigger.event', config: { triggerType: 'SHOOT_REMINDER', schedule: { offset: '-24h', client_email_schedule: {} } } },
          { id: 'wait', position: { x: 0, y: 0 }, type: 'wait.datetime_offset', config: { referenceField: 'shoot_datetime', direction: 'before', amount: 24, unit: 'hours' } },
          { id: 'email', position: { x: 0, y: 0 }, type: 'action.email', config: {} },
          { id: 'end', position: { x: 0, y: 0 }, type: 'end', config: {} },
        ],
        edges: [],
      },
    } as AutomationRule;
    expect(whenSummary(rule)).toBe('Client email: day before 07:00; 07:00–12:00 shoots: evening 19:00 + 120 min before; others: day-of 07:00 (local time)');
    expect(whenSummary({ ...rule, trigger_type: 'PHOTOGRAPHER_SHOOT_REMINDER' })).toBe('24 hours before');
  });

  it('summarizes edited client timing from the workflow trigger', () => {
    const rule = {
      id: 3, name: 'Shoot Reminder', is_active: true, scope: 'SYSTEM', created_at: '', updated_at: '',
      trigger_type: 'SHOOT_REMINDER',
      schedule_json: { offset: '-24h', client_email_schedule: { previous_day_time: '07:00' } },
      workflow_definition_json: {
        nodes: [{ id: 'trigger', position: { x: 0, y: 0 }, type: 'trigger.event', config: {
          triggerType: 'SHOOT_REMINDER', schedule: { offset: '-24h', client_email_schedule: {
            previous_day_time: '08:00', day_of_time: '06:30', morning_start: '08:00', morning_end: '11:30',
            morning_previous_evening_time: '18:30', morning_lead_minutes: 90,
          } },
        } }],
        edges: [],
      },
    } as AutomationRule;
    expect(whenSummary(rule)).toBe('Client email: day before 08:00; 08:00–11:30 shoots: evening 18:30 + 90 min before; others: day-of 06:30 (local time)');
  });

  it('shows the shoot payment cadence that will actually run', () => {
    expect(whenSummary({ trigger_type: 'SHOOT_PAYMENT_REMINDER' } as AutomationRule))
      .toBe('Days 1, 2, 4, 7 after photos ready; then every 7 days from day 14');
    expect(whenSummary({
      trigger_type: 'SHOOT_PAYMENT_REMINDER',
      schedule_json: { reminder_days: [1, 3, 7], repeat_after_day: 7, repeat_every_days: 7 },
    } as AutomationRule)).toBe('Days 1, 3, 7 after photos ready; then every 7 days from day 14');
    expect(whenSummary({
      trigger_type: 'SHOOT_PAYMENT_REMINDER',
      schedule_json: { reminder_days: [2, 5], repeat_after_day: 5, repeat_every_days: 10 },
    } as AutomationRule)).toBe('Days 2, 5 after photos ready; then every 10 days from day 15');
    expect(whenSummary({
      trigger_type: 'SHOOT_PAYMENT_REMINDER',
      schedule_json: { reminder_days: [1, 3, 7, 14], monthly_day_of_week: 0, time: '09:00' },
    } as AutomationRule)).toBe('Days 1, 3, 7, 14 after photos ready; then last Sunday monthly at 09:00');
  });
});
