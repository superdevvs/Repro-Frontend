import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';
import { trackMediaView } from '@/lib/tourTracking';
import type { PublicTourData } from '../publicTourData';
import { useLandorModel } from '../landor/useLandorModel';
import { getLandorMedia } from '../landor/landorMediaModel';

export type TemplateTourSection = { id: string; label: string };

const numeric = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
};

/**
 * One-page tours adapted from purchased templates (Ofen, Maison) stack every
 * media type instead of tabbing it, so each section exists only when the
 * shoot has published content for it and the navigation mirrors that list.
 */
export function useTemplateTourModel(data: PublicTourData) {
  const model = useLandorModel(data);
  const media = useMemo(() => getLandorMedia(data), [data]);
  const { property, stats } = model;
  const hasPlans = media.floorplans.length > 0 || Boolean(media.zillowFloorplan);
  const hasTour = media.hasProviders || media.embeds.length > 0;
  const hasAbout = Boolean(property.description) || model.facts.length > 0 || model.details.length > 0;
  const sections: TemplateTourSection[] = [
    ...(hasAbout ? [{ id: 'overview', label: 'Overview' }] : []),
    ...(media.photos.length ? [{ id: 'gallery', label: 'Photos' }] : []),
    ...(media.videos.length ? [{ id: 'video', label: 'Video' }] : []),
    ...(hasTour ? [{ id: 'tour', label: '3D tour' }] : []),
    ...(hasPlans ? [{ id: 'floorplans', label: 'Floor plans' }] : []),
    { id: 'location', label: 'Location' },
    ...(model.hasContact ? [{ id: 'contact', label: 'Agent' }] : []),
  ];
  const mailto = model.shoot?.client_email
    ? `mailto:${model.shoot.client_email}?subject=${encodeURIComponent(`Property inquiry: ${model.address}`)}`
    : '';
  const priceValue = numeric(property.price);
  const pricePerSqft = priceValue && stats.sqft ? `$${Math.round(priceValue / stats.sqft).toLocaleString('en-US')} per sq ft` : '';
  const status = [property.listing_type, property.property_status].map((value) => model.titleCase(value).trim()).filter(Boolean);
  // The cover photo leads the page; the gallery keeps the delivery order.
  const cover = model.hero || media.photos[0] || '';
  const coverIndex = Math.max(0, media.photos.indexOf(cover));
  const providerNames = [
    data.iguide.inlineUrl ? 'iGUIDE' : '', data.matterportUrl ? 'Matterport' : '', data.zillowUrl ? 'Zillow' : '',
    ...media.embeds.map((embed) => embed.title),
  ].filter(Boolean);
  return { ...model, media, hasPlans, hasTour, hasAbout, sections, mailto, pricePerSqft, status, cover, coverIndex, providerNames };
}

export type TemplateTourModel = ReturnType<typeof useTemplateTourModel>;

/** Lightbox state shared by the template galleries; focus returns to the tile that opened it. */
export function usePhotoViewer(data: PublicTourData, photos: string[]) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const { shootId, tourType } = data.analytics;
  const show = useCallback((event: MouseEvent<HTMLElement>, photoIndex: number) => {
    opener.current = event.currentTarget;
    setIndex(photoIndex);
    setOpen(true);
    if (shootId !== null) trackMediaView(shootId, tourType, photoIndex, photos[photoIndex]);
  }, [photos, shootId, tourType]);
  return { index, setIndex, open, setOpen, opener, show };
}
