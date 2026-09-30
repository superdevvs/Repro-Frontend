import { describe, expect, it } from 'vitest';
import { resolveFeaturedHomepageState, withHomepageCover } from './featuredHomepage';

describe('homepage project cover', () => {
  const images = [
    { shoot_file_id: 2, sort: 2, alt: 'Living room', focal: '40% 30%' },
    { shoot_file_id: 1, sort: 1, alt: 'Exterior', focal: '50% 50%' },
    { shoot_file_id: 3, sort: 3, alt: 'Kitchen', focal: '60% 50%' },
  ];

  it('moves an existing cover first without losing gallery images or metadata', () => {
    const updated = withHomepageCover({ featured_homepage_images: images }, 2);
    expect(updated.map((image) => image.shoot_file_id)).toEqual([2, 1, 3]);
    expect(updated.map((image) => image.sort)).toEqual([1, 2, 3]);
    expect(updated[0]).toMatchObject({ alt: 'Living room', focal: '40% 30%' });
    expect(images[0].sort).toBe(2);
  });

  it('prepends a new cover and preserves the ordered gallery', () => {
    expect(withHomepageCover({ featuredHomepageImages: images }, 4).map((image) => image.shoot_file_id))
      .toEqual([4, 1, 2, 3]);
  });

  it('does not silently discard an image when the gallery is full', () => {
    const full = Array.from({ length: 10 }, (_, index) => ({ ...images[0], shoot_file_id: index + 1, sort: index + 1 }));
    expect(() => withHomepageCover({ featured_homepage_images: full }, 11)).toThrow('already has 10 images');
    expect(withHomepageCover({ featured_homepage_images: full }, 10)).toHaveLength(10);
  });
});

describe('featured approval state', () => {
  it('keeps staff requests pending rather than reporting removal', () => {
    expect(resolveFeaturedHomepageState({ is_featured: false, featured_requested_at: '2026-09-30T12:00:00Z' }))
      .toEqual({ approved: false, pending: true });
    expect(resolveFeaturedHomepageState({ is_featured: false, featured_pending: true }))
      .toEqual({ approved: false, pending: true });
  });

  it('handles approval and removal without retaining a stale pending request', () => {
    expect(resolveFeaturedHomepageState({ is_featured: true, featured_pending: true }))
      .toEqual({ approved: true, pending: false });
    expect(resolveFeaturedHomepageState({ is_featured: false, featured_pending: false, featured_requested_at: null }))
      .toEqual({ approved: false, pending: false });
  });
});
