import type { MediaFile } from '@/hooks/useShootFiles';
import { isRawFile } from '@/services/rawPreviewService';
import { isImageFile, isPreviewableImage, isVideoFile } from './mediaViewerFileTypes';

export const isEditedMediaFile = (file: MediaFile) => ['completed', 'verified'].includes(file.workflowStage ?? '')
  || file.media_type === 'edited' || Boolean(file.is_ai_edited);

export function canShowMediaEditingActions(file: MediaFile, shootId: string | number | undefined, role: string | undefined) {
  return Boolean((shootId ?? file.shoot_id) && ['admin', 'superadmin', 'editing_manager'].includes(role ?? '') && !file.is_hidden
    && (isVideoFile(file) ? isEditedMediaFile(file) : isImageFile(file) || isPreviewableImage(file) || isRawFile(file.filename)));
}
