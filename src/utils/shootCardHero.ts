import type { ShootFileData } from '@/types/shoots';
import { isPlaceholderImageUrl, normalizeImageUrl } from '@/utils/imageUrl';

/**
 * Card heroes for Completed / Delivered / history should prefer real exterior or
 * edited property photos. Floor plans and brand placeholders are last-resort only.
 */

export const SHOOT_CARD_FLOORPLAN_URL_PATTERNS = [
  'floorplan',
  'floor-plan',
  'floor_plan',
  '/floorplans/',
  'floorplans/',
  'fp_',
  'fp-',
  'blueprint',
  'cubicasa',
] as const;

/**
 * CubiCasa (and similar) floor-plan raster exports land as kebab slugs with a
 * trailing page index + short hash, e.g.
 * `0-5933-keysville-road-keymar-md-united-states-0-6d830b71_grid.jpg`.
 * Edited photo grids use photographer filenames (`5933 Keysville Rd-2847_0116_grid.jpg`
 * or `003_SNAP4206_grid.jpg`) and must not match this.
 */
const CUBICASA_FLOORPLAN_BASENAME =
  /(?:^|\/)(\d+)-([a-z0-9]+(?:-[a-z0-9]+){3,})-(\d+)-([a-f0-9]{6,})_(?:grid|web|thumbnail)\./i;

const WATERMARKED_PLACEHOLDER_URL_PATTERNS = [
  'watermarked_placeholder',
  '/branding/',
  'watermark-logos/',
  '/og-image.jpg',
] as const;

const decodeUrlPath = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const isFloorplanLikeHeroUrl = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = decodeUrlPath(String(value)).trim().toLowerCase();
  if (!normalized) return false;
  if (SHOOT_CARD_FLOORPLAN_URL_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }
  // Avoid treating "layout" alone as floorplan — too many false positives in
  // generic CDN paths. Keep blueprint/floorplan keywords above.
  if (CUBICASA_FLOORPLAN_BASENAME.test(normalized)) {
    return true;
  }
  return false;
};

export const isWatermarkedBrandPlaceholderUrl = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return WATERMARKED_PLACEHOLDER_URL_PATTERNS.some((pattern) => normalized.includes(pattern));
};

export const isUnsuitableShootCardHeroUrl = (value?: string | null): boolean => {
  if (!value) return true;
  if (isPlaceholderImageUrl(value)) return true;
  if (isFloorplanLikeHeroUrl(value)) return true;
  if (isWatermarkedBrandPlaceholderUrl(value)) return true;
  return false;
};

export const isFloorplanLikeHeroFile = (
  file?: Pick<ShootFileData, 'media_type' | 'filename' | 'stored_filename' | 'path' | 'url' | 'grid_url' | 'grid_path' | 'web_url' | 'web_path' | 'thumbnail_url' | 'thumbnail_path'> | null,
): boolean => {
  if (!file) return false;
  const mediaType = String(file.media_type ?? '').toLowerCase();
  if (mediaType === 'floorplan' || mediaType === 'video') {
    return true;
  }
  return [
    file.filename,
    file.stored_filename,
    file.path,
    file.url,
    file.grid_url,
    file.grid_path,
    file.web_url,
    file.web_path,
    file.thumbnail_url,
    file.thumbnail_path,
  ].some((candidate) => typeof candidate === 'string' && isFloorplanLikeHeroUrl(candidate));
};

const resolveCandidateUrl = (value?: string | null): string | null => {
  if (!value || isPlaceholderImageUrl(value)) return null;
  const resolved = normalizeImageUrl(value);
  return resolved || null;
};

export type ShootCardHeroSource = {
  heroImage?: string | null;
  previewImages?: Array<string | null | undefined> | null;
  preview_images?: Array<string | null | undefined> | null;
};

/**
 * Prefer an explicit hero when it is a suitable photo; otherwise the first
 * suitable preview. Unsuitable URLs (floor plan / brand placeholder) are kept
 * only when nothing better exists, so cards are never blank if that is all
 * the API returned.
 */
export const selectShootCardHeroUrls = (
  shoot: ShootCardHeroSource,
  options?: { limit?: number; placeholder?: string | null },
): string[] => {
  const limit = Math.max(1, options?.limit ?? 6);
  const placeholder = options?.placeholder ?? null;

  const rawCandidates: string[] = [];
  const push = (value?: string | null) => {
    const resolved = resolveCandidateUrl(value);
    if (!resolved) return;
    if (!rawCandidates.includes(resolved)) {
      rawCandidates.push(resolved);
    }
  };

  push(shoot.heroImage);
  const previews = [
    ...(Array.isArray(shoot.previewImages) ? shoot.previewImages : []),
    ...(Array.isArray(shoot.preview_images) ? shoot.preview_images : []),
  ];
  for (const preview of previews) {
    push(typeof preview === 'string' ? preview : null);
  }

  const preferred = rawCandidates.filter((url) => !isUnsuitableShootCardHeroUrl(url));
  const fallback = rawCandidates.filter((url) => isUnsuitableShootCardHeroUrl(url));
  const selected = (preferred.length > 0 ? preferred : fallback).slice(0, limit);

  if (selected.length > 0) {
    return selected;
  }

  return placeholder ? [placeholder] : [];
};

export const selectShootCardHeroUrl = (
  shoot: ShootCardHeroSource,
  options?: { placeholder?: string | null },
): string | null => {
  return selectShootCardHeroUrls(shoot, { limit: 1, placeholder: options?.placeholder })[0] ?? null;
};
