import type { ShootData } from '@/types/shoots';

interface ShootDetailsCompatibilityFields {
  address?: string;
  addressLine?: string;
  city?: string;
  cityStateZip?: string;
  fullAddress?: string;
  state?: string;
  zip?: string;
  startTime?: string;
  raw_photo_count?: number;
  edited_photo_count?: number;
}

type CompatibleShoot = ShootData & ShootDetailsCompatibilityFields;

const asCompatibleShoot = (shoot: ShootData): CompatibleShoot => shoot;

const sanitizeWeatherSegment = (value?: string | null) =>
  value?.replace(/\s+/g, ' ').trim() ?? '';

const addressSegmentTokens = (value: string) =>
  value.toLocaleLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const containsAddressSegment = (value: string, segment: string) => {
  const valueTokens = new Set(addressSegmentTokens(value));
  const segmentTokens = addressSegmentTokens(segment);
  return segmentTokens.length > 0 && segmentTokens.every((token) => valueTokens.has(token));
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const removeTrailingLocality = (address: string, segments: string[]) => {
  const normalizedSegments = segments
    .map(sanitizeWeatherSegment)
    .filter(Boolean);
  if (normalizedSegments.length === 0) return address;

  const localityPattern = normalizedSegments
    .map(escapeRegExp)
    .join('(?:\\s*,\\s*|\\s+)');

  return address
    .replace(new RegExp(`\\s*,\\s*${localityPattern}\\s*$`, 'iu'), '')
    .replace(/[,\s]+$/, '')
    .trim();
};

/**
 * Resolve the street line without treating state abbreviations as arbitrary
 * substrings. For example, "VA" must never remove the "Va" in "Valley".
 */
export const getShootStreetAddress = (shoot: ShootData | null): string => {
  if (!shoot) return '';

  const compatibleShoot = asCompatibleShoot(shoot);
  const explicitStreetAddress =
    shoot.location?.address || compatibleShoot.address || compatibleShoot.addressLine || '';

  // Structured address fields are already the canonical street-only value.
  if (explicitStreetAddress.trim()) return explicitStreetAddress;

  const fullAddress = sanitizeWeatherSegment(
    shoot.location?.fullAddress || compatibleShoot.fullAddress,
  );
  if (!fullAddress) return '';

  const city = shoot.location?.city || compatibleShoot.city || '';
  const state = shoot.location?.state || compatibleShoot.state || '';
  const zip = shoot.location?.zip || compatibleShoot.zip || '';

  // Remove one complete, comma-delimited locality suffix. Requiring the
  // delimiter prevents street words that resemble a city/state from matching.
  return removeTrailingLocality(fullAddress, [city, state, zip]);
};

export const buildWeatherLocationQuery = (shoot: ShootData | null): string | null => {
  if (!shoot) return null;
  const compatibleShoot = asCompatibleShoot(shoot);
  const fullAddress = sanitizeWeatherSegment(shoot.location?.fullAddress);
  const streetAddress = sanitizeWeatherSegment(
    shoot.location?.address || compatibleShoot.address || compatibleShoot.addressLine,
  );
  const city = sanitizeWeatherSegment(shoot.location?.city || compatibleShoot.city);
  const state = sanitizeWeatherSegment(shoot.location?.state || compatibleShoot.state);
  const zip = sanitizeWeatherSegment(shoot.location?.zip || compatibleShoot.zip);
  const fallbackAddressLine = sanitizeWeatherSegment(compatibleShoot.addressLine);
  const fallbackCityStateZip = sanitizeWeatherSegment(compatibleShoot.cityStateZip);

  if (fullAddress) return fullAddress;
  const structuredRegion = [state, zip].filter(Boolean).join(' ');
  const locality = fallbackCityStateZip
    ? [
        city && !containsAddressSegment(fallbackCityStateZip, city) ? city : '',
        fallbackCityStateZip,
        [state, zip]
          .filter((segment) => segment && !containsAddressSegment(fallbackCityStateZip, segment))
          .join(' '),
      ].filter(Boolean).join(', ')
    : [city, structuredRegion].filter(Boolean).join(', ');
  const parts = [streetAddress, locality].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  const fallbackParts = [fallbackAddressLine, fallbackCityStateZip].filter(Boolean);
  return fallbackParts.length > 0 ? fallbackParts.join(', ') : null;
};

export const buildWeatherDateTime = (shoot: ShootData | null): string | undefined => {
  if (!shoot) return undefined;
  const startTime = asCompatibleShoot(shoot).startTime;
  if (typeof startTime === 'string' && !Number.isNaN(Date.parse(startTime))) {
    return new Date(startTime).toISOString();
  }
  if (!shoot.scheduledDate) return undefined;

  const target = new Date(shoot.scheduledDate);
  if (Number.isNaN(target.getTime())) {
    const parsed = new Date(`${shoot.scheduledDate} ${shoot.time || '12:00'}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  const time = shoot.time || '12:00';
  const twelveHour = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const twentyFourHour = time.match(/^(\d{1,2}):(\d{2})$/);
  if (twelveHour) {
    let hours = parseInt(twelveHour[1], 10);
    const minutes = parseInt(twelveHour[2], 10);
    const period = twelveHour[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    target.setHours(hours, minutes, 0, 0);
  } else if (twentyFourHour) {
    target.setHours(parseInt(twentyFourHour[1], 10), parseInt(twentyFourHour[2], 10), 0, 0);
  } else {
    target.setHours(12, 0, 0, 0);
  }
  return target.toISOString();
};

interface SubmitCapabilityInput {
  shoot: ShootData | null;
  currentUserRole?: string | null;
  isAdmin: boolean;
  isEditingManager: boolean;
  normalizedStatus?: string | null;
}

interface RawSubmitCapabilityInput extends SubmitCapabilityInput {
  isPhotographer: boolean;
  rawFileCount: number;
}

export const canSubmitRawFromDetails = ({
  shoot,
  currentUserRole,
  isAdmin,
  isEditingManager,
  isPhotographer,
  normalizedStatus,
  rawFileCount,
}: RawSubmitCapabilityInput): boolean => {
  if (!shoot) return false;
  if (shoot.canSubmitRaw ?? shoot.can_submit_raw) return true;
  const role = (currentUserRole || '').toLowerCase();
  const allowedRole = isAdmin || isEditingManager || isPhotographer
    || ['admin', 'superadmin', 'super_admin', 'editing_manager', 'photographer'].includes(role);
  const status = String(normalizedStatus || shoot.workflowStatus || shoot.status || '').toLowerCase();
  const count = Math.max(
    Number(rawFileCount || 0),
    Number(shoot.rawPhotoCount || 0),
    Number(asCompatibleShoot(shoot).raw_photo_count || 0),
  );
  return allowedRole && ['scheduled', 'booked', 'raw_upload_pending'].includes(status) && count > 0;
};

interface EditsSubmitCapabilityInput extends SubmitCapabilityInput {
  isEditor: boolean;
  editedMediaCount: number;
}

export const canSubmitEditsFromDetails = ({
  shoot,
  currentUserRole,
  isAdmin,
  isEditingManager,
  isEditor,
  normalizedStatus,
  editedMediaCount,
}: EditsSubmitCapabilityInput): boolean => {
  if (!shoot) return false;
  if (shoot.canSubmitEdits ?? shoot.can_submit_edits) return true;
  const role = (currentUserRole || '').toLowerCase();
  const allowedRole = isAdmin || isEditingManager || isEditor
    || ['admin', 'superadmin', 'super_admin', 'editing_manager', 'editor'].includes(role);
  const status = String(normalizedStatus || shoot.workflowStatus || shoot.status || '').toLowerCase();
  const count = Math.max(
    Number(editedMediaCount || 0),
    Number(shoot.editedPhotoCount || 0),
    Number(asCompatibleShoot(shoot).edited_photo_count || 0),
  );
  return allowedRole && ['uploaded', 'editing'].includes(status) && count > 0;
};

export const getShootDetailsAddressTitle = (shoot: ShootData | null): string => {
  return getShootStreetAddress(shoot) || 'Shoot Details';
};

export const getShootSubmitFileCount = (
  shoot: ShootData,
  kind: 'raw' | 'edited',
): number => kind === 'raw'
  ? shoot.rawPhotoCount ?? asCompatibleShoot(shoot).raw_photo_count ?? 0
  : shoot.editedPhotoCount ?? asCompatibleShoot(shoot).edited_photo_count ?? 0;
