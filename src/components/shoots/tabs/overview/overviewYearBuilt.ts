import type { ShootData } from '@/types/shoots';
import { formatDateForInput, formatEditableValue, toNumberOrUndefined } from './shootOverviewEditorSupport';
import type { ShootWithLegacyOverviewFields } from './shootOverviewUpdateTypes';

export const getOverviewYearBuilt = (details: Record<string, unknown>): string => {
  const value = details.year_built ?? details.yearBuilt;
  return value === null || value === undefined ? '' : String(value);
};

export const parseOverviewYearBuilt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[1-9]\d{3}$/.test(trimmed)) {
    throw new Error('Enter a whole year between 1000 and 9999, or leave it blank if unknown.');
  }
  return Number(trimmed);
};

type PropertyDraft = {
  shoot: ShootData;
  incoming: Record<string, unknown> | null;
  metrics: { beds: string; baths: string; sqft: string };
  year: string;
  presenceOption: string;
  lockboxCode: string;
  lockboxLocation: string;
  accessContactName: string;
  accessContactPhone: string;
};

export const buildOverviewPropertyDetails = (draft: PropertyDraft) => {
  const { shoot, incoming, metrics, year, presenceOption, lockboxCode, lockboxLocation, accessContactName, accessContactPhone } = draft;
  const legacy = shoot as ShootWithLegacyOverviewFields;
  const original = { ...(shoot.propertyDetails ?? legacy.property_details ?? {}) } as Record<string, unknown>;
  const details = { ...original };
  const yearChanged = year.trim() !== getOverviewYearBuilt(original).trim();
  const yearValue = yearChanged || incoming ? parseOverviewYearBuilt(year) : null;
  if (incoming) {
    ['beds', 'bedrooms', 'baths', 'bathrooms', 'sqft', 'squareFeet',
      'mls_id', 'mlsId', 'price', 'lot_size', 'lotSize', 'year_built', 'yearBuilt',
      'property_type', 'propertyType', 'zpid', 'source', 'confidence', 'field_sources',
      'property_source_chain'].forEach(key => { delete details[key]; });
    Object.assign(details, incoming);
  }
  for (const [value, keys] of [
    [metrics.beds, ['beds', 'bedrooms']], [metrics.baths, ['baths', 'bathrooms']],
    [metrics.sqft, ['sqft', 'squareFeet']],
  ] as const) {
    const numeric = toNumberOrUndefined(value);
    keys.forEach(key => {
      if (numeric !== undefined) details[key] = numeric;
      else if (incoming) delete details[key];
    });
  }
  if (yearChanged || incoming) {
    details.year_built = yearValue;
    details.yearBuilt = yearValue;
  }
  const text = (key: string) => typeof original[key] === 'string' ? original[key] : '';
  const metricsUnchanged = metrics.beds === formatEditableValue(original.beds ?? original.bedrooms ?? original.bed ?? legacy.beds ?? legacy.bedrooms ?? '')
    && metrics.baths === formatEditableValue(original.baths ?? original.bathrooms ?? original.bath ?? legacy.baths ?? legacy.bathrooms ?? '')
    && metrics.sqft === formatEditableValue(original.sqft ?? original.squareFeet ?? original.square_feet ?? legacy.sqft ?? legacy.squareFeet ?? legacy.square_feet ?? legacy.livingArea ?? legacy.living_area ?? '');
  const savedPresence = original.presenceOption;
  const accessUnchanged = presenceOption === (savedPresence === 'lockbox' || savedPresence === 'other' || savedPresence === 'self' ? savedPresence : '')
    && lockboxCode === text('lockboxCode') && lockboxLocation === text('lockboxLocation')
    && accessContactName === text('accessContactName') && accessContactPhone === text('accessContactPhone');
  if (yearChanged && !incoming && metricsUnchanged && accessUnchanged) {
    return { details: { year_built: yearValue, yearBuilt: yearValue } as Record<string, unknown>, yearOnly: true };
  }
  return { details: { ...details, ...(presenceOption ? { presenceOption } : {}),
    lockboxCode: presenceOption === 'lockbox' ? lockboxCode || null : null,
    lockboxLocation: presenceOption === 'lockbox' ? lockboxLocation || null : null,
    accessContactName: presenceOption === 'other' ? accessContactName || null : null,
    accessContactPhone: presenceOption === 'other' ? accessContactPhone || null : null,
  }, yearOnly: false };
};
export const hasOverviewBookingEdits = (updates: Partial<ShootData>, shoot: ShootData): boolean => {
  if (updates.scheduledDate !== (shoot.scheduledDate ? formatDateForInput(shoot.scheduledDate) : '')
    || updates.time !== shoot.time
    || String(updates.client?.id ?? '') !== String(shoot.client?.id ?? '')
    || String(updates.photographer?.id ?? '') !== String(shoot.photographer?.id ?? '')) return true;
  if ((['address', 'city', 'state', 'zip'] as const).some(key =>
    String(updates.location?.[key] ?? '') !== String(shoot.location?.[key] ?? ''))) return true;
  return (updates.payment?.discountType ?? null) !== (shoot.payment?.discountType ?? null)
    || (updates.payment?.discountValue ?? null) !== (shoot.payment?.discountValue ?? null)
    || 'adminAdjustedTotalQuote' in updates
    || 'perCategoryPhotographers' in updates;
};
