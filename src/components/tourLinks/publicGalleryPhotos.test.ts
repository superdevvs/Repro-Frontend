import { expect, it } from 'vitest';
import { normalizePublicTourData } from './publicTourData';
import { publicGalleryPhotos } from './publicGalleryPhotos';
it('retains a cover-only historical image without moving it ahead of gallery photos', () => {
  const data = normalizePublicTourData({ photos: ['https://media.test/first.jpg'], hero_photos: ['https://media.test/cover.jpg'] }, 'branded');
  expect(publicGalleryPhotos(data)).toEqual(['https://media.test/first.jpg', 'https://media.test/cover.jpg']);
  expect(publicGalleryPhotos(normalizePublicTourData({ hero_photos: ['https://media.test/cover.jpg'] }, 'branded'))).toEqual(['https://media.test/cover.jpg']);
  expect(publicGalleryPhotos({ ...data, locked: true })).toEqual([]);
});
