import { API_BASE_URL } from '@/config/env';

export interface ImageUrlFields {
  thumb_url?: string;
  medium_url?: string;
  large_url?: string;
  original_url?: string;
  url?: string;
  path?: string;
  placeholder_path?: string;
  thumbnail_path?: string;
  web_path?: string;
}

/**
 * Resolve an image URL from a media file object with proper fallback chain.
 * Extracted from AiEditing.tsx for reuse across components.
 */
export function getImageUrl(
  file: ImageUrlFields,
  size: 'thumb' | 'medium' | 'large' | 'original' = 'medium'
): string {
  const baseUrl = API_BASE_URL;

  const resolveUrl = (value: string): string => {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/')) return `${baseUrl}${value}`;
    return `${baseUrl}/${value}`;
  };

  // Try size-specific URL first
  const sizeMap: Record<string, keyof ImageUrlFields> = {
    thumb: 'thumb_url',
    medium: 'medium_url',
    large: 'large_url',
    original: 'original_url',
  };

  const sizeKey = sizeMap[size];
  const sizeUrl = file[sizeKey] as string | undefined;

  if (sizeUrl) {
    return resolveUrl(sizeUrl);
  }

  // Avoid loading originals for thumbnails/medium previews
  if (size === 'thumb') {
    if (file.placeholder_path) return resolveUrl(file.placeholder_path);
    return '';
  }

  if (size === 'medium') {
    if (file.thumb_url) return resolveUrl(file.thumb_url);
    return '';
  }

  if (size === 'large' && file.medium_url) {
    return resolveUrl(file.medium_url);
  }

  // Only allow original fallback for large/original sizes
  const allowOriginalFallback = size === 'large' || size === 'original';
  if (!allowOriginalFallback) {
    return '';
  }

  // Fallback to original
  if (file.original_url) {
    return resolveUrl(file.original_url);
  }

  // Final fallback
  if (file.url) {
    return resolveUrl(file.url);
  }

  if (file.path) {
    const clean = file.path.replace(/^\/+/, '');
    return `${baseUrl}/${clean}`;
  }

  return '';
}
