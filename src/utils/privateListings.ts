import { API_BASE_URL } from '@/config/env';
import type { PrivateListing } from '@/types/privateListings';

export type ListingRecord = Record<string, unknown>;
type GeoCache = Record<string, { lat: number; lng: number }>;

const GEO_CACHE_KEY = 'exclusive-listing-geo-cache-v1';

export const asListingRecord = (value: unknown): ListingRecord =>
  value !== null && typeof value === 'object' ? value as ListingRecord : {};

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const readGeoCache = (): GeoCache => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(GEO_CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const cache = asListingRecord(parsed);
    return Object.entries(cache).reduce<GeoCache>((result, [key, value]) => {
      const coordinates = asListingRecord(value);
      const lat = toFiniteNumber(coordinates.lat);
      const lng = toFiniteNumber(coordinates.lng);
      if (lat !== undefined && lng !== undefined) result[key] = { lat, lng };
      return result;
    }, {});
  } catch {
    return {};
  }
};

export const writeGeoCache = (cache: GeoCache) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage may be unavailable in private mode or when the quota is full.
  }
};

export const resolveApiCoordinates = (
  value: unknown,
): Pick<PrivateListing, 'latitude' | 'longitude' | 'coordsSource'> => {
  const shoot = asListingRecord(value);
  const location = asListingRecord(shoot.location);
  const propertyDetails = asListingRecord(shoot.property_details ?? shoot.propertyDetails);
  const latitude = toFiniteNumber(location.latitude ?? shoot.latitude ?? propertyDetails.latitude ?? propertyDetails.lat);
  const longitude = toFiniteNumber(location.longitude ?? shoot.longitude ?? propertyDetails.longitude ?? propertyDetails.lng);
  return latitude === undefined || longitude === undefined
    ? {}
    : { latitude, longitude, coordsSource: 'api' };
};

export const hasListingCoords = (listing: Pick<PrivateListing, 'latitude' | 'longitude'>) =>
  Number.isFinite(listing.latitude) && Number.isFinite(listing.longitude);

export const resolveListingPreviewUrl = (value: string | null | undefined): string | null => {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const base = String(API_BASE_URL || '').replace(/\/+$/, '');
  const withBase = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  try {
    return new URL(withBase).toString();
  } catch {
    return withBase;
  }
};

export const formatListingPrice = (price?: number | null): string =>
  price ? `$${price.toLocaleString()}` : '';

export const getBrandedTourUrl = (shootId: string): string => {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/tour/branded?shootId=${encodeURIComponent(shootId)}`;
};

export interface DeliveredShootOption {
  id: string;
  title: string;
  subtitle: string;
  searchText: string;
}

export const toDeliveredShootOption = (shoot: ListingRecord): DeliveredShootOption => {
  const location = asListingRecord(shoot.location);
  const client = asListingRecord(shoot.client);
  const address = optionalString(location.fullAddress) || optionalString(shoot.fullAddress)
    || [optionalString(shoot.address), optionalString(shoot.city)].filter(Boolean).join(', ');
  const city = optionalString(location.city) || optionalString(shoot.city) || '';
  const clientName = optionalString(client.name) || 'Unknown';
  const status = optionalString(shoot.workflowStatus ?? shoot.workflow_status ?? shoot.status) || '';
  return {
    id: String(shoot.id ?? ''),
    title: address,
    subtitle: `${clientName} · ${status.toLowerCase()}`,
    searchText: `${address} ${city} ${clientName}`.toLowerCase(),
  };
};

export const normalizePrivateListing = (value: unknown): PrivateListing | null => {
  const shoot = asListingRecord(value);
  if (shoot.id === null || shoot.id === undefined) return null;
  const location = asListingRecord(shoot.location);
  const client = asListingRecord(shoot.client);
  const photographer = asListingRecord(shoot.photographer);
  const payment = asListingRecord(shoot.payment);
  const propertyDetails = asListingRecord(shoot.property_details ?? shoot.propertyDetails);
  const address = optionalString(shoot.address) || optionalString(location.address) || '';
  const city = optionalString(shoot.city) || optionalString(location.city) || '';
  const state = optionalString(shoot.state) || optionalString(location.state) || '';
  const zip = optionalString(shoot.zip) || optionalString(location.zip) || '';
  const listingType = shoot.listing_type ?? shoot.listingType;
  const rawServices = Array.isArray(shoot.services) ? shoot.services : [];
  const rawFloorplans = shoot.cubicasaFloorplans ?? shoot.cubicasa_floorplans
    ?? shoot.iguide_floorplans ?? shoot.floorplans;
  const floorplans = Array.isArray(rawFloorplans)
    ? rawFloorplans.flatMap((item) => typeof item === 'string' || (item !== null && typeof item === 'object') ? [item as string | ListingRecord] : [])
    : [];

  return {
    id: String(shoot.id),
    address,
    city,
    state,
    zip,
    fullAddress: optionalString(location.fullAddress) || optionalString(shoot.fullAddress)
      || [address, city, state, zip].filter(Boolean).join(', '),
    heroImage: optionalString(shoot.heroImage) || optionalString(shoot.hero_image),
    scheduledDate: optionalString(shoot.scheduledDate) || optionalString(shoot.scheduled_date),
    completedDate: optionalString(shoot.completedDate) || optionalString(shoot.completed_date),
    client: { name: optionalString(client.name) || 'Unknown', email: optionalString(client.email) },
    photographer: Object.keys(photographer).length
      ? { name: optionalString(photographer.name) || 'Unassigned' }
      : undefined,
    services: rawServices.map((service) => typeof service === 'string'
      ? service
      : optionalString(asListingRecord(service).name) || '').filter(Boolean),
    status: optionalString(shoot.status) || optionalString(shoot.workflow_status) || 'unknown',
    payment: {
      totalPaid: toFiniteNumber(payment.totalPaid ?? payment.total_paid ?? shoot.total_paid),
      totalQuote: toFiniteNumber(payment.totalQuote ?? payment.total_quote ?? shoot.total_quote),
    },
    tourLinks: asListingRecord(shoot.tourLinks ?? shoot.tour_links),
    floorplans,
    isPrivateListing: Boolean(shoot.is_private_listing ?? shoot.isPrivateListing),
    isListingHidden: Boolean(shoot.is_listing_hidden ?? shoot.isListingHidden),
    listing_type: listingType === 'for_rent' || listingType === 'for_sale' ? listingType : undefined,
    bedrooms: toFiniteNumber(shoot.bedrooms ?? propertyDetails.bedrooms),
    bathrooms: toFiniteNumber(shoot.bathrooms ?? propertyDetails.bathrooms),
    sqft: toFiniteNumber(shoot.sqft ?? propertyDetails.sqft),
    price: toFiniteNumber(shoot.price ?? propertyDetails.price),
    mls_number: optionalString(shoot.mls_number ?? shoot.mls_id),
    ...resolveApiCoordinates(shoot),
  };
};
