import type { SyntheticEvent } from 'react';
import type { PublicTourPhotoRenditions, PublicTourPhotoRendition } from '../publicTourData';

export const publicTourImageSource = (
  photo: string,
  size: keyof PublicTourPhotoRendition,
  renditions?: PublicTourPhotoRenditions,
) => renditions?.[photo]?.[size] || photo;

export const preventTourImageDownloadGesture = (event: SyntheticEvent) => event.preventDefault();

export const showMissingTourImage = (event: SyntheticEvent<HTMLImageElement>) => {
  const image = event.currentTarget;
  if (image.dataset.fallback) return;
  image.dataset.fallback = 'true';
  image.src = '/no-image-placeholder-light.svg';
};
