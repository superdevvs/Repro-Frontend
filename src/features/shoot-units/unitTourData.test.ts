import { describe, expect, it } from 'vitest';
import { buildTourUrl, projectUnitTour, withTourUnit } from './unitTourData';
import { buildPublicTourEndpoint } from '@/components/tourLinks/publicTourData';
import type { ShootData, ShootUnit } from '@/types/shoots';

describe('unit tour isolation', () => {
  it('inherits presentation defaults and clears building provider and listing facts', () => {
    const shoot = { id: 7, tourLinks: { tour_style: 'homeify', video_branded: 'https://test/building', property_mls: 'building' }, iguideTourUrl: 'https://test/building-iguide', cubicasa_order_id: 'building-order', propertyDetails: { bedrooms: 15, sqft: 10000 } } as unknown as ShootData;
    const unit = { id: 2, label: 'Studio', kind: 'unit', beds: 0, baths: 1, sqft: 600, provider_data: { cubicasa_order_id: 'unit-order' }, tour_links: { property_mls: 'studio' } } as ShootUnit;
    const result = projectUnitTour(shoot, unit) as unknown as Record<string, unknown>;
    expect(result.tourLinks).toEqual({ tour_style: 'homeify', property_mls: 'studio' });
    expect(result.iguideTourUrl).toBeUndefined();
    expect(result.cubicasa_order_id).toBe('unit-order');
    expect(result.propertyDetails).toMatchObject({ bedrooms: 0, sqft: 600 });
  });
  it.each(['branded', 'mls', 'generic-mls'] as const)('keeps a direct unit through the %s API endpoint', variant => {
    expect(buildPublicTourEndpoint('?shootId=7&unitId=42', variant)).toContain('unitId=42');
    expect(buildPublicTourEndpoint('?shootId=7&unitId=42', variant)).toContain('/7/');
  });
  it('preserves legacy URLs and encodes unit identifiers', () => {
    expect(withTourUnit('/tour/branded?shootId=7')).toBe('/tour/branded?shootId=7');
    expect(withTourUnit('/tour/branded?shootId=7', 'A&B')).toBe('/tour/branded?shootId=7&unitId=A%26B');
  });
  it.each(['branded', 'mls', 'genericMls', 'video_branded', 'video_mls', 'video_generic', 'matterport_branded', 'matterport_mls', 'iguide_branded', 'iguide_mls', 'zillow_3d'])('uses one unit-scoped URL for every %s copy/open/share/QR action', type => {
    const url = buildTourUrl('https://reprodashboard.test', 7, type, { [type]: 'https://provider.test/unit-42' }, 42);
    expect(url).toContain('shootId=7&unitId=42');
    if (/matterport|iguide|zillow/.test(type)) expect(url).toContain('provider=');
  });
});
