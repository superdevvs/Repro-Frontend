import type { MediaFile } from '@/hooks/useShootFiles';

type MediaFileWithPreviewImages = MediaFile & {
  previewImages?: unknown;
  preview_images?: unknown;
};

function hasProcessedImagePreview(file: MediaFile): boolean {
  const previewFile = file as MediaFileWithPreviewImages;
  return (
    (Array.isArray(previewFile.previewImages) && previewFile.previewImages.length > 0) ||
    (Array.isArray(previewFile.preview_images) && previewFile.preview_images.length > 0)
  );
}

function isDisplayableImage(file: MediaFile): boolean {
  const mediaType = (file.media_type || '').toLowerCase();
  const hasPreviewImages = hasProcessedImagePreview(file);
  if (
    mediaType === 'floorplan' &&
    (hasPreviewImages || file.thumbnail_path || file.thumb || file.medium || file.web_path)
  ) {
    return true;
  }
  // A processed thumbnail makes RAW and image media displayable.
  if (
    (file.media_type === 'raw' || file.media_type === 'image') &&
    (file.thumbnail_path || file.thumb || file.medium || file.web_path)
  ) {
    return true;
  }
  const name = file.filename.toLowerCase();
  const rawExt = /\.(nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/.test(name);
  if (rawExt) return false;
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
  return /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif)$/.test(name);
}

export const isImageFile = isDisplayableImage;
export const isPreviewableImage = isDisplayableImage;

export function isVideoFile(file: MediaFile): boolean {
  if (file.media_type === 'video') return true;
  const name = (file.filename || '').toLowerCase();
  const mime = (file.fileType || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  return /\.(mp4|mov|avi|mkv|wmv|webm)$/.test(name);
}
