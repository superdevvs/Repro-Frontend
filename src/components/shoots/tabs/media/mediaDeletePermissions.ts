import type { MediaFile } from '@/hooks/useShootFiles';

interface MediaDeleteContext {
  role: string;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isVideoEditor: boolean;
  isDelivered: boolean;
  isSubmittedForReview: boolean;
  displayTab: 'uploaded' | 'edited';
}

export function canDeleteMediaFile(file: MediaFile, context: MediaDeleteContext): boolean {
  if (context.isEditor && context.displayTab !== 'edited') return false;
  // The server knows uploader ownership, service assignment and the video lane's
  // release state. A shoot's photos may already be delivered while video is open.
  if (context.isEditor && context.isVideoEditor) return file.can_delete === true;
  return context.role === 'superadmin'
    || ((context.isAdmin || context.isPhotographer) && !context.isDelivered)
    || (context.isEditor && !context.isDelivered && !context.isSubmittedForReview);
}

export function canDeleteMediaSelection(
  selectedIds: ReadonlySet<string>, files: MediaFile[], canDelete: (file: MediaFile) => boolean,
): boolean {
  return selectedIds.size > 0 && [...selectedIds].every((id) => {
    const file = files.find((candidate) => candidate.id === id);
    return Boolean(file && canDelete(file));
  });
}
