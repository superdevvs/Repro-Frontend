import type { PublicTourData } from './publicTourData';

/** The gallery follows the saved delivery order; a separate hero must not reshuffle it. */
export function publicGalleryPhotos(data: PublicTourData): string[] {
  return data.locked ? [] : Array.from(new Set([...data.photos, ...data.heroPhotos]));
}
