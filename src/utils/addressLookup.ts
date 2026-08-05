import { validateLivingAreaSqft } from '@/utils/squareFootage';
import { DEFAULT_LIVING_AREA_SQFT_CONFIG } from '@/config/squareFootageDefaults';

export type AddressRecord = Record<string, unknown>;

const asRecord = (value: unknown): AddressRecord =>
  value !== null && typeof value === 'object' ? value as AddressRecord : {};

export interface AddressSuggestion {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  types: string[];
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  raw?: AddressRecord;
  source?: string;
}
export interface AddressDetails {
  formatted_address: string;
  address: string;
  apt_suite?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  mls_id?: string;
  price?: number;
  lot_size?: number;
  year_built?: number;
  property_type?: string;
  garage_cars?: number;
  garage_sqft?: number;
  property_details?: AddressRecord;
  raw_parcel_data?: AddressRecord;
  raw_assessment_data?: AddressRecord;
  raw_legacy_data?: AddressRecord;
  manual_override?: AddressRecord;
  override_applied?: boolean;
  override_fields?: string[];
  zpid?: string;
  source?: string;
  confidence?: number;
  field_sources?: Record<string, string>;
  property_source_chain?: string[];
}
export const normalizeNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

export const normalizeString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
};

const parseSecondaryText = (text?: string) => {
  if (!text) {
    return { city: '', state: '', zip: '', country: '' };
  }

  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  const city = parts[0] || '';
  let state = '';
  let zip = '';

  if (parts.length >= 2) {
    const stateZipParts = parts[1].split(/\s+/).filter(Boolean);
    state = stateZipParts[0] || '';
    zip = stateZipParts.slice(1).join(' ') || '';
  }

  const country = parts.length >= 3 ? parts[2] : '';

  return { city, state, zip, country };
};

/**
 * Known U.S. street suffixes mapped to their canonical expanded form.
 * Keys are the lower-cased token (trailing periods stripped); used for
 * token-aware trailing-suffix detection so a suffix is never concatenated
 * with the preceding street-name word (e.g. never `LakeBoulevard`).
 */
const STREET_SUFFIXES: Record<string, string> = {
  ave: 'Avenue', av: 'Avenue', avenue: 'Avenue',
  blvd: 'Boulevard', boul: 'Boulevard', boulevard: 'Boulevard',
  st: 'Street', str: 'Street', street: 'Street',
  rd: 'Road', road: 'Road',
  dr: 'Drive', drive: 'Drive',
  ln: 'Lane', lane: 'Lane',
  ct: 'Court', court: 'Court',
  pl: 'Place', place: 'Place',
  ter: 'Terrace', terr: 'Terrace', terrace: 'Terrace',
  cir: 'Circle', circle: 'Circle',
  pkwy: 'Parkway', pky: 'Parkway', parkway: 'Parkway',
  hwy: 'Highway', highway: 'Highway',
  way: 'Way',
  trl: 'Trail', trail: 'Trail',
  sq: 'Square', square: 'Square',
  loop: 'Loop',
  row: 'Row',
  run: 'Run',
  pike: 'Pike',
  path: 'Path',
  pt: 'Point', point: 'Point',
  cres: 'Crescent', crescent: 'Crescent',
  expy: 'Expressway', expressway: 'Expressway',
  aly: 'Alley', alley: 'Alley',
};

export interface ParsedStreetLine {
  number?: string;
  name: string;
  suffix?: string;
  unit?: string;
}

/**
 * Pure helper that parses a single street line into its structured parts
 * without ever merging adjacent tokens.
 *
 * It operates on the street segment only (anything after the first comma is
 * ignored), tokenizes on whitespace, peels a leading street number, detects a
 * trailing suffix from {@link STREET_SUFFIXES}, and optionally extracts a unit
 * designator (Apt/Unit/Suite/#...). Remaining tokens are joined with single
 * spaces so the street name stays intact.
 *
 * Example: `3300 Lake Austin Blvd` →
 *   { number: '3300', name: 'Lake Austin', suffix: 'Boulevard' }
 * (never `LakeBoulevard`).
 */
export const parseStreetLine = (line?: string | null): ParsedStreetLine => {
  const rawFull = typeof line === 'string' ? line.trim() : '';
  if (!rawFull) {
    return { name: '' };
  }

  // Only the first comma-delimited segment is the street line.
  let working = rawFull.split(',')[0].trim();
  if (!working) {
    return { name: '' };
  }

  // Peel a trailing unit/apt designator if present (e.g. "Apt 4B", "Unit 3", "#12").
  let unit: string | undefined;
  const unitMatch = working.match(
    /\s+(?:#|apt\.?|unit|ste\.?|suite|fl\.?|floor|rm\.?|room|bldg\.?|building)\s*#?\s*([\w-]+)\s*$/i,
  );
  if (unitMatch && typeof unitMatch.index === 'number') {
    unit = unitMatch[1];
    working = working.slice(0, unitMatch.index).trim();
  }

  const tokens = working.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { name: '', unit };
  }

  // Leading street number (e.g. 3300, 12A, 100-102).
  let number: string | undefined;
  if (/^\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?$/.test(tokens[0])) {
    number = tokens.shift();
  }

  // Trailing suffix from the known suffix set (kept distinct, never merged).
  // Require at least one remaining name token so a lone suffix stays the name.
  let suffix: string | undefined;
  if (tokens.length > 1) {
    const key = tokens[tokens.length - 1].replace(/\.+$/, '').toLowerCase();
    if (STREET_SUFFIXES[key]) {
      suffix = STREET_SUFFIXES[key];
      tokens.pop();
    }
  }

  return { number, name: tokens.join(' '), suffix, unit };
};

/**
 * Recompose a parsed street line into a single, single-spaced string.
 * Guarantees the suffix remains a distinct, space-separated token.
 */
export const formatParsedStreetLine = (parsed: ParsedStreetLine): string =>
  [parsed.number, parsed.name, parsed.suffix].filter(Boolean).join(' ').trim();

export const buildDetailsFromSuggestion = (
  suggestion: AddressSuggestion,
  overrides: Partial<AddressDetails> & { propertyDetails?: AddressRecord } = {},
): AddressDetails => {
  const parsedSecondary = parseSecondaryText(overrides.formatted_address ? undefined : suggestion.secondary_text);
  const propertyDetails = overrides.property_details || overrides.propertyDetails || undefined;

  // Build a token-aware street line from the provider's street value. The
  // formatted line itself is preserved verbatim below; this only normalizes the
  // structured `address` field so adjacent tokens (street name + suffix) are
  // never merged (e.g. `3300 Lake Austin Blvd`, never `LakeBoulevard`).
  const rawStreetLine = normalizeString(
    overrides.address ?? suggestion.address ?? suggestion.main_text,
  );
  const parsedStreet = parseStreetLine(rawStreetLine);
  const recomposedStreet = formatParsedStreetLine(parsedStreet);
  const addressValue =
    (recomposedStreet || undefined) ??
    rawStreetLine ??
    suggestion.description;

  const bedrooms =
    overrides.bedrooms ??
    propertyDetails?.beds ??
    propertyDetails?.bedrooms ??
    propertyDetails?.bed;
  const bathrooms =
    overrides.bathrooms ??
    propertyDetails?.baths ??
    propertyDetails?.bathrooms ??
    propertyDetails?.bath;
  // Only LIVING-AREA sources may feed `sqft`. Lot/parcel sources
  // (`lot_size`, `lotSize`, `lotSizeSqft`, …) are intentionally excluded here
  // and are never substituted for living area (Req 8.2). The resolved candidate
  // is then run through the Square_Footage_Validator so an implausible value is
  // left blank for manual entry rather than applied to pricing (Req 8.4–8.6).
  const livingAreaSqftCandidate =
    overrides.sqft ??
    propertyDetails?.sqft ??
    propertyDetails?.livingArea ??
    propertyDetails?.living_area ??
    propertyDetails?.squareFeet ??
    propertyDetails?.square_feet;
  const sqftValidation = validateLivingAreaSqft(
    { areaType: 'Living Building Area', unit: 'sqft', value: normalizeNumber(livingAreaSqftCandidate) ?? null },
    DEFAULT_LIVING_AREA_SQFT_CONFIG,
  );
  const sqft = 'sqft' in sqftValidation ? sqftValidation.sqft : undefined;
  const price =
    overrides.price ??
    propertyDetails?.price ??
    propertyDetails?.listPrice ??
    propertyDetails?.listingPrice;
  const lotSize =
    overrides.lot_size ??
    propertyDetails?.lot_size ??
    propertyDetails?.lotSize ??
    propertyDetails?.lotSizeSqft;
  const yearBuilt =
    overrides.year_built ??
    propertyDetails?.year_built ??
    propertyDetails?.yearBuilt;
  const propertyType =
    overrides.property_type ??
    propertyDetails?.property_type ??
    propertyDetails?.propertyType;
  const mlsId =
    overrides.mls_id ??
    propertyDetails?.mls_id ??
    propertyDetails?.mlsId ??
    propertyDetails?.mlsNumber;

  return {
    formatted_address: overrides.formatted_address ?? suggestion.description,
    address: addressValue,
    apt_suite: overrides.apt_suite ?? parsedStreet.unit,
    city: overrides.city ?? suggestion.city ?? parsedSecondary.city,
    state: overrides.state ?? suggestion.state ?? parsedSecondary.state,
    zip: overrides.zip ?? suggestion.zip ?? parsedSecondary.zip,
    country: (overrides.country ?? suggestion.country ?? parsedSecondary.country) || 'US',
    latitude: overrides.latitude ?? suggestion.latitude,
    longitude: overrides.longitude ?? suggestion.longitude,
    bedrooms: normalizeNumber(bedrooms),
    bathrooms: normalizeNumber(bathrooms),
    sqft: normalizeNumber(sqft),
    mls_id: mlsId ? String(mlsId) : undefined,
    price: normalizeNumber(price),
    lot_size: normalizeNumber(lotSize),
    year_built: normalizeNumber(yearBuilt),
    property_type: propertyType ? String(propertyType) : undefined,
    property_details: propertyDetails,
    raw_parcel_data: overrides.raw_parcel_data,
    raw_assessment_data: overrides.raw_assessment_data,
    raw_legacy_data: overrides.raw_legacy_data,
    manual_override: overrides.manual_override,
    override_applied: overrides.override_applied,
    override_fields: overrides.override_fields,
    garage_cars: overrides.garage_cars ?? normalizeNumber(propertyDetails?.garage_cars),
    garage_sqft: overrides.garage_sqft ?? normalizeNumber(propertyDetails?.garage_sqft),
    zpid: overrides.zpid ?? normalizeString(propertyDetails?.zpid) ?? suggestion.place_id,
    source: overrides.source,
    confidence: normalizeNumber(overrides.confidence),
    field_sources: overrides.field_sources,
    property_source_chain: overrides.property_source_chain,
  };
};

export const buildNormalizedPropertyDetails: (
  details: Partial<AddressDetails> & { property_details?: AddressRecord },
) => AddressRecord = (
  details: Partial<AddressDetails> & { property_details?: AddressRecord },
): AddressRecord => {
  const normalized =
    details.property_details && typeof details.property_details === 'object'
      ? { ...details.property_details }
      : {};

  const bedrooms = normalizeNumber(details.bedrooms ?? normalized.bedrooms ?? normalized.beds ?? normalized.bed);
  const bathrooms = normalizeNumber(details.bathrooms ?? normalized.bathrooms ?? normalized.baths ?? normalized.bath);
  const sqft = normalizeNumber(
    details.sqft ??
      normalized.sqft ??
      normalized.squareFeet ??
      normalized.square_feet ??
      normalized.livingArea ??
      normalized.living_area,
  );
  const garageCars = normalizeNumber(details.garage_cars ?? normalized.garage_cars ?? normalized.garageCars);
  const garageSqft = normalizeNumber(details.garage_sqft ?? normalized.garage_sqft ?? normalized.garageSqft);
  const mlsId = normalizeString(
    details.mls_id ?? normalized.mls_id ?? normalized.mlsId ?? normalized.mls_number ?? normalized.mlsNumber,
  );
  const price = normalizeNumber(details.price ?? normalized.price ?? normalized.listPrice ?? normalized.listingPrice);
  const lotSize = normalizeNumber(
    details.lot_size ?? normalized.lot_size ?? normalized.lotSize ?? normalized.lotSizeSqft,
  );
  const yearBuilt = normalizeNumber(details.year_built ?? normalized.year_built ?? normalized.yearBuilt);
  const propertyType = normalizeString(
    details.property_type ?? normalized.property_type ?? normalized.propertyType,
  );
  const zpid = normalizeString(details.zpid ?? normalized.zpid);

  if (bedrooms !== undefined) {
    normalized.beds = bedrooms;
    normalized.bedrooms = bedrooms;
  }
  if (bathrooms !== undefined) {
    normalized.baths = bathrooms;
    normalized.bathrooms = bathrooms;
  }
  if (sqft !== undefined) {
    normalized.sqft = sqft;
    normalized.squareFeet = sqft;
  }
  if (garageCars !== undefined) {
    normalized.garage_cars = garageCars;
  }
  if (garageSqft !== undefined) {
    normalized.garage_sqft = garageSqft;
  }
  if (mlsId !== undefined) {
    normalized.mls_id = mlsId;
    normalized.mlsId = mlsId;
  }
  if (price !== undefined) {
    normalized.price = price;
  }
  if (lotSize !== undefined) {
    normalized.lot_size = lotSize;
    normalized.lotSize = lotSize;
  }
  if (yearBuilt !== undefined) {
    normalized.year_built = yearBuilt;
    normalized.yearBuilt = yearBuilt;
  }
  if (propertyType !== undefined) {
    normalized.property_type = propertyType;
    normalized.propertyType = propertyType;
  }
  if (zpid !== undefined) {
    normalized.zpid = zpid;
  }
  if (details.source) {
    normalized.source = details.source;
  }
  if (details.confidence !== undefined) {
    normalized.confidence = details.confidence;
  }
  if (details.field_sources) {
    normalized.field_sources = details.field_sources;
  }
  if (details.property_source_chain) {
    normalized.property_source_chain = details.property_source_chain;
  }

  return normalized;
};
const areaTypePriority = [
  'Living Building Area',
  'Finished Building Area',
  'Zillow Calculated Finished Area',
  'Base Building Area',
  'Gross Building Area',
];

const supplementalFinishedAreaTypes = [
  'Basement Finished',
  'Game Room/Recreation',
  'Lower Level Finished',
  'Finished Basement',
  'Basement Partially Finished',
  'Finished Rec Room',
];

const getAreaSquareFeet = (value: unknown): number | undefined => {
  const area = asRecord(value);
  const squareFeet = normalizeNumber(area.areaSquareFeet);
  return squareFeet && squareFeet > 0 ? squareFeet : undefined;
};

const getPreferredFinishedSqft = (areas: unknown[]): number | undefined => {
  let primarySqft: number | undefined;
  let primaryType: string | undefined;

  // Defensive: never let a lot/parcel area feed living-area sqft (Req 8.2).
  // The priority lists below are already living/finished-area only, but we
  // additionally strip any lot-area entry so it can never be substituted.
  const livingAreas = areas.map(asRecord).filter((area) => !/lot|parcel|acre/i.test(String(area.type ?? '')));

  for (const type of areaTypePriority) {
    const candidates = livingAreas
      .filter((area) => area?.type === type)
      .map(getAreaSquareFeet)
      .filter((value): value is number => value !== undefined);

    if (candidates.length > 0) {
      primarySqft = Math.max(...candidates);
      primaryType = type;
      break;
    }
  }

  if (!primarySqft) {
    return undefined;
  }

  if (primaryType !== 'Living Building Area') {
    return primarySqft;
  }

  const supplementalSqft = livingAreas
    .filter((area) => supplementalFinishedAreaTypes.includes(String(area.type ?? '')))
    .map(getAreaSquareFeet)
    .filter((value): value is number => value !== undefined)
    .reduce((sum, value) => sum + value, 0);

  if (supplementalSqft > 0) {
    return primarySqft + supplementalSqft;
  }

  const hasFinishedAreaMarker = livingAreas.some((area) => {
    const type = String(area?.type ?? '');
    return type.endsWith(' Finished') || type.startsWith('Finished ');
  });

  if (!hasFinishedAreaMarker) {
    return primarySqft;
  }

  const basementFallback = livingAreas
    .filter((area) => area?.type === 'Basement')
    .map(getAreaSquareFeet)
    .filter((value): value is number => value !== undefined);

  if (!basementFallback.length) {
    return primarySqft;
  }

  return primarySqft + Math.max(...basementFallback);
};

export const deriveBridgeMetrics = (parcelResponse: unknown) => {
  if (!parcelResponse) return null;
  const response = asRecord(parcelResponse);
  const rawProperty = asRecord(response.bundle ?? response.data ?? response.property ?? parcelResponse);

  if (Object.keys(rawProperty).length === 0) return null;

  const address = asRecord(rawProperty.address);
  const areas = Array.isArray(rawProperty.areas) ? rawProperty.areas : [];
  const buildingData = rawProperty.building ?? [];
  const building = asRecord(Array.isArray(buildingData) ? buildingData[0] : buildingData);

  const sqft = getPreferredFinishedSqft(areas);

  const bedrooms = normalizeNumber(building.bedrooms ?? building.totalRooms);
  const fullBaths = Number(building.fullBaths ?? 0);
  const halfBaths = Number(building.halfBaths ?? 0) * 0.5;
  const threeQuarterBaths = Number(building.threeQuarterBaths ?? 0) * 0.75;
  const quarterBaths = Number(building.quarterBaths ?? 0) * 0.25;
  let bathrooms = fullBaths + halfBaths + threeQuarterBaths + quarterBaths;
  if (!bathrooms) {
    bathrooms = normalizeNumber(building.baths) ?? 0;
  }
  if (!bathrooms) {
    bathrooms = undefined;
  }

  const garages = Array.isArray(rawProperty.garages) ? rawProperty.garages.map(asRecord) : [];
  let garageCars: number | undefined;
  let garageSqft: number | undefined;
  if (garages.length) {
    let carTotal = 0;
    let sqftTotal = 0;
    let hasCars = false;
    let hasSqft = false;
    garages.forEach((garage) => {
      if (garage?.carCount) {
        carTotal += Number(garage.carCount);
        hasCars = true;
      }
      if (garage?.areaSquareFeet) {
        sqftTotal += Number(garage.areaSquareFeet);
        hasSqft = true;
      }
    });
    if (!hasCars && garages.length) {
      carTotal = garages.length;
      hasCars = true;
    }
    if (hasCars && carTotal > 0) {
      garageCars = carTotal;
    }
    if (hasSqft && sqftTotal > 0) {
      garageSqft = sqftTotal;
    }
  }

  return {
    formatted_address: normalizeString(address.full ?? address.formattedStreetAddress ?? address.deliveryLine),
    address: normalizeString(address.deliveryLine)
      ?? normalizeString(`${address.streetNumber ?? ''} ${address.streetName ?? ''}`.trim()),
    city: normalizeString(address.city),
    state: normalizeString(address.state ?? address.stateCode),
    zip: normalizeString(address.zip ?? address.zipcode ?? address.postalCode),
    country: normalizeString(address.country ?? address.countryCode),
    latitude: normalizeNumber(address.latitude ?? rawProperty.latitude),
    longitude: normalizeNumber(address.longitude ?? rawProperty.longitude),
    bedrooms,
    bathrooms,
    sqft,
    garage_cars: garageCars,
    garage_sqft: garageSqft,
    property_details: rawProperty,
    zpid: normalizeString(rawProperty.id ?? rawProperty.zpid),
  };
};
