import type { PublicTourData } from '../publicTourData';
import { normalizePublicTourUrl } from '../publicIguideModel';
import { homeifyEmbedUrl } from '../homeify/homeifyMediaUtils';

export type LandorMediaTab = 'photos' | 'plans' | 'video' | 'tour';

/** Shared availability rules keep navigation and the rendered panels in agreement. */
export function getLandorMedia(data: PublicTourData) {
  const photos = data.locked ? [] : data.heroSlides;
  const floorplans = data.locked ? [] : data.floorplans.filter((plan) => [
    plan.image, plan.preview_url, plan.web_url, plan.thumbnail_url,
    ...(Array.isArray(plan.previewImages) ? plan.previewImages : []),
    ...(Array.isArray(plan.preview_images) ? plan.preview_images : []),
  ].some((value) => Boolean(normalizePublicTourUrl(value))));
  const videos = data.locked ? [] : Array.from(new Set([...data.videos, data.videoLink].map((video) => homeifyEmbedUrl(video)).filter(Boolean)));
  const embeds = data.locked ? [] : data.embeds.map((embed) => ({ ...embed, url: homeifyEmbedUrl(embed.value) })).filter((embed) => Boolean(embed.url));
  const hasProviders = !data.locked && Boolean(normalizePublicTourUrl(data.iguide.inlineUrl) || normalizePublicTourUrl(data.matterportUrl));
  const available: { id: LandorMediaTab; label: string }[] = [
    ...(photos.length ? [{ id: 'photos' as const, label: 'Photos' }] : []),
    ...(floorplans.length ? [{ id: 'plans' as const, label: 'Plans' }] : []),
    ...(videos.length ? [{ id: 'video' as const, label: 'Video' }] : []),
    ...(hasProviders || embeds.length ? [{ id: 'tour' as const, label: '3D tour' }] : []),
  ];
  return { photos, floorplans, videos, embeds, hasProviders, available };
}

export const hasLandorMedia = (data: PublicTourData): boolean => getLandorMedia(data).available.length > 0;
