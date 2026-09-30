import type { ShootData } from '@/types/shoots';

export type FeaturedHomepageImageDraft = {
  shoot_file_id: number;
  sort: number;
  alt: string;
  focal: string;
};

export const normalizeFeaturedHomepageImages = (shoot: Partial<ShootData>): FeaturedHomepageImageDraft[] =>
  (shoot.featured_homepage_images ?? shoot.featuredHomepageImages ?? [])
    .map((value, index) => {
      const image = value as unknown as Record<string, unknown>;
      return {
        shoot_file_id: Number(image.shoot_file_id ?? image.shootFileId),
        sort: Number(image.sort ?? image.sort_order ?? index + 1),
        alt: String(image.alt ?? image.alt_text ?? ''),
        focal: String(image.focal ?? image.focal_point ?? '50% 50%'),
      };
    })
    .filter((image) => Number.isInteger(image.shoot_file_id) && image.shoot_file_id > 0)
    .sort((a, b) => a.sort - b.sort);

export const withHomepageCover = (shoot: Partial<ShootData>, fileId: number): FeaturedHomepageImageDraft[] => {
  const images = normalizeFeaturedHomepageImages(shoot);
  const existingCover = images.find((image) => image.shoot_file_id === fileId);
  const ordered = [
    existingCover ?? { shoot_file_id: fileId, sort: 1, alt: '', focal: '50% 50%' },
    ...images.filter((image) => image.shoot_file_id !== fileId),
  ];
  if (ordered.length > 10) {
    throw new Error('This project already has 10 images. Choose a cover from its existing homepage gallery.');
  }
  return ordered.map((image, index) => ({ ...image, sort: index + 1 }));
};

export const resolveFeaturedHomepageState = (shoot: Partial<ShootData>) => {
  const approved = Boolean(shoot.is_featured ?? shoot.isFeatured);
  const pending = !approved && Boolean(
    shoot.featured_pending ?? shoot.featuredPending
      ?? (shoot.featured_requested_at || shoot.featuredRequestedAt
        || (shoot.featured_status ?? shoot.featuredStatus) === 'pending'),
  );
  return { approved, pending };
};
