import type { ApiShoot } from './shootApiTypes';

export const normalizeShootFeaturedState = (shoot: ApiShoot) => {
  const isFeatured = typeof shoot.is_featured === 'boolean'
    ? Boolean(shoot.is_featured) : Boolean(shoot.isFeatured);
  const featuredPending = typeof shoot.featured_pending === 'boolean'
    ? Boolean(shoot.featured_pending) : Boolean(shoot.featuredPending);
  const featuredStatus = shoot.featured_status ?? shoot.featuredStatus
    ?? (isFeatured ? 'featured' : featuredPending ? 'pending' : 'none');
  return { isFeatured, featuredPending, featuredStatus };
};

/** Keep the public gallery intact when a loaded shoot is edited in Settings. */
export const normalizeShootFeaturedHomepage = (shoot: ApiShoot) => {
  const text = (snake: string, camel: string): string | null => {
    const value = shoot[snake] ?? shoot[camel];
    return typeof value === 'string' ? value : null;
  };
  const rawImages = shoot.featured_homepage_images ?? shoot.featuredHomepageImages;
  const images = Array.isArray(rawImages) ? rawImages.flatMap((value, index) => {
    if (!value || typeof value !== 'object') return [];
    const image = value as Record<string, unknown>;
    const fileId = Number(image.shoot_file_id ?? image.shootFileId);
    if (!Number.isInteger(fileId) || fileId <= 0) return [];
    const sort = Number(image.sort ?? image.sort_order ?? index + 1);
    return [{
      id: typeof image.id === 'number' ? image.id : undefined,
      shoot_file_id: fileId,
      shootFileId: fileId,
      sort: Number.isFinite(sort) ? sort : index + 1,
      alt: typeof (image.alt ?? image.alt_text) === 'string' ? String(image.alt ?? image.alt_text) : null,
      focal: typeof (image.focal ?? image.focal_point) === 'string' ? String(image.focal ?? image.focal_point) : '50% 50%',
      width: typeof image.width === 'number' ? image.width : null,
      height: typeof image.height === 'number' ? image.height : null,
    }];
  }).sort((a, b) => a.sort - b.sort) : [];

  return {
    featured_homepage_title: text('featured_homepage_title', 'featuredHomepageTitle'),
    featuredHomepageTitle: text('featured_homepage_title', 'featuredHomepageTitle'),
    featured_homepage_location: text('featured_homepage_location', 'featuredHomepageLocation'),
    featuredHomepageLocation: text('featured_homepage_location', 'featuredHomepageLocation'),
    featured_homepage_subtitle: text('featured_homepage_subtitle', 'featuredHomepageSubtitle'),
    featuredHomepageSubtitle: text('featured_homepage_subtitle', 'featuredHomepageSubtitle'),
    featured_homepage_cta_label: text('featured_homepage_cta_label', 'featuredHomepageCtaLabel'),
    featuredHomepageCtaLabel: text('featured_homepage_cta_label', 'featuredHomepageCtaLabel'),
    featured_homepage_cta_href: text('featured_homepage_cta_href', 'featuredHomepageCtaHref'),
    featuredHomepageCtaHref: text('featured_homepage_cta_href', 'featuredHomepageCtaHref'),
    featured_homepage_images: images,
    featuredHomepageImages: images,
  };
};
