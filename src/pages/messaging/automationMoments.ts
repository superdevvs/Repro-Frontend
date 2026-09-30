import { hasLegacyMonthlyShootCadence, scheduleFromWorkflow, storedReminderSchedule } from '@/components/messaging/automations/automationSchedule';
import type { AutomationRule, AutomationTriggerType } from '@/types/messaging';

export type AutomationMomentId = 'Account' | 'Booking' | 'On site' | 'Delivery' | 'Money';

export const automationMoments: Array<{
  id: AutomationMomentId;
  intro: string;
  triggers: AutomationTriggerType[];
}> = [
  {
    id: 'Account',
    intro: 'People getting into the dashboard.',
    triggers: ['ACCOUNT_CREATED', 'ACCOUNT_VERIFIED', 'PASSWORD_RESET', 'TERMS_ACCEPTED'],
  },
  {
    id: 'Booking',
    intro: 'From the request to a date on the calendar.',
    triggers: [
      'SHOOT_REQUESTED',
      'SHOOT_REQUEST_APPROVED',
      'SHOOT_REQUEST_MODIFIED',
      'SHOOT_REQUEST_DECLINED',
      'SHOOT_BOOKED',
      'SHOOT_SCHEDULED',
      'SHOOT_UPDATED',
      'SHOOT_CANCELED',
      'SHOOT_REMOVED',
    ],
  },
  {
    id: 'On site',
    intro: 'Reminders for the people at the property.',
    triggers: ['SHOOT_REMINDER', 'PHOTOGRAPHER_SHOOT_REMINDER', 'PHOTOGRAPHER_ASSIGNED', 'PHOTOGRAPHER_CHANGED', 'PROPERTY_CONTACT_REMINDER'],
  },
  {
    id: 'Delivery',
    intro: 'When the photos are ready to view.',
    triggers: ['SHOOT_COMPLETED', 'PHOTO_UPLOADED', 'MEDIA_UPLOAD_COMPLETE', 'EDITING_COMPLETE'],
  },
  {
    id: 'Money',
    intro: 'Receipts, invoices, and the weekly note.',
    triggers: [
      'PAYMENT_COMPLETED',
      'PAYMENT_FAILED',
      'PAYMENT_REFUNDED',
      'SHOOT_PAYMENT_REMINDER',
      'INVOICE_DUE',
      'INVOICE_OVERDUE',
      'INVOICE_SUMMARY',
      'INVOICE_PAID',
      'WEEKLY_PHOTOGRAPHER_INVOICE',
      'WEEKLY_REP_INVOICE',
      'WEEKLY_PAYOUT_REPORT',
      'WEEKLY_PAYOUT_DIGEST',
      'WEEKLY_SALES_REPORT',
      'WEEKLY_AUTOMATED_INVOICING',
    ],
  },
];

export const momentForTrigger = (trigger: string): AutomationMomentId =>
  automationMoments.find((moment) => (moment.triggers as string[]).includes(trigger))?.id ?? 'Booking';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const recipientLabel = (role: string) => role === 'account' ? 'New account' : role.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

export const recipientSummary = (automation: AutomationRule) => {
  const raw = automation.recipients_json;
  const defaults = Array.isArray(raw) ? raw : raw?.roles ?? [];
  const actions = automation.workflow_definition_json?.nodes.filter((node) => node.type.startsWith('action.'));
  const roles = actions?.length ? actions.flatMap((node) => {
    if (node.config.recipientMode === 'context') return typeof node.config.contextKey === 'string' ? [node.config.contextKey] : [];
    if (node.config.recipientMode === 'roles') return Array.isArray(node.config.recipientRoles) ? node.config.recipientRoles.filter((role): role is string => typeof role === 'string') : [];
    return defaults;
  }) : defaults;
  return roles.length ? [...new Set(roles)].map(recipientLabel).join(', ') : 'Default';
};

const formatOffset = (offset: string) => {
  const match = offset.trim().match(/^(-?)(\d+)([mhd])$/i);
  if (!match) {
    return `Offset ${offset}`;
  }

  const amount = Number(match[2]);
  const unit = match[3].toLowerCase() === 'm' ? 'minute' : match[3].toLowerCase() === 'h' ? 'hour' : 'day';
  const label = amount === 1 ? unit : `${unit}s`;
  return match[1] === '-' ? `${amount} ${label} before` : `${amount} ${label} after`;
};

export const whenSummary = (automation: AutomationRule) => {
  const schedule = automation.workflow_definition_json?.nodes.length
    ? scheduleFromWorkflow(automation.workflow_definition_json, storedReminderSchedule(automation))
    : storedReminderSchedule(automation);
  if (schedule?.offset) {
    return formatOffset(schedule.offset);
  }

  if (schedule?.type === 'weekly' || (schedule?.time && schedule.day_of_week != null)) {
    const day = weekdays[schedule.day_of_week ?? 1] ?? 'Monday';
    return `${day}s at ${schedule.time ?? '01:00'}`;
  }

  if (automation.trigger_type === 'SHOOT_PAYMENT_REMINDER') {
    const firstDays = (schedule?.reminder_days ?? [1, 3, 7]).join(', ');
    if (hasLegacyMonthlyShootCadence(schedule)) {
      return `Days ${firstDays} after photos ready; then last ${weekdays[schedule?.monthly_day_of_week ?? 0]} monthly at ${schedule?.time ?? '09:00'}`;
    }
    const repeatAfterDay = schedule?.repeat_after_day ?? 7;
    const repeatEveryDays = schedule?.repeat_every_days ?? 7;
    return `Days ${firstDays} after photos ready; then every ${repeatEveryDays} days from day ${repeatAfterDay + repeatEveryDays}`;
  }
  if (automation.trigger_type === 'INVOICE_OVERDUE') {
    return `Days ${(schedule?.overdue_days ?? [1, 3, 7, 14, 30]).join(', ')}, then every ${schedule?.repeat_every_days ?? 30} days at ${schedule?.time ?? '09:30'}`;
  }
  if (automation.trigger_type === 'INVOICE_DUE' || automation.trigger_type === 'PROPERTY_CONTACT_REMINDER') {
    const invoice = automation.trigger_type === 'INVOICE_DUE';
    const day = schedule?.days_before ?? 0;
    return `${day === 0 ? (invoice ? 'On due date' : 'On shoot day') : `${day} day${day === 1 ? '' : 's'} before ${invoice ? 'due date' : 'shoot'}`} at ${schedule?.time ?? (invoice ? '09:30' : '09:00')}`;
  }
  return 'Right away';
};
