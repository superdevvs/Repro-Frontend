import type { ShootData } from '@/types/shoots';

type LooseRecord = Record<string, unknown>;
type RealtorClientLite = {
  id: string;
  name: string;
  email?: string;
  company?: string;
};
type ShootLike = Partial<ShootData> & {
  tour_links?: LooseRecord;
  property_details?: LooseRecord;
  iguide_tour_url?: string;
  iguide_floorplans?: unknown;
  iguide_property_id?: string;
  iguide_work_order_id?: string;
  iguideWorkOrderId?: string;
  iguide_last_synced_at?: string;
  iguide_data?: LooseRecord | null;
  iguideData?: LooseRecord | null;
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
  realtor_client_id: string;
  realtor_client?: RealtorClientLite | null;
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
  const rawRealtorClient = pickFirst(
    rawLinks.realtor_client,
    rawLinks.realtorClient,
    (shoot as LooseRecord | undefined)?.realtor_client,
    (shoot as LooseRecord | undefined)?.realtorClient,
  );
  const normalizedRealtorClient =
    rawRealtorClient && typeof rawRealtorClient === 'object'
      ? {
          id: String((rawRealtorClient as LooseRecord).id ?? ''),
          name: String((rawRealtorClient as LooseRecord).name ?? ''),
          email: String((rawRealtorClient as LooseRecord).email ?? ''),
          company: String(
            (rawRealtorClient as LooseRecord).company
              ?? (rawRealtorClient as LooseRecord).company_name
              ?? '',
          ),
        }
      : null;

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
    realtor_client_id: String(pickFirst(rawLinks.realtor_client_id, rawLinks.realtorClientId) ?? ''),
    realtor_client: normalizedRealtorClient?.id ? normalizedRealtorClient : null,
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

export type NormalizedIguideFloorplan = {
  url: string;
  filename: string;
  label?: string;
  type?: string;
  units?: string;
  asset_key?: string;
  floor_name?: string;
  floor_id?: number | string | null;
};

export const normalizeIguideFloorplans = (
  shoot?: ShootLike | null,
): NormalizedIguideFloorplan[] => {
  const source = pickFirst(shoot?.iguideFloorplans, shoot?.iguide_floorplans, []) as unknown;
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((floorplan) => {
      if (typeof floorplan === 'string') {
        return { url: floorplan, filename: 'Floorplan' } as NormalizedIguideFloorplan;
      }

      if (!floorplan || typeof floorplan !== 'object') {
        return null;
      }

      const fp = floorplan as LooseRecord;
      const url = String(fp.url || fp.path || '');
      if (!url) {
        return null;
      }

      return {
        url,
        filename: String(fp.filename || 'Floorplan'),
        label: typeof fp.label === 'string' ? fp.label : undefined,
        type: typeof fp.type === 'string' ? fp.type : undefined,
        units: typeof fp.units === 'string' ? fp.units : undefined,
        asset_key: typeof fp.asset_key === 'string' ? fp.asset_key : undefined,
        floor_name: typeof fp.floor_name === 'string' ? fp.floor_name : undefined,
        floor_id: (fp.floor_id as number | string | null | undefined) ?? null,
      } as NormalizedIguideFloorplan;
    })
    .filter((floorplan): floorplan is NormalizedIguideFloorplan => Boolean(floorplan?.url));
};

export type NormalizedIguideBilling = {
  iguideType?: string;
  package?: string;
  addons: string[];
  billableAreaSqFeet?: number;
  billableAreaSqMeters?: number;
};

export type NormalizedIguideSync = {
  url: string;
  unbrandedUrl: string;
  embeddedUrl: string;
  manageUrl: string;
  embedImageUrl: string;
  galleryFrontUrl: string;
  galleryZipUrl: string;
  galleryLowResZipUrl: string;
  sphereZipUrl: string;
  offlineZipUrl: string;
  pdfMetricUrl: string;
  pdfImperialUrl: string;
  propertyId: string;
  workOrderId: string;
  iguideAlias: string;
  defaultViewId: string;
  authToken: string;
  lastSyncedAt: string;
  floorplans: NormalizedIguideFloorplan[];
  jpgMetric: Array<{ id: number | null; floor_name: string | null; url: string }>;
  jpgImperial: Array<{ id: number | null; floor_name: string | null; url: string }>;
  billing: NormalizedIguideBilling | null;
  raw: LooseRecord;
};

const getRawIguideData = (shoot?: ShootLike | null): LooseRecord =>
  asLooseRecord(shoot?.iguideData ?? shoot?.iguide_data);

type JpgFloorEntry = { id: number | null; floor_name: string | null; url: string };

const normalizeJpgFloors = (source: unknown): JpgFloorEntry[] => {
  if (!Array.isArray(source)) return [];
  const out: JpgFloorEntry[] = [];
  for (const entry of source) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as LooseRecord;
    const url = typeof e.url === 'string' ? e.url : '';
    if (!url) continue;
    out.push({
      id: typeof e.id === 'number' ? e.id : null,
      floor_name:
        typeof e.floor_name === 'string'
          ? e.floor_name
          : typeof e.floorName === 'string'
            ? e.floorName
            : null,
      url,
    });
  }
  return out;
};

const normalizeBilling = (raw: LooseRecord): NormalizedIguideBilling | null => {
  const billing = asLooseRecord(raw.billing);
  if (!billing || Object.keys(billing).length === 0) return null;
  const addons = Array.isArray(billing.addons) ? billing.addons.filter((a) => typeof a === 'string') : [];
  return {
    iguideType: typeof billing.iguideType === 'string' ? billing.iguideType : undefined,
    package: typeof billing.package === 'string' ? billing.package : undefined,
    addons: addons as string[],
    billableAreaSqFeet:
      typeof billing.billableAreaSqFeet === 'number' ? billing.billableAreaSqFeet : undefined,
    billableAreaSqMeters:
      typeof billing.billableAreaSqMeters === 'number' ? billing.billableAreaSqMeters : undefined,
  };
};

export const getNormalizedIguideSync = (shoot?: ShootLike | null): NormalizedIguideSync => {
  const raw = getRawIguideData(shoot);
  const pickStr = (...values: unknown[]) => String(pickFirst(...values) ?? '');

  return {
    url: getPreferredIguideUrl(shoot),
    unbrandedUrl: pickStr(raw.unbranded_url),
    embeddedUrl: pickStr(raw.embedded_url),
    manageUrl: pickStr(raw.manage_url),
    embedImageUrl: pickStr(raw.embed_image_url),
    galleryFrontUrl: pickStr(raw.gallery_front_url),
    galleryZipUrl: pickStr(raw.gallery_zip_url),
    galleryLowResZipUrl: pickStr(raw.gallery_low_res_zip_url),
    sphereZipUrl: pickStr(raw.sphere_zip_url),
    offlineZipUrl: pickStr(raw.offline_zip_url),
    pdfMetricUrl: pickStr(raw.pdf_metric_url),
    pdfImperialUrl: pickStr(raw.pdf_imperial_url),
    propertyId: pickStr(shoot?.iguidePropertyId, shoot?.iguide_property_id, raw.property_id),
    workOrderId: pickStr(shoot?.iguideWorkOrderId, shoot?.iguide_work_order_id, raw.work_order_id),
    iguideAlias: pickStr(raw.iguide_alias),
    defaultViewId: pickStr(raw.default_view_id),
    authToken: pickStr(raw.authtoken),
    lastSyncedAt: pickStr(shoot?.iguideLastSyncedAt, shoot?.iguide_last_synced_at),
    floorplans: normalizeIguideFloorplans(shoot),
    jpgMetric: normalizeJpgFloors(raw.jpg_metric),
    jpgImperial: normalizeJpgFloors(raw.jpg_imperial),
    billing: normalizeBilling(raw),
    raw,
  };
};

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
