import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';
import { withHomepageCover } from '@/components/dashboard/featuredHomepage';

describe('featured gallery load and cover update', () => {
  it('preserves API images and marketing copy through loading and a cover change', () => {
    const loaded = transformShootFromApi({
      id: 42,
      featured_homepage_title: 'An Arlington home',
      featured_homepage_location: 'Arlington, VA',
      featured_homepage_subtitle: 'Photography and video',
      featured_homepage_cta_label: 'View this project',
      featured_homepage_cta_href: '/projects/arlington',
      featured_homepage_images: [
        { id: 8, shoot_file_id: 101, sort: 1, alt: 'Exterior', focal: '45% 40%' },
        { id: 9, shoot_file_id: 102, sort: 2, alt: 'Kitchen', focal: '60% 35%' },
      ],
    });
    expect(loaded.featuredHomepageTitle).toBe('An Arlington home');
    expect(loaded.featuredHomepageLocation).toBe('Arlington, VA');
    expect(loaded.featuredHomepageSubtitle).toBe('Photography and video');
    expect(loaded.featuredHomepageCtaLabel).toBe('View this project');
    expect(loaded.featuredHomepageCtaHref).toBe('/projects/arlington');
    expect(loaded.featuredHomepageImages).toEqual(loaded.featured_homepage_images);
    expect(withHomepageCover(loaded, 102)).toEqual([
      { shoot_file_id: 102, sort: 1, alt: 'Kitchen', focal: '60% 35%' },
      { shoot_file_id: 101, sort: 2, alt: 'Exterior', focal: '45% 40%' },
    ]);
  });

  it('accepts the camel case response and preserves the gallery when adding a cover', () => {
    const loaded = transformShootFromApi({
      id: 43,
      featuredHomepageTitle: 'A second home',
      featuredHomepageImages: [
        { id: 10, shootFileId: '201', sort: 1, alt: 'Living room', focal: '30% 50%' },
      ],
    });
    expect(loaded.featured_homepage_title).toBe('A second home');
    expect(withHomepageCover(loaded, 202)).toEqual([
      { shoot_file_id: 202, sort: 1, alt: '', focal: '50% 50%' },
      { shoot_file_id: 201, sort: 2, alt: 'Living room', focal: '30% 50%' },
    ]);
  });
});
