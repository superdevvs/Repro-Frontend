import { describe, expect, it } from 'vitest';
import { normalizePrivateListing } from './privateListings';

describe('exclusive listing previews', () => {
  it('uses the published discovery preview for listing cards and map markers', () => {
    const preview = 'https://reprodashboard.com/api/public/tour-image/146/26840/grid/revision';
    expect(normalizePrivateListing({
      id: 146, address: '334 Galloping Hill Road', is_private_listing: true,
      discovery_only: true, can_download_media: false, preview_image_url: preview,
    })?.heroImage).toBe(preview);
  });

  it('keeps existing owner and staff hero images when no discovery preview exists', () => {
    expect(normalizePrivateListing({ id: 1, hero_image: '/storage/cover.jpg' })?.heroImage)
      .toBe('/storage/cover.jpg');
    expect(normalizePrivateListing({ id: 2, preview_image_url: null })?.heroImage).toBeUndefined();
  });
});
