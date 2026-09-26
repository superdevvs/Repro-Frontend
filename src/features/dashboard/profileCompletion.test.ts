import { describe, expect, it } from 'vitest';
import { profileCompletionItems, profileCompletionSummary, type ProfileCompletionUser } from './profileCompletion';

const photographer = (overrides: Partial<ProfileCompletionUser> = {}): ProfileCompletionUser => ({
  role: 'photographer',
  avatar: 'https://cdn.example/photo.jpg',
  phone: '5551234567',
  address: '10 Main St',
  city: 'Richmond',
  state: 'VA',
  zipcode: '23220',
  licenseNumber: 'FAA-107',
  metadata: {
    insuranceNumber: 'POLICY-1',
    insuranceFile: 'https://files.example/insurance.pdf',
    pilotLicenseFile: 'https://files.example/pilot.pdf',
  },
  ...overrides,
});

describe('profile completion', () => {
  it('keeps a photographer incomplete when only the new license fields are missing', () => {
    const items = profileCompletionItems(photographer({
      licenseNumber: '',
      license_number: '',
      metadata: {},
    }), 'present');
    const missing = items.filter((item) => !item.complete).map((item) => item.id);
    expect(missing).toEqual(['license', 'insurance-number', 'insurance-document', 'pilot-license']);
    expect(items.find((item) => item.id === 'license')?.href).toBe('/photographer-account?tab=work');
    expect(items.find((item) => item.id === 'phone')?.href).toBe('/photographer-account?tab=personal');
    expect(profileCompletionSummary(items).done).toBe(false);
    expect(profileCompletionSummary(items)).toMatchObject({ complete: 4, total: 8, next: { id: 'license' } });
  });

  it('hides the card for a photographer whose profile is complete', () => {
    const items = profileCompletionItems(photographer(), 'present');
    expect(items.every((item) => item.complete)).toBe(true);
    expect(profileCompletionSummary(items).done).toBe(true);
    expect(profileCompletionSummary(items).next).toBeNull();
  });

  it('does not treat a pending address as a completed home base', () => {
    const items = profileCompletionItems(photographer({
      address: '',
      city: '',
      state: '',
      zipcode: '',
      pending_address_change: { status: 'pending', street_address: '20 New St', city: 'Richmond', state: 'VA', zip: '23220' },
    }));
    expect(items.find((item) => item.id === 'address')?.complete).toBe(false);
  });

  it('skips the tax item when its status could not be loaded', () => {
    const items = profileCompletionItems(photographer(), 'unknown');
    expect(items.map((item) => item.id)).not.toContain('tax-document');
  });

  it('uses each role’s own editable fields', () => {
    expect(profileCompletionItems({ role: 'client' }).map((item) => item.id)).toEqual([
      'photo', 'phone', 'company', 'billing-address',
    ]);
    expect(profileCompletionItems({ role: 'editor' }).map((item) => item.href)).toEqual([
      '/settings?tab=profile',
      '/settings?tab=account',
    ]);
    expect(profileCompletionItems({ role: 'salesRep', company_name: 'Repro' }).find((item) => item.id === 'company')).toMatchObject({
      complete: true,
      href: '/settings?tab=account',
    });
    expect(profileCompletionItems({ role: 'admin' }).some((item) => item.id === 'license')).toBe(false);
  });
});
