/**
 * Apt/Suite lives on property_details (aptSuite | apt_suite) while the street
 * column is often stored without the unit. Display helpers append it once.
 */

type PropertyDetailsLike = Record<string, unknown> | null | undefined;

const UNIT_DESIGNATOR = /^(?:#|(?:apartment|apt\.?|unit|suite|ste\.?)(?=\s|#|$))/i;
const STRIP_DESIGNATOR = /^(?:#|(?:apartment|apt\.?|unit|suite|ste\.?)(?=\s|#|$))\s*#?\s*/i;

export const resolveAptSuite = (propertyDetails?: PropertyDetailsLike): string | null => {
  if (!propertyDetails || typeof propertyDetails !== 'object') return null;

  for (const key of ['aptSuite', 'apt_suite', 'suite', 'unit'] as const) {
    const value = propertyDetails[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const trimmed = String(value).trim();
      if (trimmed) return trimmed;
    }
  }

  return null;
};

export const formatUnitLabel = (aptSuite: string): string => {
  const trimmed = aptSuite.trim();
  if (!trimmed) return '';
  if (UNIT_DESIGNATOR.test(trimmed)) return trimmed;
  return `Unit ${trimmed}`;
};

export const streetContainsUnit = (street: string, aptSuite: string): boolean => {
  const normalizedStreet = street.trim();
  const normalizedApt = aptSuite.trim();
  if (!normalizedStreet || !normalizedApt) return false;

  const unitToken = normalizedApt.replace(STRIP_DESIGNATOR, '').trim();
  if (!unitToken) return false;

  const escaped = unitToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(?:^|[\\s,])(?:#|apartment|apt\\.?|unit|suite|ste\\.?)\\s*#?\\s*${escaped}(?=$|[\\s,])`,
    'i',
  );

  return pattern.test(normalizedStreet);
};

export const streetWithAptSuite = (
  street: string | null | undefined,
  propertyDetails?: PropertyDetailsLike,
): string => {
  const normalizedStreet = (street ?? '').replace(/\s+/g, ' ').trim();
  const apt = resolveAptSuite(propertyDetails);
  if (!apt || !normalizedStreet) return normalizedStreet;

  if (streetContainsUnit(normalizedStreet, apt)) return normalizedStreet;

  const label = formatUnitLabel(apt);
  if (!label) return normalizedStreet;

  return `${normalizedStreet}, ${label}`;
};

export const getShootPropertyDetails = (shoot: {
  propertyDetails?: PropertyDetailsLike;
  property_details?: PropertyDetailsLike;
} | null | undefined): PropertyDetailsLike =>
  shoot?.propertyDetails ?? shoot?.property_details ?? null;
