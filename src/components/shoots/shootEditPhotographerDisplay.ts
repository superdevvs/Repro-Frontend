import type { Photographer } from './shootEditModalTypes';

export const formatPhotographerLocationLabel = (photographer?: Photographer | null) => {
  if (!photographer) return '';
  const parts = [photographer.address, photographer.city, photographer.state, photographer.zip]
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean);
  return parts.join(', ');
};
