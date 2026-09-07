import { decodeStudioDeepLink, encodeStudioDeepLink, STUDIO_PATH } from './studioDeepLink';

export type ShootStudioMedia = 'images' | 'videos';

const presetMedia = {
  'listing-ready': 'images',
  'color-correction': 'images',
  twilight: 'images',
  'green-grass': 'images',
  'sky-replacement': 'images',
  'perspective-correction': 'images',
  'virtual-staging': 'images',
  'full-shoot': 'images',
  walkthrough: 'videos',
  'property-reel': 'videos',
  'social-teaser': 'videos',
} as const satisfies Record<string, ShootStudioMedia>;

export type ShootStudioPresetId = keyof typeof presetMedia;

export interface ShootStudioEntry {
  /** A requested record ID only. Studio must authorize it before loading media. */
  shootId: string;
  media: ShootStudioMedia;
  presetId: ShootStudioPresetId | null;
}

function normalizeShootId(value: string | number): string | null {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  const id = String(value).trim();
  return /^[1-9]\d*$/.test(id) ? id : null;
}

function presetForMedia(value: string | null | undefined, media: ShootStudioMedia): ShootStudioPresetId | null {
  if (!value || !Object.prototype.hasOwnProperty.call(presetMedia, value)) return null;
  const presetId = value as ShootStudioPresetId;
  return presetMedia[presetId] === media ? presetId : null;
}

/** Builds a navigation link only; opening it never starts a generation. */
export function buildShootStudioHref({
  shootId,
  media,
  presetId,
}: {
  shootId: string | number;
  media: ShootStudioMedia;
  presetId?: ShootStudioPresetId;
}): string | null {
  const id = normalizeShootId(shootId);
  if (!id || (media !== 'images' && media !== 'videos')) return null;

  const search = encodeStudioDeepLink({
    destination: 'command-center',
    recordType: 'shoot',
    recordId: id,
  });
  search.set('media', media);
  const preset = presetForMedia(presetId, media);
  if (preset) search.set('preset', preset);
  return `${STUDIO_PATH}?${search.toString()}`;
}

/** Reads selection intent, not permission. Unknown or incompatible presets are ignored. */
export function readShootStudioEntry(search: string | URLSearchParams): ShootStudioEntry | null {
  const params = new URLSearchParams(search);
  const link = decodeStudioDeepLink(params);
  const media = params.get('media');
  if (link?.recordType !== 'shoot' || !link.recordId || (media !== 'images' && media !== 'videos')) {
    return null;
  }
  const shootId = normalizeShootId(link.recordId);
  if (!shootId) return null;

  return { shootId, media, presetId: presetForMedia(params.get('preset'), media) };
}
