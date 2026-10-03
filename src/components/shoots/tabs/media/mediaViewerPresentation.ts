import type { MediaFile } from '@/hooks/useShootFiles';
import { formatViewerDateTime, formatViewerFileSize } from './mediaViewerTypes';
import { canViewAiEditStatus } from './mediaAiVisibility';

export function getMediaViewerDetailRows(currentFile: MediaFile, isClient: boolean, fileExt?: string, role?: string) {
  return [
    {
      label: 'Type',
      value: currentFile.fileType?.split('/').pop()?.toUpperCase() || fileExt || '—',
    },
    {
      label: 'Media',
      value: currentFile.media_type ? String(currentFile.media_type).replace(/_/g, ' ') : '—',
    },
    {
      label: 'Stage',
      value: currentFile.workflowStage ? String(currentFile.workflowStage).replace(/_/g, ' ') : '—',
    },
    ...(canViewAiEditStatus(role) ? [{
      label: 'Edited with AI',
      value: currentFile.is_ai_edited || currentFile.isAiEdited ? 'Yes' : 'No',
    }] : []),
    {
      label: 'Resolution',
      value: currentFile.width && currentFile.height ? `${currentFile.width} × ${currentFile.height}` : '—',
    },
    {
      label: 'Captured',
      value: formatViewerDateTime(currentFile.captured_at || currentFile.created_at),
    },
    {
      label: 'Size',
      value: !isClient ? formatViewerFileSize(currentFile.fileSize) : '—',
    },
  ];
}

export function getSlideshowMotionVariants(prefersReducedMotion: boolean | null) {
  return {
    initial: (direction: 1 | -1) => ({
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 1.025,
      x: prefersReducedMotion ? 0 : direction > 0 ? 28 : -28,
      y: prefersReducedMotion ? 0 : 6,
      filter: prefersReducedMotion ? 'none' : 'blur(8px)',
    }),
    animate: {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: prefersReducedMotion ? 0 : 0.08,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: (direction: 1 | -1) => ({
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 0.985,
      x: prefersReducedMotion ? 0 : direction > 0 ? -22 : 22,
      y: prefersReducedMotion ? 0 : -4,
      filter: prefersReducedMotion ? 'none' : 'blur(6px)',
      transition: {
        duration: prefersReducedMotion ? 0 : 0.08,
        ease: [0.4, 0, 0.2, 1],
      },
    }),
  };
}
