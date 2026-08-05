import type { ShootData } from '@/types/shoots';

interface ShootDetailsCompatibilityFields {
  address?: string;
  addressLine?: string;
  city?: string;
  cityStateZip?: string;
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

export const buildWeatherLocationQuery = (shoot: ShootData | null): string | null => {
  if (!shoot) return null;
  const compatibleShoot = asCompatibleShoot(shoot);
  const fullAddress = sanitizeWeatherSegment(shoot.location?.fullAddress);
  const streetAddress = sanitizeWeatherSegment(shoot.location?.address);
  const city = sanitizeWeatherSegment(shoot.location?.city);
  const state = sanitizeWeatherSegment(shoot.location?.state);
  const zip = sanitizeWeatherSegment(shoot.location?.zip);
  const fallbackAddressLine = sanitizeWeatherSegment(compatibleShoot.addressLine);
  const fallbackCityStateZip = sanitizeWeatherSegment(compatibleShoot.cityStateZip);

  if (fullAddress) return fullAddress;
  const parts = [streetAddress, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean);
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
  if (!shoot) return 'Shoot Details';
  const compatibleShoot = asCompatibleShoot(shoot);
  const address = shoot.location?.address || compatibleShoot.address || '';
  const city = shoot.location?.city || compatibleShoot.city || '';
  const state = shoot.location?.state || compatibleShoot.state || '';
  const zip = shoot.location?.zip || compatibleShoot.zip || '';
  if (address && (city || state || zip)) {
    let streetAddress = address;
    if (city) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${city}\\s*,?`, 'i'), '');
    if (state) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${state}\\s*,?`, 'i'), '');
    if (zip) streetAddress = streetAddress.replace(new RegExp(`\\s*,?\\s*${zip}\\s*`, 'i'), '');
    streetAddress = streetAddress.replace(/[,\s]+$/, '').trim();
    if (streetAddress) return streetAddress;
  }
  return address || shoot.location?.fullAddress || 'Shoot Details';
};

export const getShootSubmitFileCount = (
  shoot: ShootData,
  kind: 'raw' | 'edited',
): number => kind === 'raw'
  ? shoot.rawPhotoCount ?? asCompatibleShoot(shoot).raw_photo_count ?? 0
  : shoot.editedPhotoCount ?? asCompatibleShoot(shoot).edited_photo_count ?? 0;
