import type { MediaFile } from '@/hooks/useShootFiles';
import { normalizeDashboardRole } from '@/utils/dashboardFilterPermissions';
import { isPreviewableImage } from '../media/mediaPreviewUtils';

export const canSeeServiceImageCounts = (role?: string, isClient = false) => !isClient && [
  'admin', 'superadmin', 'editing_manager', 'salesrep', 'photographer', 'editor',
].includes(normalizeDashboardRole(role));

export function countServicePhotos(files: MediaFile[], id: string): number {
  return files.filter(file => String(file.shoot_service_id ?? file.shootServiceId ?? '') === id
    && !file.isExtra && file.media_type !== 'extra'
    && (isPreviewableImage(file) || String(file.fileType ?? '').startsWith('image/')
      || /\.(jpe?g|png|webp|heic|heif|tiff?|nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/i.test(file.filename))).length;
}
