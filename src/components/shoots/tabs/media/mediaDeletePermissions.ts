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

/**
 * Prefer server `can_delete` (EM may delete before/after delivery when true).
 * Fall back to legacy client heuristics only when the field is absent.
 */
export function canDeleteMediaFile(file: MediaFile, context: MediaDeleteContext): boolean {
  // Editors never delete from Raw Uploads, even with a server flag.
  if (context.isEditor && context.displayTab !== 'edited') return false;

  if (typeof file.can_delete === 'boolean') {
    return file.can_delete;
  }

  // Legacy payloads without can_delete.
  if (context.isEditor && context.isVideoEditor) return false;
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
