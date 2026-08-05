import type { MediaFile } from '@/hooks/useShootFiles';
import { normalizeImageUrl } from '@/utils/imageUrl';

const VIDEO_URL_EXTENSION_REGEX = /\.(mp4|mov|m4v|avi|mkv|wmv|webm|mpg|mpeg|3gp)(?:$|[?#])/i;

export function formatMediaFileSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatMediaDateTime(dateStr?: string): string {
  if (!dateStr) return 'Not available';
  const normalized = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export const getMediaResolution = (file: MediaFile): string =>
  file.width && file.height ? `${file.width} × ${file.height}` : '-';

export const getHiddenMediaClassName = (file: MediaFile) =>
  file.is_hidden ? 'blur-[1px] brightness-[0.92]' : '';

export const getGridPreviewMediaClassName = (file: MediaFile) =>
  `absolute inset-0 h-full w-full object-cover transition-all duration-200 ${getHiddenMediaClassName(file)}`;

export function hasDisplayableStillThumbnail(
  thumbSrc: string,
  videoSrc: string,
  isVideo: boolean,
  hasProcessedThumb: boolean,
): boolean {
  if (!hasProcessedThumb || !thumbSrc) return false;
  if (!isVideo) return true;
  return normalizeImageUrl(thumbSrc) !== normalizeImageUrl(videoSrc) && !VIDEO_URL_EXTENSION_REGEX.test(thumbSrc);
}
