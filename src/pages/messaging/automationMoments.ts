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
    triggers: ['SHOOT_REMINDER', 'PHOTOGRAPHER_ASSIGNED', 'PHOTOGRAPHER_CHANGED', 'PROPERTY_CONTACT_REMINDER'],
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
      'INVOICE_DUE',
      'INVOICE_OVERDUE',
      'INVOICE_SUMMARY',
      'INVOICE_PAID',
      'WEEKLY_PHOTOGRAPHER_INVOICE',
      'WEEKLY_REP_INVOICE',
      'WEEKLY_SALES_REPORT',
      'WEEKLY_AUTOMATED_INVOICING',
    ],
  },
];

export const momentForTrigger = (trigger: string): AutomationMomentId =>
  automationMoments.find((moment) => (moment.triggers as string[]).includes(trigger))?.id ?? 'Booking';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const recipientSummary = (automation: AutomationRule) => {
  const raw = automation.recipients_json;
  const roles = Array.isArray(raw) ? raw : raw?.roles ?? [];
  if (roles.length === 0) {
    return 'Default';
  }

  return roles.map((role) => role.charAt(0).toUpperCase() + role.slice(1)).join(', ');
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
  const schedule = automation.schedule_json;
  if (schedule?.offset) {
    return formatOffset(schedule.offset);
  }

  if (schedule?.type === 'weekly' || (schedule?.time && schedule.day_of_week != null)) {
    const day = weekdays[schedule.day_of_week ?? 1] ?? 'Monday';
    return `${day}s at ${schedule.time ?? '01:00'}`;
  }

  return 'Right away';
};
