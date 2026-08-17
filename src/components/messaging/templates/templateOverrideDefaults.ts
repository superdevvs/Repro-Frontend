import type { MessageTemplate } from '@/types/messaging';

export const PROTECTED_EMAIL_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Not an override' },
  { value: 'ACCOUNT_CREATED', label: 'New Account Created' },
  { value: 'CLIENT_EMAIL_VERIFICATION', label: 'Client Email Verification' },
  { value: 'CLIENT_EMAIL_VERIFIED', label: 'Client Email Verified' },
  { value: 'PHOTOGRAPHER_EQUIPMENT_VERIFICATION', label: 'Photographer Equipment Verification' },
  { value: 'PHOTOGRAPHER_EQUIPMENT_APPROVED', label: 'Photographer Equipment Approved' },
  { value: 'PHOTOGRAPHER_EQUIPMENT_REJECTED', label: 'Photographer Equipment Rejected' },
  { value: 'ROLE_CHANGED', label: 'Role Changed' },
  { value: 'PASSWORD_RESET', label: 'Password Reset' },
  { value: 'SHOOT_SCHEDULED', label: 'Shoot Scheduled' },
  { value: 'SHOOT_UPDATED', label: 'Shoot Updated' },
  { value: 'SHOOT_REMINDER', label: 'Shoot Reminder' },
  { value: 'SHOOT_REMOVED', label: 'Shoot Removed' },
  { value: 'SHOOT_REQUEST_DECLINED', label: 'Shoot Request Declined' },
  { value: 'SHOOT_REQUESTED', label: 'Shoot Requested' },
  { value: 'SHOOT_CANCELLATION_REQUESTED', label: 'Shoot Cancellation Requested' },
  { value: 'SHOOT_DELIVERED', label: 'Shoot Delivered' },
  { value: 'PAYMENT_CONFIRMATION', label: 'Payment Confirmation' },
  { value: 'INVOICE_GENERATED', label: 'Invoice Generated' },
  { value: 'INVOICE_PENDING_APPROVAL', label: 'Invoice Pending Approval' },
  { value: 'INVOICE_APPROVED', label: 'Invoice Approved' },
  { value: 'INVOICE_REJECTED', label: 'Invoice Rejected' },
  { value: 'SHOOT_PAID', label: 'Shoot Paid' },
  { value: 'SHOOT_CANCELLED', label: 'Shoot Cancelled' },
  { value: 'PHOTOGRAPHER_CHANGED', label: 'Photographer Changed' },
  { value: 'CANCELLATION_FEE_INVOICE', label: 'Cancellation Fee Invoice' },
  { value: 'OFFLINE_PAYMENT_INTENT_SUBMITTED', label: 'Offline Payment Submitted' },
  { value: 'OFFLINE_PAYMENT_INTENT_DECLINED', label: 'Offline Payment Declined' },
  { value: 'INTERNAL_MESSAGE_NOTIFICATION', label: 'Internal Message Notification' },
];

// These are the single canonical DB templates for protected email aliases.
// Slugs that would collide with another template for the same alias are
// intentionally not inferred; admins can still map those explicitly.
export const SYSTEM_TEMPLATE_EMAIL_TYPE_BY_SLUG: Record<string, string> = {
  'account-created': 'ACCOUNT_CREATED',
  'shoot-scheduled': 'SHOOT_SCHEDULED',
  'shoot-requested': 'SHOOT_REQUESTED',
  'shoot-request-declined': 'SHOOT_REQUEST_DECLINED',
  'shoot-reminder': 'SHOOT_REMINDER',
  'shoot-updated': 'SHOOT_UPDATED',
  'shoot-ready': 'SHOOT_DELIVERED',
  'shoot-deleted': 'SHOOT_REMOVED',
  'payment-thank-you': 'PAYMENT_CONFIRMATION',
  'photographer-changed': 'PHOTOGRAPHER_CHANGED',
  'shoot-cancelled': 'SHOOT_CANCELLED',
  'weekly-invoice-generated': 'INVOICE_GENERATED',
};

type TemplateOverrideSource = Pick<
  MessageTemplate,
  'slug' | 'is_system' | 'email_type' | 'override_enabled'
>;

export function getTemplateOverrideDefaults(template: TemplateOverrideSource): {
  emailType: string;
  overrideEnabled: boolean;
} {
  const savedEmailType = template.email_type?.trim() ?? '';
  if (savedEmailType) {
    return {
      emailType: savedEmailType,
      overrideEnabled: template.override_enabled ?? false,
    };
  }

  const inferredEmailType = template.is_system && template.slug
    ? SYSTEM_TEMPLATE_EMAIL_TYPE_BY_SLUG[template.slug] ?? ''
    : '';

  return {
    emailType: inferredEmailType,
    overrideEnabled: Boolean(inferredEmailType),
  };
}
