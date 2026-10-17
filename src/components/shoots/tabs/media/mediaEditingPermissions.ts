import type { MediaFile } from '@/hooks/useShootFiles';
import { isRawFile } from '@/services/rawPreviewService';
import { isImageFile, isPreviewableImage } from './mediaViewerFileTypes';

export function canShowMediaEditingActions(file: MediaFile, shootId: string | number | undefined, role: string | undefined) {
  return Boolean((shootId ?? file.shoot_id) && ['admin', 'superadmin', 'editing_manager'].includes(role ?? '') && !file.is_hidden && (isImageFile(file) || isPreviewableImage(file) || isRawFile(file.filename)));
}
