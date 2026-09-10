import type { SyntheticEvent } from 'react';

export const preventTourImageDownloadGesture = (event: SyntheticEvent) => event.preventDefault();

export const showMissingTourImage = (event: SyntheticEvent<HTMLImageElement>) => {
  const image = event.currentTarget;
  if (image.dataset.fallback) return;
  image.dataset.fallback = 'true';
  image.src = '/no-image-placeholder-light.svg';
};
