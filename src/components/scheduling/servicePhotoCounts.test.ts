import { describe, expect, it } from 'vitest';
import { servicePhotoCountLabel, serviceUsesPhotoCounts } from './servicePhotoCounts';

describe('package photo count fields', () => {
  it.each(['Packages', 'Bundles', 'Photo packages'])('offers photo counts for %s', category => {
    expect(serviceUsesPhotoCounts({ category })).toBe(true);
  });
  it('uses configured capabilities and tier counts outside the Photos category', () => {
    expect(serviceUsesPhotoCounts({ category: 'Drone', upload_intake_type: 'photo_video' })).toBe(true);
    expect(serviceUsesPhotoCounts({ category: 'Custom', sqft_ranges: [{ photo_count: 35 }] })).toBe(true);
    expect(serviceUsesPhotoCounts({ category: 'Video', upload_intake_type: 'video' })).toBe(false);
  });
  it('shows the configured package tier range without substituting booking quantity', () => {
    expect(servicePhotoCountLabel({ pricing_type: 'variable', photo_count: 0,
      sqft_ranges: [{ photo_count: 35 }, { photo_count: 45 }, { photo_count: 65 }] })).toBe('35–65');
    expect(servicePhotoCountLabel({ photo_count: 35 })).toBe('35');
    expect(servicePhotoCountLabel({ pricing_type: 'variable', sqft_ranges: [{ photo_count: 35 }, { photo_count: null }] })).toBeNull();
    expect(servicePhotoCountLabel({ photo_count: null })).toBeNull();
  });
});
