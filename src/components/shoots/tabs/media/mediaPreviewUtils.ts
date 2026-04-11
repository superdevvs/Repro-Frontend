import { type MediaFile } from '@/hooks/useShootFiles';
import { getImageUrl, getImageUrlCandidates } from '@/utils/imageUrl';

export type MediaImageSize = 'thumb' | 'web' | 'medium' | 'large' | 'original';

const RAW_EXTENSIONS = /\.(nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/;

const hasProcessedRawPreview = (file: MediaFile): boolean =>
  Boolean(file.thumbnail_path || file.thumb || file.medium || file.web_path);

const hasPreviewableImageFile = (file: MediaFile): boolean => {
  if ((file.media_type === 'raw' || file.media_type === 'image') && hasProcessedRawPreview(file)) {
    return true;
  }

  const name = (file.filename || '').toLowerCase();
  if (RAW_EXTENSIONS.test(name)) return false;

  const mime = (file.fileType || '').toLowerCase();
  const rawMime =
    mime.includes('nef') ||
    mime.includes('dng') ||
    mime.includes('cr2') ||
    mime.includes('cr3') ||
    mime.includes('arw') ||
    mime.includes('raf') ||
    mime.includes('raw');
  if (rawMime) return false;

  if (mime.startsWith('image/')) return true;
  return /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif)$/i.test(name);
};

export const isPreviewableImage = (file: MediaFile): boolean => hasPreviewableImageFile(file);

export const isImageFile = (file: MediaFile): boolean => hasPreviewableImageFile(file);

export const isVideoFile = (file: MediaFile): boolean => {
  if (file.media_type === 'video') return true;

  const name = (file.filename || '').toLowerCase();
  const mime = (file.fileType || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  return /\.(mp4|mov|avi|mkv|wmv|webm)$/i.test(name);
};

export const getMediaImageUrl = (
  file: MediaFile,
  size: MediaImageSize = 'medium',
): string => {
  return getImageUrl(file, size);
};

export const getMediaImageUrlCandidates = (
  file: MediaFile,
  size: MediaImageSize = 'medium',
): string[] => {
  return getImageUrlCandidates(file, size);
};

export const getMediaSrcSet = (file: MediaFile): string => {
  const sizes: string[] = [];
  const thumbUrl = getMediaImageUrl(file, 'thumb');
  const previewUrl = getMediaImageUrl(file, 'web');

  if (thumbUrl && thumbUrl !== previewUrl) sizes.push(`${thumbUrl} 300w`);
  if (previewUrl) sizes.push(`${previewUrl} 1600w`);
  return sizes.join(', ');
};
