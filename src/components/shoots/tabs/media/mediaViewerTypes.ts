import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';

export interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  files: MediaFile[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  getImageUrl: (file: MediaFile, size?: 'thumb' | 'web' | 'medium' | 'large' | 'original') => string;
  getSrcSet?: (file: MediaFile) => string;
  shoot?: ShootData;
  isAdmin?: boolean;
  isClient?: boolean;
  canViewFullSize?: boolean;
  canStartSlideshow?: boolean;
  canInteractSingleMedia?: boolean;
  canDownloadSingleMedia?: boolean;
  slideshowFiles?: MediaFile[];
  onViewerContextChange?: (index: number, files: MediaFile[]) => void;
  onToggleFavorite?: (fileId: string) => void;
  onAddComment?: (fileId: string, comment: string) => void;
  onToggleHidden?: (fileId: string, hidden: boolean) => void;
  onDownloadSingle?: (fileId: string) => void;
  onShootUpdate?: () => void;
}

export interface MediaIssueRequest {
  id: string;
  mediaId?: string;
  mediaIds?: string[];
  note: string;
  status: 'open' | 'in-progress' | 'resolved' | string;
  createdAt?: string;
  updatedAt?: string;
  assignedToRole?: 'editor' | 'photographer' | string;
  raisedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
}

export const formatViewerFileSize = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const formatViewerDateTime = (value?: string | null) => {
  if (!value) return '—';
  // Normalize EXIF capture timestamps ("YYYY:MM:DD HH:MM:SS") so they parse instead of
  // rendering as "Invalid Date"; ISO strings (comments/requests) are unaffected.
  const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const getRequestStatusClassName = (status?: string) => {
  if (status === 'resolved') return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200';
  if (status === 'in-progress') return 'border-amber-500/30 bg-amber-500/15 text-amber-100';
  return 'border-rose-500/30 bg-rose-500/15 text-rose-100';
};

export const SLIDESHOW_INTERVAL_OPTIONS = [5, 7, 10, 3] as const;
export const MAX_MEDIA_VIEWER_ZOOM = 10;


