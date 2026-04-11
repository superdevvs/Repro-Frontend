import { API_BASE_URL } from '@/config/env';

export interface ImageUrlFields {
  thumbnail_url?: string;
  placeholder_url?: string;
  web_url?: string;
  thumb_url?: string;
  thumb?: string;
  medium_url?: string;
  medium?: string;
  large_url?: string;
  large?: string;
  original_url?: string;
  original?: string;
  url?: string;
  path?: string;
  placeholder_path?: string;
  thumbnail_path?: string;
  web_path?: string;
  watermarked_thumbnail_path?: string;
  watermarked_web_path?: string;
  watermarked_placeholder_path?: string;
  uses_watermark?: boolean;
  usesWatermark?: boolean;
}

const STORAGE_PREFIXES = ['shoots/', 'avatars/', 'branding/', 'share-links/', 'watermark-logos/'];
const REBASEABLE_PATH_PREFIXES = ['/storage/', '/api/shoots/'];

const getApiBase = () => String(API_BASE_URL || '').replace(/\/+$/, '');

const withBase = (value: string) => {
  const baseUrl = getApiBase();
  if (!baseUrl) {
    return value;
  }
  return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
};

const shouldUseStoragePrefix = (value: string) =>
  STORAGE_PREFIXES.some((prefix) => value.startsWith(prefix));

const shouldRebaseAbsoluteUrl = (url: URL) =>
  REBASEABLE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

export const PLACEHOLDER_IMAGE_MARKERS = [
  '/placeholder.svg',
  '/no-image-placeholder.svg',
  '/no-image-placeholder-dark.svg',
  'placeholder.svg',
  'no-image-placeholder',
];

export const isPlaceholderImageUrl = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return PLACEHOLDER_IMAGE_MARKERS.some((marker) => normalized.includes(marker));
};

export function normalizeImageUrl(value?: string | null): string {
  if (!value) return '';

  const trimmed = String(value).trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const apiBase = getApiBase();
    if (!apiBase) {
      return trimmed;
    }

    try {
      const absolute = new URL(trimmed);
      const targetBase = new URL(apiBase);
      if (absolute.origin !== targetBase.origin && shouldRebaseAbsoluteUrl(absolute)) {
        return `${targetBase.origin}${absolute.pathname}${absolute.search}${absolute.hash}`;
      }
    } catch {
      return trimmed;
    }

    return trimmed;
  }

  let normalized = trimmed;
  if (normalized.startsWith('/')) {
    return withBase(encodeURI(normalized));
  }

  if (shouldUseStoragePrefix(normalized)) {
    normalized = `/storage/${normalized}`;
  } else {
    normalized = `/${normalized}`;
  }

  return withBase(encodeURI(normalized));
}

const collectResolvedUrls = (
  file: ImageUrlFields,
  keys: Array<keyof ImageUrlFields>,
): Set<string> => {
  const resolvedUrls = new Set<string>();

  for (const key of keys) {
    const candidate = file[key];
    if (!candidate || isPlaceholderImageUrl(candidate as string)) {
      continue;
    }

    const resolved = normalizeImageUrl(String(candidate));
    if (resolved) {
      resolvedUrls.add(resolved);
    }
  }

  return resolvedUrls;
};

const firstResolvedUrl = (
  file: ImageUrlFields,
  keys: Array<keyof ImageUrlFields>,
  excludeMatchingKeys: Array<keyof ImageUrlFields> = [],
): string => {
  const excludedUrls =
    excludeMatchingKeys.length > 0 ? collectResolvedUrls(file, excludeMatchingKeys) : null;

  for (const key of keys) {
    const candidate = file[key];
    if (!candidate || isPlaceholderImageUrl(candidate as string)) {
      continue;
    }

    const resolved = normalizeImageUrl(String(candidate));
    if (resolved && !excludedUrls?.has(resolved)) {
      return resolved;
    }
  }

  return '';
};

const shouldUseWatermarkedFallbacks = (file: ImageUrlFields): boolean =>
  Boolean(file.uses_watermark ?? file.usesWatermark);

/**
 * Resolve an image URL from a media file object with proper fallback chain.
 * Extracted from AiEditing.tsx for reuse across components.
 */
export function getImageUrl(
  file: ImageUrlFields,
  size: 'thumb' | 'medium' | 'large' | 'original' = 'medium'
): string {
  const watermarkThumbKeys: Array<keyof ImageUrlFields> = shouldUseWatermarkedFallbacks(file)
    ? ['watermarked_thumbnail_path', 'watermarked_web_path', 'watermarked_placeholder_path']
    : [];
  const watermarkMediumKeys: Array<keyof ImageUrlFields> = shouldUseWatermarkedFallbacks(file)
    ? ['watermarked_web_path', 'watermarked_thumbnail_path', 'watermarked_placeholder_path']
    : [];

  if (size === 'thumb') {
    return firstResolvedUrl(file, [
      'thumb_url',
      'thumb',
      'thumbnail_url',
      'thumbnail_path',
      'web_url',
      'web_path',
      'medium_url',
      'medium',
      'placeholder_url',
      'placeholder_path',
      ...watermarkThumbKeys,
    ], [
      'original_url',
      'original',
      'url',
      'path',
      'large_url',
      'large',
    ]);
  }

  if (size === 'medium') {
    return firstResolvedUrl(file, [
      'web_url',
      'web_path',
      'medium_url',
      'medium',
      'thumb_url',
      'thumb',
      'thumbnail_url',
      'thumbnail_path',
      'placeholder_url',
      'placeholder_path',
      ...watermarkMediumKeys,
    ], [
      'original_url',
      'original',
      'url',
      'path',
      'large_url',
      'large',
    ]);
  }

  if (size === 'large') {
    return firstResolvedUrl(file, [
      'large_url',
      'large',
      'web_url',
      'web_path',
      'medium_url',
      'medium',
      'thumb_url',
      'thumb',
      'thumbnail_url',
      'thumbnail_path',
      'placeholder_url',
      'placeholder_path',
      ...watermarkMediumKeys,
    ], [
      'original_url',
      'original',
      'url',
      'path',
    ]);
  }

  return firstResolvedUrl(file, [
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
}
