import { API_BASE_URL } from '@/config/env';
import type { TourFloorplan } from './FloorplanSection';
import {
  normalizePublicTourUrl,
  resolvePublicEmbedSources,
  resolvePublicIguideSources,
  type PublicIguideSources,
  type PublicTourVariant,
} from './publicIguideModel';

type RecordValue = Record<string, unknown>;
type PropertyValue = string | number | null;

export interface PublicTourShoot {
  id: number | string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  client_name?: string;
  client_company?: string;
  client_email?: string;
  client_phone?: string;
  client_avatar?: string;
}

export interface PublicTourBranding {
  logo: string;
  banner: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  about: string;
  facebook_url: string;
  linkedin_url: string;
  instagram_url: string;
  show_map: boolean;
}

export interface PublicTourPropertyDetails extends RecordValue {
  beds: PropertyValue;
  baths: PropertyValue;
  sqft: PropertyValue;
  price: PropertyValue;
  lot_size: PropertyValue;
  mls_id: PropertyValue;
  year_built: PropertyValue;
  property_type: PropertyValue;
  listing_type: string;
  property_status: string;
  description: string;
}

export interface PublicTourEmbed {
  id: string;
  title: string;
  branded: string;
  mls: string;
  value: string;
}

export interface PublicTourData {
  variant: PublicTourVariant;
  shoot: PublicTourShoot | null;
  branding: PublicTourBranding | null;
  propertyDetails: PublicTourPropertyDetails;
  stats: { beds: number | null; baths: number | null; sqft: number | null; garageCars: number | null };
  photos: string[];
  heroPhotos: string[];
  heroSlides: string[];
  videos: string[];
  videoLink: string;
  videoPosterUrl: string;
  floorplans: TourFloorplan[];
  matterportUrl: string;
  iguide: PublicIguideSources;
  embeds: PublicTourEmbed[];
  featuredEmbedId: string;
  tourSettings: { realtor_info: string; autoplay: boolean; header_position: string; tour_version: string };
  tourStyle: string;
  showGarage: boolean;
  locked: boolean;
  lockedMessage: string;
  empty: boolean;
  analytics: { shootId: number | string | null; tourType: 'branded' | 'mls' | 'generic_mls' };
}

const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};

const text = (...values: unknown[]): string => {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return typeof value === 'string' ? value.trim() : '';
};

const propertyValue = (...values: unknown[]): PropertyValue => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const number = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    if (typeof value === 'string' && !value.trim()) continue;
    const parsed = Number(typeof value === 'string' ? value.replace(/,/g, '').trim() : value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
};

const flag = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true';
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const urls = (value: unknown): string[] => Array.from(new Set(array(value).map((item) => {
  const media = record(item);
  return normalizePublicTourUrl(typeof item === 'string' ? item : text(media.url, media.web_url, media.path));
}).filter(Boolean)));

/** Address lookup matches existing tour URLs and selects the most recent matching shoot. */
export function buildPublicTourEndpoint(search: string | URLSearchParams, variant: PublicTourVariant): string | null {
  const params = new URLSearchParams(search);
  const endpoint = variant === 'generic-mls' ? 'g-mls' : variant;
  const base = `${API_BASE_URL.replace(/\/$/, '')}/api/public/shoots`;
  const address = text(params.get('address'));
  const city = text(params.get('city'));
  const state = text(params.get('state'));
  if (address && city && state) {
    const query = new URLSearchParams({ address, city, state });
    const zip = text(params.get('zip'));
    if (zip) query.set('zip', zip);
    return `${base}/${endpoint}?${query.toString()}`;
  }
  const shootId = text(params.get('shootId'));
  return shootId ? `${base}/${encodeURIComponent(shootId)}/${endpoint}` : null;
}

/** A presentation model shared by layouts; branding never escapes into MLS variants. */
export function normalizePublicTourData(payload: unknown, variant: PublicTourVariant): PublicTourData {
  const root = record(payload);
  const rawShoot = record(root.shoot);
  const details = record(root.property_details ?? root.propertyDetails);
  const links = record(root.tour_links ?? root.tourLinks);
  const branded = variant === 'branded';
  const locked = flag(root.locked);
  const videoRestricted = flag(root.video_access_restricted);
  const shootId = propertyValue(rawShoot.id);
  const shoot: PublicTourShoot | null = Object.keys(rawShoot).length ? {
    id: shootId,
    address: text(rawShoot.address), city: text(rawShoot.city), state: text(rawShoot.state), zip: text(rawShoot.zip),
    ...(branded ? {
      client_name: text(rawShoot.client_name), client_company: text(rawShoot.client_company),
      client_email: text(rawShoot.client_email), client_phone: text(rawShoot.client_phone),
      client_avatar: normalizePublicTourUrl(rawShoot.client_avatar),
    } : {}),
  } : null;
  const rawBranding = record(root.branding);
  const branding: PublicTourBranding | null = branded && Object.keys(rawBranding).length ? {
    logo: normalizePublicTourUrl(rawBranding.logo), banner: normalizePublicTourUrl(rawBranding.banner),
    primary_color: text(rawBranding.primary_color), secondary_color: text(rawBranding.secondary_color),
    font_family: text(rawBranding.font_family), about: text(rawBranding.about),
    facebook_url: normalizePublicTourUrl(rawBranding.facebook_url),
    linkedin_url: normalizePublicTourUrl(rawBranding.linkedin_url),
    instagram_url: normalizePublicTourUrl(rawBranding.instagram_url), show_map: flag(rawBranding.show_map),
  } : null;
  const building = record(array(details.building)[0]);
  const area = array(details.areas).map(record).find((item) => /Living|Finished|Building/i.test(text(item.type)));
  const fullBaths = number(building.fullBaths);
  const halfBaths = number(building.halfBaths);
  const beds = number(details.beds, details.bedrooms, building.bedrooms);
  const baths = number(details.baths, details.bathrooms,
    fullBaths !== null || halfBaths !== null ? (fullBaths ?? 0) + (halfBaths ?? 0) * 0.5 : null, building.baths);
  const sqft = number(details.sqft, details.squareFeet, details.square_feet, details.living_area, details.livingArea, area?.areaSquareFeet);
  const garages = array(details.garages).map(record);
  const showGarage = flag(root.show_garage ?? links.show_garage);
  const garageTotal = garages.reduce((total, garage) => total + (number(garage.carCount) ?? 0), 0);
  const garageCars = showGarage ? number(details.garage_cars, garages.length ? garageTotal || garages.length : null) : null;
  const photos = locked ? [] : urls(root.photos);
  const heroPhotos = locked ? [] : urls(root.hero_photos);
  const videoFallback = branded ? text(links.video_branded, links.video_link)
    : variant === 'generic-mls' ? text(links.video_generic, links.video_mls) : text(links.video_mls);
  const featuredEmbedId = text(links.featured_embed_id, links.featured_embed);
  const embeds = locked || videoRestricted ? [] : array(links.embeds ?? root.embeds).map((item, index): PublicTourEmbed => {
    const embed = record(item);
    const sources = resolvePublicEmbedSources(embed, variant);
    return {
      id: String(propertyValue(embed.id) ?? `embed-${shootId ?? 'tour'}-${index}`),
      title: text(embed.title) || `Tour ${index + 1}`,
      ...sources,
      value: branded ? sources.branded || sources.mls : sources.mls,
    };
  }).filter((embed) => Boolean(embed.value));
  const featured = embeds.find((embed) => embed.id === featuredEmbedId);
  const rawFloorplans = array(root.floorplans).length ? root.floorplans : root.iguide_floorplans;
  const floorplans: TourFloorplan[] = locked ? [] : array(rawFloorplans).flatMap((item) => {
    if (typeof item === 'string') {
      const url = normalizePublicTourUrl(item);
      return url ? [{ url }] : [];
    }
    const floorplan = record(item);
    if (!Object.keys(floorplan).length) return [];
    // Retain generated previews and all provider metadata instead of flattening a PDF to a URL.
    return [{ ...floorplan } as TourFloorplan];
  });
  const videos = locked || videoRestricted ? [] : urls(root.videos);
  const videoLink = locked || videoRestricted ? '' : normalizePublicTourUrl(text(root.video_link, videoFallback));
  const iguide = resolvePublicIguideSources(locked ? {} : root, variant);
  const matterportUrl = locked ? '' : normalizePublicTourUrl(text(root.matterport_url,
    branded ? text(links.matterport_branded, links.matterport) : links.matterport_mls));
  return {
    variant, shoot, branding,
    propertyDetails: {
      ...details, beds, baths, sqft,
      price: propertyValue(details.price, details.listPrice, details.listingPrice),
      lot_size: propertyValue(details.lot_size, details.lotSize),
      mls_id: propertyValue(details.mls_id, details.mlsId, details.mlsNumber),
      year_built: propertyValue(details.year_built, details.yearBuilt),
      property_type: propertyValue(details.property_type, details.propertyType),
      listing_type: text(details.listing_type, details.listingType),
      property_status: text(details.property_status, details.propertyStatus, details.status),
      description: text(details.description),
    },
    stats: { beds, baths, sqft, garageCars }, photos, heroPhotos,
    heroSlides: Array.from(new Set([...heroPhotos, ...photos])),
    videos, videoLink,
    videoPosterUrl: locked || videoRestricted ? '' : normalizePublicTourUrl(text(root.video_poster_url, root.video_thumbnail_url)),
    floorplans, matterportUrl, iguide,
    embeds: featured ? [featured, ...embeds.filter((embed) => embed !== featured)] : embeds,
    featuredEmbedId,
    tourSettings: {
      realtor_info: branded ? text(links.realtor_info) : '', autoplay: flag(links.autoplay),
      header_position: text(links.header_position) || 'center', tour_version: text(links.tour_version) || 'standard',
    },
    tourStyle: text(root.tour_style, links.tour_style) || 'default', showGarage, locked,
    lockedMessage: locked ? text(root.message) || 'Payment required to unlock this tour.' : '',
    empty: !locked && !shoot && !photos.length && !heroPhotos.length && !videos.length && !videoLink
      && !floorplans.length && !embeds.length && !iguide.inlineUrl && !matterportUrl,
    analytics: { shootId, tourType: variant === 'generic-mls' ? 'generic_mls' : variant },
  };
}
