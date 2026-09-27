import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { getShootClientReleaseAccess } from '@/components/shoots/details/shootClientReleaseAccess';
import { getShootDetailsVisibleTabs } from '@/components/shoots/modal/shootDetailsTabRegistry';

describe('partly released unit access', () => {
  const shoot = { id: 'unit-access', payment_status: 'unpaid', total_quote: 300, total_paid: 0,
    units: [{ id: 1, label: '101', kind: 'unit', sqft: 900, beds: 1, baths: 1, ready_service_count: 1 },
      { id: 2, label: '102', kind: 'unit', sqft: 900, beds: 1, baths: 1, ready_service_count: 0 }],
  } as unknown as ShootData;
  const toursDisabled = (value: ShootData) => getShootDetailsVisibleTabs({ shoot: value, isAdmin: false, isRep: false, isClient: true, isRequestedStatus: false, isClientReleaseLocked: true }).find(tab => tab.id === 'tours')?.disabled;
  it('allows navigating to a released unit without unlocking the whole property', () => {
    expect(toursDisabled(shoot)).toBe(false);
    expect(getShootClientReleaseAccess(shoot, true)).toMatchObject({ canClientAccessTours: true, canClientDownloadWholeShoot: false, isClientReleaseLocked: true });
  });
  it('keeps unreleased units and legacy unpaid shoots locked', () => {
    const pending = { ...shoot, units: shoot.units?.map(unit => ({ ...unit, ready_service_count: 0 })) };
    expect(toursDisabled(pending)).toBe(true);
    expect(getShootClientReleaseAccess(pending, true).canClientAccessTours).toBe(false);
    expect(getShootClientReleaseAccess({ ...shoot, units: [] }, true).canClientAccessTours).toBe(false);
  });
});
