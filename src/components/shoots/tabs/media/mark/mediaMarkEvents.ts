import type { MediaFile } from '@/hooks/useShootFiles';

/** 'delivery' opens the shoot-level Finalise dialog; otherwise the single Mark media screen opens. */
export type MediaMarkTab = 'delivery';
export interface MediaMarkRequest {
  shootId: string | number; shootLabel?: string; files?: MediaFile[]; initialTab?: MediaMarkTab;
  allowType?: boolean; onChanged?: () => void | Promise<void>;
}
export const MEDIA_MARK_EVENT = 'shoot-media-mark';
/** Roles that may assign services, finalise and hide media from the client. */
export const STAFF_MARK_ROLES = ['admin', 'superadmin', 'super_admin', 'editing_manager'];
export function openMediaMark(request: MediaMarkRequest) {
  window.dispatchEvent(new CustomEvent<MediaMarkRequest>(MEDIA_MARK_EVENT, { detail: request }));
}
