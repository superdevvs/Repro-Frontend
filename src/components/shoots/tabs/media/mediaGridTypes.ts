import type React from 'react';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { MediaSortOrder } from './mediaSort';

export interface MediaGridProps {
  files: MediaFile[];
  onFileClick: (index: number, sortedFiles: MediaFile[]) => void;
  selectedFiles: Set<string>;
  onSelectionChange: (fileId: string) => void;
  onSelectAll?: () => void;
  canSelect: boolean;
  sortOrder?: MediaSortOrder;
  manualSortActive?: boolean;
  manualOrder?: string[];
  onManualOrderChange?: (newOrder: string[]) => void;
  getImageUrl: (file: MediaFile, size?: 'thumb' | 'medium' | 'large' | 'original') => string;
  getSrcSet: (file: MediaFile) => string;
  isImage: (file: MediaFile) => boolean;
  isVideo?: (file: MediaFile) => boolean;
  viewMode?: 'list' | 'grid';
  isClient?: boolean;
  toggleFileHidden?: (fileId: string, hidden: boolean) => void;
  separateExtras?: boolean;
  canInteractSingleMedia?: boolean;
  canDownloadSingleMedia?: boolean;
  onToggleFavorite?: (fileId: string) => void;
  onAddComment?: (fileId: string, comment: string) => void;
  onDownloadSingle?: (fileId: string) => void;
  enableRawStacks?: boolean;
  rawStackSize?: number | null;
  renderScanStatus?: (file: MediaFile) => React.ReactNode | null;
}
