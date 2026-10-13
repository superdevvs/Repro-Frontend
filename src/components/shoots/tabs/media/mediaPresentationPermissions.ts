import type { MediaFile } from '@/hooks/useShootFiles';
import { isSalesRepRole } from '@/utils/shootManagementAccess';
import { isRawFile } from '@/services/rawPreviewService';
import { isImageFile, isVideoFile } from './mediaViewerFileTypes';

const normalizedRole = (role?: string | null) => String(role ?? '').trim().toLowerCase();
export const isMediaCurationRole = (role?: string | null) => normalizedRole(role) === 'client' || isSalesRepRole(role);
export const isCustomerMediaCuration = (file: MediaFile, role?: string | null) => file.media_curation_scope
  ? file.media_curation_scope === 'customer' : isMediaCurationRole(role);
const isPresentationRole = (role?: string | null) => isMediaCurationRole(role)
  || ['admin', 'superadmin', 'editing_manager', 'editor', 'photographer'].includes(normalizedRole(role));
const isSafe = (file: MediaFile) => !file.media_error && !['invalid', 'offline', 'missing'].includes(String(file.media_state ?? '').toLowerCase())
  && [null, undefined, 'clean'].includes(file.scan_status ?? file.scanStatus);
const isEdited = (file: MediaFile) => ['completed', 'verified'].includes(String(file.workflowStage ?? '').toLowerCase())
  && String(file.media_type ?? '').toLowerCase() !== 'raw';

/** The server distinguishes direct customer curation from existing contractor and office permissions. */
export function canManageMediaVisibility(file: MediaFile, role?: string | null): boolean {
  if (!isPresentationRole(role)) return false;
  if (isCustomerMediaCuration(file, role)) return file.can_manage_visibility === true && isSafe(file) && isEdited(file);
  if (!['admin', 'superadmin', 'editing_manager', 'editor', 'photographer'].includes(normalizedRole(role))) return false;
  return file.can_manage_visibility ?? isSafe(file);
}

export function canSetMediaHero(file: MediaFile, role?: string | null): boolean {
  if (!isPresentationRole(role)) return false;
  if (!isImageFile(file) || isVideoFile(file)) return false;
  if (isCustomerMediaCuration(file, role)) {
    return file.can_set_hero === true && !file.is_hidden && !isRawFile(file.filename) && isSafe(file) && isEdited(file) && !file.isExtra
      && !['extra', 'floorplan'].includes(String(file.media_type ?? '').toLowerCase());
  }
  if (!['admin', 'superadmin', 'editing_manager', 'photographer', 'editor'].includes(normalizedRole(role))) return false;
  return file.can_set_hero ?? ['admin', 'superadmin', 'editing_manager'].includes(normalizedRole(role));
}

/** Hidden restore rows are management previews, never client/rep download or share inputs. */
export const canUseMediaDownload = (file: MediaFile, role?: string | null) => isCustomerMediaCuration(file, role)
  ? !file.is_hidden && file.can_download !== false : file.can_download ?? true;
export const canInteractWithMediaFile = (file: MediaFile, role?: string | null) => !isCustomerMediaCuration(file, role) || !file.is_hidden;
export const canReorderMediaFile = (file: MediaFile, role?: string | null) => !isCustomerMediaCuration(file, role)
  || (!file.is_hidden && canManageMediaVisibility(file, role));
