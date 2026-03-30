import type { ShootData } from '@/types/shoots';

type LooseRecord = Record<string, unknown>;
type ShootLike = Partial<ShootData> & {
  tour_links?: LooseRecord;
  property_details?: LooseRecord;
  iguide_tour_url?: string;
  iguide_floorplans?: unknown;
  iguide_property_id?: string;
  iguide_last_synced_at?: string;
  mls_compliant_link?: string;
  bedrooms?: string | number | null;
  bedRooms?: string | number | null;
  bathrooms?: string | number | null;
  bathRooms?: string | number | null;
  sqft?: string | number | null;
  squareFeet?: string | number | null;
  square_feet?: string | number | null;
};

export type NormalizedTourLinks = LooseRecord & {
  branded: string;
  mls: string;
  genericMls: string;
  matterport: string;
  matterport_branded: string;
  matterport_mls: string;
  iGuide: string;
  iguide_branded: string;
  iguide_mls: string;
  zillow_3d: string;
  video_link: string;
  video_branded: string;
  video_mls: string;
  video_generic: string;
};

export type NormalizedPropertyDetails = LooseRecord & {
  bedrooms?: string | number | null;
  bathrooms?: string | number | null;
  sqft?: string | number | null;
  mls_id?: string | number | null;
  price?: string | number | null;
  lot_size?: string | number | null;
  year_built?: string | number | null;
  property_type?: string | number | null;
};

const pickFirst = <T>(...values: T[]): T | undefined =>
  values.find((value) => value !== undefined && value !== null && value !== '');

const pickStringOrNumber = (...values: unknown[]): string | number | undefined => {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number') return value;
  }

  return undefined;
};

const asLooseRecord = (value: unknown): LooseRecord =>
  value && typeof value === 'object' ? (value as LooseRecord) : {};

export const getRawTourLinks = (shoot?: ShootLike | null): LooseRecord =>
  asLooseRecord(shoot?.tourLinks ?? shoot?.tour_links);

export const getRawPropertyDetails = (shoot?: ShootLike | null): LooseRecord =>
  asLooseRecord(shoot?.propertyDetails ?? shoot?.property_details);

export const normalizeTourLinks = (shoot?: ShootLike | null): NormalizedTourLinks => {
  const rawLinks = getRawTourLinks(shoot);
  const matterportBranded = String(pickFirst(rawLinks.matterport_branded, rawLinks.matterport) ?? '');
  const iGuideBranded = String(pickFirst(rawLinks.iguide_branded, rawLinks.iGuide, rawLinks.iguide) ?? '');

  return {
    ...rawLinks,
    branded: String(rawLinks.branded ?? ''),
    mls: String(rawLinks.mls ?? ''),
    genericMls: String(pickFirst(rawLinks.genericMls, rawLinks.generic_mls) ?? ''),
    matterport: String(pickFirst(rawLinks.matterport, rawLinks.matterport_branded) ?? ''),
    matterport_branded: matterportBranded,
    matterport_mls: String(rawLinks.matterport_mls ?? ''),
    iGuide: String(pickFirst(rawLinks.iGuide, rawLinks.iguide, rawLinks.iguide_branded, rawLinks.iguide_mls) ?? ''),
    iguide_branded: iGuideBranded,
    iguide_mls: String(rawLinks.iguide_mls ?? ''),
    zillow_3d: String(rawLinks.zillow_3d ?? ''),
    video_link: String(rawLinks.video_link ?? ''),
    video_branded: String(rawLinks.video_branded ?? ''),
    video_mls: String(rawLinks.video_mls ?? ''),
    video_generic: String(rawLinks.video_generic ?? ''),
  };
};

export const normalizePropertyDetails = (shoot?: ShootLike | null): NormalizedPropertyDetails => {
  const rawDetails = getRawPropertyDetails(shoot);

  return {
    ...rawDetails,
    bedrooms: pickStringOrNumber(
      shoot?.bedrooms,
      shoot?.bedRooms,
      rawDetails.bedrooms,
      rawDetails.bedRooms,
      rawDetails.beds,
      rawDetails.bed,
    ),
    bathrooms: pickStringOrNumber(
      shoot?.bathrooms,
      shoot?.bathRooms,
      rawDetails.bathrooms,
      rawDetails.bathRooms,
      rawDetails.baths,
      rawDetails.bath,
    ),
    sqft: pickStringOrNumber(
      shoot?.sqft,
      shoot?.squareFeet,
      shoot?.square_feet,
      rawDetails.sqft,
      rawDetails.squareFeet,
      rawDetails.square_feet,
      rawDetails.livingArea,
      rawDetails.living_area,
    ),
    mls_id: pickStringOrNumber(rawDetails.mls_id, rawDetails.mlsId, rawDetails.mlsNumber),
    price: pickStringOrNumber(rawDetails.price, rawDetails.listPrice, rawDetails.listingPrice),
    lot_size: pickStringOrNumber(rawDetails.lot_size, rawDetails.lotSize, rawDetails.lotSizeSqft),
    year_built: pickStringOrNumber(rawDetails.year_built, rawDetails.yearBuilt),
    property_type: pickStringOrNumber(rawDetails.property_type, rawDetails.propertyType),
  };
};

export const getPreferredIguideUrl = (shoot?: ShootLike | null): string => {
  const links = normalizeTourLinks(shoot);
  return String(
    pickFirst(
      shoot?.iguideTourUrl,
      shoot?.iguide_tour_url,
      links.iguide_branded,
      links.iguide_mls,
      links.iGuide,
    ) ?? '',
  );
};

export const normalizeIguideFloorplans = (
  shoot?: ShootLike | null,
): Array<{ url: string; filename?: string }> => {
  const source = pickFirst(shoot?.iguideFloorplans, shoot?.iguide_floorplans, []) as unknown;
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((floorplan) => {
      if (typeof floorplan === 'string') {
        return { url: floorplan, filename: 'Floorplan' };
      }

      if (!floorplan || typeof floorplan !== 'object') {
        return null;
      }

      const url = String((floorplan as LooseRecord).url || (floorplan as LooseRecord).path || '');
      if (!url) {
        return null;
      }

      return {
        url,
        filename: String((floorplan as LooseRecord).filename || 'Floorplan'),
      };
    })
    .filter((floorplan): floorplan is { url: string; filename: string } => Boolean(floorplan?.url));
};

export const getNormalizedIguideSync = (shoot?: ShootLike | null) => ({
  url: getPreferredIguideUrl(shoot),
  floorplans: normalizeIguideFloorplans(shoot),
  propertyId: String(pickFirst(shoot?.iguidePropertyId, shoot?.iguide_property_id) ?? ''),
  lastSyncedAt: String(pickFirst(shoot?.iguideLastSyncedAt, shoot?.iguide_last_synced_at) ?? ''),
});

export const getPreferredMlsTourLink = (shoot?: ShootLike | null): string => {
  const links = normalizeTourLinks(shoot);
  return String(
    pickFirst(
      links.mls,
      links.genericMls,
      links.matterport_mls,
      links.iguide_mls,
      shoot?.mls_compliant_link,
    ) ?? '',
  );
};
