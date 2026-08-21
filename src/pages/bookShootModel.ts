import type { PricingBreakdown } from '@/utils/pricing';

export type SqftRange = {
  id?: number;
  sqft_from: number;
  sqft_to: number;
  duration: number | null;
  price: number;
  photographer_pay: number | null;
};

export type ServicePackage = {
  id: string;
  name: string;
  price: number;
  pricing_type?: 'fixed' | 'variable';
  allow_multiple?: boolean;
  description: string;
  sqft_ranges?: SqftRange[];
  category?: {
    id: string;
    name: string;
  };
  service_groups?: Array<{ id: string; name: string; description?: string | null }>;
  service_group_ids?: string[];
};

export type ServiceScheduleMap = Record<string, { date?: string; time?: string }>;

export type PropertyDetailsData = Record<string, unknown> & {
  sqft?: number;
  livingArea?: number;
  bedrooms?: number;
  bedRooms?: number;
  bathrooms?: number;
  bathRooms?: number;
  listingType?: 'for_sale' | 'for_rent';
  presenceOption?: 'self' | 'other' | 'lockbox';
  lockboxCode?: string;
  lockboxLocation?: string;
  accessContactName?: string;
  accessContactPhone?: string;
};

export type PropertyDraftSubmission = Record<string, unknown> & {
  clientId?: string;
  completeAddress?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  propertyInfo?: string;
  shootNotes?: string;
  companyNotes?: string;
  photographerNotes?: string;
  editorNotes?: string;
  sqft?: number | string | null;
  property_details?: PropertyDetailsData | null;
};

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

export const resolveSelectedServicePrice = (service: ServicePackage, sqft?: number | null) => {
  let price = Number(service.price ?? 0);

  if (service.pricing_type === 'variable' && sqft && service.sqft_ranges?.length) {
    const matchingRange = service.sqft_ranges.find(
      (range) => sqft >= range.sqft_from && sqft <= range.sqft_to
    );
    if (matchingRange) {
      price = Number(matchingRange.price);
    }
  }

  return price;
};

export const isLowPhotoCountServiceForLargeHome = (service: ServicePackage) => {
  const label = `${service.name || ''} ${service.description || ''}`.toLowerCase();
  return /\b25\b/.test(label) && /\bphotos?\b/.test(label);
};

export const shouldWarnForLargeHomePhotoCount = (services: ServicePackage[], sqft?: number | null) => {
  if (!sqft || sqft < 3000) return false;
  return services.some(isLowPhotoCountServiceForLargeHome);
};

export const normalizeAddressPart = (value?: string | null) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildNormalizedAddress = (params: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) => {
  let street = normalizeAddressPart(params.address);
  const cityPart = normalizeAddressPart(params.city);
  const statePart = normalizeAddressPart(params.state);
  const zipPart = normalizeAddressPart(params.zip);

  const trimTrailingToken = (source: string, token: string) => {
    if (!source || !token) return source;
    const pattern = new RegExp(`(?:,\\s*)?${escapeRegExp(token)}\\s*$`, 'i');
    return source.replace(pattern, '').replace(/[\s,]+$/, '').trim();
  };

  const stateZip = [statePart, zipPart].filter(Boolean).join(' ');
  street = trimTrailingToken(street, stateZip);
  street = trimTrailingToken(street, zipPart);
  street = trimTrailingToken(street, statePart);
  street = trimTrailingToken(street, cityPart);

  const locality = [cityPart, [statePart, zipPart].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const parts = [street, locality].filter(Boolean);

  return parts.join(', ');
};

export const normalizeDuplicateAddressKey = (value?: string | null) =>
  normalizeAddressPart(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export const getDateKey = (value?: Date | string | null) => {
  if (!value) return '';
  if (value instanceof Date) {
    return toDateInputValue(value);
  }

  const raw = String(value).trim();
  const directDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directDate) {
    return directDate[1];
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return toDateInputValue(parsed);
};

export const duplicateCheckIgnoredStatuses = new Set([
  'cancelled',
  'canceled',
  'declined',
  'rejected',
  'archived',
]);

export const duplicateLocationWarningStatuses = new Set([
  'scheduled',
  'booked',
  'uploaded',
  'editing',
  'review',
  'ready',
  'ready_for_review',
  'pending_review',
  'editing_complete',
  'editing_issue',
  'qc',
  'delivered',
  'completed',
  'delivered_to_client',
  'ready_for_client',
  'admin_verified',
]);

export const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const parseCurrencyInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return roundCurrency(parsed);
};

export const toBackendTime = (value?: string | null) => {
  if (!value) return '';
  const trimmed = value.trim();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const meridiem = ampmMatch[3].toUpperCase();
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}:00`;
  }

  const time24Match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (time24Match) {
    return `${String(parseInt(time24Match[1], 10)).padStart(2, '0')}:${time24Match[2]}:${(time24Match[3] || '00').padStart(2, '0')}`;
  }

  return '';
};

export const toDateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toTimeInputValue = (value?: string | null) => toBackendTime(value).slice(0, 5);

export const buildAdminAdjustedPricing = (
  pricing: PricingBreakdown,
  adjustedTotal: number | null,
  taxRate: number,
): PricingBreakdown => {
  if (adjustedTotal === null) {
    return pricing;
  }

  const totalQuote = roundCurrency(adjustedTotal);
  const resolvedTaxRate = Math.max(Number(taxRate || 0), 0);
  const discountedSubtotal = resolvedTaxRate > 0
    ? roundCurrency(totalQuote / (1 + resolvedTaxRate))
    : totalQuote;
  const taxAmount = roundCurrency(totalQuote - discountedSubtotal);

  return {
    ...pricing,
    serviceSubtotal: discountedSubtotal,
    discountType: null,
    discountValue: null,
    discountAmount: 0,
    discountedSubtotal,
    taxAmount,
    totalQuote,
  };
};

export type CompletedBookingSnapshot = {
  date?: Date;
  time: string;
  shootId?: string | number;
  totalAmount: number;
  pricing: PricingBreakdown;
  shootAddress: string;
  shootServices: string[];
  clientName?: string;
  clientEmail?: string;
  /** Canonical ShootResource payload returned by POST /api/shoots. */
  shoot?: unknown;
};
