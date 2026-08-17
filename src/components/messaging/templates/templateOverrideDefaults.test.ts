import { describe, expect, it } from 'vitest';

import { getTemplateOverrideDefaults, PROTECTED_EMAIL_TYPES } from './templateOverrideDefaults';

describe('template override defaults', () => {
  it('infers and enables the protected alias for a canonical system template', () => {
    expect(getTemplateOverrideDefaults({
      slug: 'weekly-invoice-generated',
      is_system: true,
      email_type: null,
      override_enabled: false,
    })).toEqual({
      emailType: 'INVOICE_GENERATED',
      overrideEnabled: true,
    });
  });

  it('preserves an explicit admin opt-out after the inferred mapping has been saved', () => {
    expect(getTemplateOverrideDefaults({
      slug: 'weekly-invoice-generated',
      is_system: true,
      email_type: 'INVOICE_GENERATED',
      override_enabled: false,
    })).toEqual({
      emailType: 'INVOICE_GENERATED',
      overrideEnabled: false,
    });
  });

  it('does not infer non-system or non-canonical templates', () => {
    expect(getTemplateOverrideDefaults({
      slug: 'custom-invoice-email',
      is_system: false,
      email_type: null,
      override_enabled: false,
    })).toEqual({
      emailType: '',
      overrideEnabled: false,
    });
  });

  it('offers every alias exposed by the protected email registry', () => {
    expect(PROTECTED_EMAIL_TYPES.map(({ value }) => value)).toEqual([
      '',
      'ACCOUNT_CREATED',
      'CLIENT_EMAIL_VERIFICATION',
      'CLIENT_EMAIL_VERIFIED',
      'PHOTOGRAPHER_EQUIPMENT_VERIFICATION',
      'PHOTOGRAPHER_EQUIPMENT_APPROVED',
      'PHOTOGRAPHER_EQUIPMENT_REJECTED',
      'ROLE_CHANGED',
      'PASSWORD_RESET',
      'SHOOT_SCHEDULED',
      'SHOOT_UPDATED',
      'SHOOT_REMINDER',
      'SHOOT_REMOVED',
      'SHOOT_REQUEST_DECLINED',
      'SHOOT_REQUESTED',
      'SHOOT_CANCELLATION_REQUESTED',
      'SHOOT_DELIVERED',
      'PAYMENT_CONFIRMATION',
      'INVOICE_GENERATED',
      'INVOICE_PENDING_APPROVAL',
      'INVOICE_APPROVED',
      'INVOICE_REJECTED',
      'SHOOT_PAID',
      'SHOOT_CANCELLED',
      'PHOTOGRAPHER_CHANGED',
      'CANCELLATION_FEE_INVOICE',
      'OFFLINE_PAYMENT_INTENT_SUBMITTED',
      'OFFLINE_PAYMENT_INTENT_DECLINED',
      'INTERNAL_MESSAGE_NOTIFICATION',
    ]);
  });
});
