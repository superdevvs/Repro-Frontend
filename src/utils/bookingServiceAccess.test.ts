import { describe, expect, it } from 'vitest';
import { canBookWithoutServices } from './bookingServiceAccess';

const ordinaryRoles = ['admin', 'editing_manager', 'salesRep', 'salesrep', 'sales_rep', 'rep',
  'representative', 'client', 'photographer', 'editor', 'super_admin', undefined];

describe('empty booking service permissions', () => {
  it.each(ordinaryRoles)('requires a service for new %s bookings even with an internal type', (role) => {
    expect(canBookWithoutServices({ role, shootType: 'complimentary' })).toBe(false);
  });

  it.each(['complimentary', 'sample_upload', 'internal_test', 'pricing_pending'])(
    'allows a superadmin to create an empty %s booking', (shootType) => {
      expect(canBookWithoutServices({ role: 'superadmin', shootType })).toBe(true);
    },
  );

  it.each(['standard', 'complimentary_reshoot', '', 'unknown', undefined])(
    'requires services for a superadmin on unsupported normal creation type %s', (shootType) => {
      expect(canBookWithoutServices({ role: 'superadmin', shootType })).toBe(false);
    },
  );

  it('does not grant an impersonated or ordinary staff account the superadmin creation exception', () => {
    expect(canBookWithoutServices({ role: 'superadmin', isImpersonating: true, shootType: 'internal_test' })).toBe(false);
    expect(canBookWithoutServices({ role: 'admin', shootType: 'internal_test' })).toBe(false);
  });

  it.each([...ordinaryRoles, 'superadmin'])('keeps edit permission for %s controlled by the server capability', (role) => {
    expect(canBookWithoutServices({ role, isEditMode: true, canRemoveAllServicesForEdit: true })).toBe(true);
    expect(canBookWithoutServices({ role, isEditMode: true, canRemoveAllServicesForEdit: false })).toBe(false);
    expect(canBookWithoutServices({ role, isEditMode: true })).toBe(false);
  });
});
