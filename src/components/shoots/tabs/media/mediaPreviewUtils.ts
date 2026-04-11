import { type MediaFile } from '@/hooks/useShootFiles';
import { isPlaceholderImageUrl, normalizeImageUrl } from '@/utils/imageUrl';

export type MediaImageSize = 'thumb' | 'web' | 'medium' | 'large' | 'original';

const RAW_EXTENSIONS = /\.(nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/;
const DERIVATIVE_SUFFIX_REGEX = /([._-](thumb|thumbnail|web|medium|large|full|placeholder))+$/i;

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

const getStrictResolvedUrls = (
  file: MediaFile,
  keys: Array<keyof MediaFile>,
): string[] => {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const key of keys) {
    const candidate = file[key];
    if (!candidate) {
      continue;
    }

    const value = String(candidate).trim();
    if (!value || isPlaceholderImageUrl(value)) {
      continue;
    }

    const normalized = normalizeImageUrl(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    urls.push(normalized);
  }

  return urls;
};

const getStrictThumbCandidates = (file: MediaFile): string[] =>
  getStrictResolvedUrls(file, [
    'thumb_url',
    'thumb',
    'thumbnail_url',
    'thumbnail_path',
    'watermarked_thumbnail_path',
  ]);

const getStrictPreviewCandidates = (file: MediaFile): string[] =>
  getStrictResolvedUrls(file, [
    'web_url',
    'web_path',
    'medium_url',
    'medium',
    'large_url',
    'large',
    'watermarked_web_path',
  ]);

const getStrictPlaceholderCandidates = (file: MediaFile): string[] =>
  getStrictResolvedUrls(file, [
    'placeholder_url',
    'placeholder_path',
    'watermarked_placeholder_path',
  ]);

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
  return getMediaImageUrlCandidates(file, size)[0] || '';
};

export const getMediaImageUrlCandidates = (
  file: MediaFile,
  size: MediaImageSize = 'medium',
): string[] => {
  if (size === 'thumb') {
    return getStrictThumbCandidates(file);
  }

  if (size === 'web' || size === 'medium' || size === 'large') {
    return [
      ...getStrictPreviewCandidates(file),
      ...getStrictThumbCandidates(file),
      ...getStrictPlaceholderCandidates(file),
    ];
  }

  return getStrictResolvedUrls(file, [
    'original_url',
    'original',
    'url',
    'path',
    'large_url',
    'large',
    'medium_url',
    'medium',
    'web_url',
    'web_path',
    'thumb_url',
    'thumb',
    'thumbnail_url',
    'thumbnail_path',
    'placeholder_url',
    'placeholder_path',
  ]);
};

export const getMediaViewerImageCandidates = (file: MediaFile): string[] => {
  const thumbCandidates = getStrictThumbCandidates(file);
  const previewCandidates = getStrictPreviewCandidates(file);
  const placeholderCandidates = getStrictPlaceholderCandidates(file);
  const explicitOriginalUrl = normalizeImageUrl(file.original_url || file.original || '');
  const explicitDisplayUrl = normalizeImageUrl(file.url || '');
  const safeDisplayUrlCandidates =
    explicitDisplayUrl &&
    explicitDisplayUrl !== explicitOriginalUrl &&
    !thumbCandidates.includes(explicitDisplayUrl) &&
    !placeholderCandidates.includes(explicitDisplayUrl)
      ? [explicitDisplayUrl]
      : [];
  const preferredCandidates = [
    ...previewCandidates,
    ...safeDisplayUrlCandidates,
    ...thumbCandidates,
    ...placeholderCandidates,
  ];

  return Array.from(new Set(preferredCandidates.filter(Boolean)));
};

export const getMediaViewerImageUrl = (file: MediaFile): string => {
  return getMediaViewerImageCandidates(file)[0] || '';
};

export const getDisplayMediaFilename = (file: Pick<MediaFile, 'filename'>): string => {
  const rawFilename = String(file.filename || '').trim();
  if (!rawFilename) {
    return '';
  }

  const extensionMatch = rawFilename.match(/\.([^.]+)$/);
  if (!extensionMatch) {
    return rawFilename.replace(DERIVATIVE_SUFFIX_REGEX, '');
  }

  const extension = extensionMatch[1];
  const baseName = rawFilename.slice(0, -(extension.length + 1));
  const cleanedBaseName = baseName.replace(DERIVATIVE_SUFFIX_REGEX, '');

  if (new RegExp(`\\.${extension}$`, 'i').test(cleanedBaseName)) {
    return cleanedBaseName;
  }

  return `${cleanedBaseName}.${extension}`;
};

export const getMediaSrcSet = (file: MediaFile): string => {
  const sizes: string[] = [];
  const thumbUrl = getStrictThumbCandidates(file)[0] || '';
  const previewUrl = getStrictPreviewCandidates(file)[0] || '';

  if (thumbUrl && thumbUrl !== previewUrl) sizes.push(`${thumbUrl} 300w`);
  if (previewUrl) sizes.push(`${previewUrl} 1600w`);
  return sizes.join(', ');
};
