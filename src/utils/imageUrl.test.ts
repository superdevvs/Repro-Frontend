import { describe, expect, it, vi } from 'vitest';
import { getImageUrl, getImageUrlCandidates, normalizeImageUrl } from './imageUrl';

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://reprodashboard.com' }));

describe('normalizeImageUrl private shoot media', () => {
  it('does not map shoot object keys onto the public /storage alias', () => {
    expect(normalizeImageUrl('shoots/42/thumbs/front.jpg')).toBe(
      'https://reprodashboard.com/api/public/shoot-media/file/shoots/42/thumbs/front.jpg',
    );
    expect(normalizeImageUrl('/storage/shoots/42/thumbs/front.jpg')).toBe(
      'https://reprodashboard.com/api/public/shoot-media/file/shoots/42/thumbs/front.jpg',
    );
    expect(normalizeImageUrl('https://reprodashboard.com/storage/shoots/42/web/front.jpg')).toBe(
      'https://reprodashboard.com/api/public/shoot-media/file/shoots/42/web/front.jpg',
    );
  });

  it('keeps avatars on the public storage prefix', () => {
    expect(normalizeImageUrl('avatars/user.png')).toBe('https://reprodashboard.com/storage/avatars/user.png');
  });

  it('does not send share-link zips through /storage/share-links', () => {
    expect(normalizeImageUrl('share-links/9/pack.zip')).toBe('https://reprodashboard.com/share-links/9/pack.zip');
    expect(normalizeImageUrl('/storage/share-links/9/pack.zip')).toBe(
      'https://reprodashboard.com/share-links/9/pack.zip',
    );
  });
});

describe('imported photo preview selection', () => {
  const previewPath = 'shoots/167/final/legacy-466078/small/cover.jpg';
  const preview = `https://reprodashboard.com/api/public/shoot-media/file/${previewPath}?expires=1800000000&signature=preview`;
  const original = 'https://reprodashboard.com/api/public/shoot-media/file/shoots/167/final/legacy-466078/cover.jpg?expires=1800000000&signature=original';
  const imported = {
    grid_url: preview,
    web_url: preview,
    medium_url: preview,
    medium: preview,
    thumbnail_url: preview,
    thumb_url: preview,
    thumb: preview,
    web_path: previewPath,
    thumbnail_path: previewPath,
    // The operational API aliases large to the web preview, not the original.
    large_url: preview,
    large: preview,
    original_url: original,
    original,
    url: original,
    path: 'shoots/167/final/legacy-466078/cover.jpg',
  };

  it.each(['grid', 'thumb', 'web', 'medium'] as const)(
    'keeps the signed %s preview when large aliases the same image', (size) => {
      expect(getImageUrl(imported, size)).toBe(preview);
      expect(getImageUrlCandidates(imported, size)).not.toContain(original);
    },
  );

  it('uses the signed web preview for imports without a separate grid rendition', () => {
    expect(getImageUrl({ ...imported, grid_url: undefined }, 'grid')).toBe(preview);
  });

  it('prefers a dedicated grid image when one exists', () => {
    const grid = 'https://reprodashboard.com/api/public/shoot-media/file/shoots/167/grids/cover.jpg?signature=grid';
    expect(getImageUrl({ ...imported, grid_url: grid }, 'grid')).toBe(grid);
  });

  it.each(['grid', 'thumb', 'web', 'medium'] as const)(
    'still excludes full originals from %s previews', (size) => {
      expect(getImageUrl({
        grid_url: original, web_url: original, thumbnail_url: original,
        large_url: original, original_url: original, url: original,
      }, size)).toBe('');
      expect(getImageUrl({ original_url: original, url: original, path: imported.path }, size)).toBe('');
    },
  );
});
