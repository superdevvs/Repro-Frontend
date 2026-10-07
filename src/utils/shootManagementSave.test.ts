import { describe, expect, it } from 'vitest';
import { prepareShootManagementSave } from './shootManagementSave';
import { hasSalesRepRole } from './shootManagementAccess';
import type { ShootData } from '@/types/shoots';

describe('Scoped shoot management', () => {
  it('keeps property, client, duration, pricing intention and stale-edit token without production or price echoes', () => {
    const payload = prepareShootManagementSave({ client_id: 4, address: 'Muted fixture', bedrooms: 3,
      property_details: { lockboxCode: 'fixture' }, discount_value: 10, expected_edit_version: 'a'.repeat(64),
      services: [{ id: 17, photographer_id: 1106, duration_minutes: 5, price: 999, editor_id: 2264 }],
      base_quote: 999, editor_id: 2264, hero_image: 'not-a-booking-field',
    }, { id: 'fixture' } as ShootData);
    expect(payload).toMatchObject({ client_id: 4, address: 'Muted fixture', bedrooms: 3,
      property_details: { lockboxCode: 'fixture' }, discount_value: 10, expected_edit_version: 'a'.repeat(64),
      services: [{ id: 17, duration_minutes: 5 }], service_photographers: [{ service_id: 17, photographer_id: 1106 }],
    });
    expect(payload).not.toHaveProperty('editor_id');
    expect(payload).not.toHaveProperty('base_quote');
    expect(payload).not.toHaveProperty('hero_image');
    expect((payload.services as object[])[0]).not.toHaveProperty('price');
    expect((payload.services as object[])[0]).not.toHaveProperty('editor_id');
  });
  it.each(['salesRep', 'sales_rep', 'sales-rep', 'sales rep', 'rep', 'representative'])('recognizes %s and secondary roles', role => {
    expect(hasSalesRepRole({ role })).toBe(true);
    expect(hasSalesRepRole({ role: 'photographer', secondary_roles: [role] })).toBe(true);
    expect(hasSalesRepRole({ role: 'photographer' })).toBe(false);
  });
  it.each(['admin', 'superadmin', 'super_admin', 'editing_manager'])('does not demote %s when it also has a rep role', role => {
    expect(hasSalesRepRole({ role, secondary_roles: ['sales_rep'] })).toBe(false);
  });
});
