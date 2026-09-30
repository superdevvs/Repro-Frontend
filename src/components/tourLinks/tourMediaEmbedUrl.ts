/**
 * Convert watch/share media URLs into iframe-safe embed URLs.
 * Used for tour `video_link` and Virtual Tours `embeds` URL values (not raw HTML).
 */
export const getTourMediaEmbedUrl = (url: string): string | null => {
  if (!url) return null;

  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Match share URLs (vimeo.com/ID?share=…) and already-player URLs with /video/ID.
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return url;
};

/** Pull a media URL out of raw HTML paste (iframe/video/source src); URLs pass through. */
export const extractTourMediaSource = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!(trimmed.includes('<') && trimmed.includes('>'))) return trimmed;

  const match =
    trimmed.match(/<(?:iframe|source)\b[^>]*\bsrc=["']([^"']+)["']/i) ||
    trimmed.match(/<video\b[^>]*\bsrc=["']([^"']+)["']/i) ||
    trimmed.match(/\bsrc=["']([^"']+)["']/i);
  return match?.[1]?.trim() || '';
};

/**
 * Stable compare key so share URLs, player URLs, and HTML with the same media
 * collapse together (and match Video Tour).
 */
export const normalizeTourMediaCompareKey = (value: string): string | null => {
  const source = extractTourMediaSource(value);
  if (!source) return null;

  const embed = getTourMediaEmbedUrl(source);
  if (!embed) return null;

  try {
    const parsed = new URL(embed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('youtube') || host.includes('vimeo')) {
      return `${host}${parsed.pathname}`.toLowerCase();
    }
    parsed.hash = '';
    for (const key of ['autoplay', 'mute', 'muted', 'rel', 'share', 'fl', 'fe']) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString().toLowerCase();
  } catch {
    return embed.trim().toLowerCase();
  }
};

export type TourEmbedLike = {
  id: string;
  title?: string;
  branded?: string;
  mls?: string;
  value?: string;
};

export const resolveTourEmbedDisplayValue = (
  embed: TourEmbedLike,
  variant: 'branded' | 'mls' | 'generic-mls' | string = 'branded',
): string => {
  if (typeof embed.value === 'string' && embed.value.trim()) return embed.value;
  if (variant === 'branded') return embed.branded || embed.mls || '';
  return embed.mls || '';
};

/**
 * Virtual Tours should not re-show listing video. Drop embeds whose normalized
 * media matches Video Tour URLs, and collapse duplicate embed URLs.
 */
export const filterVirtualTourEmbeds = <T extends TourEmbedLike>(
  embeds: T[],
  options: {
    videoUrls?: Array<string | null | undefined>;
    getValue?: (embed: T) => string;
    featuredId?: string | null;
  } = {},
): T[] => {
  const getValue =
    options.getValue ??
    ((embed: T) => embed.value || embed.branded || embed.mls || '');

  const blocked = new Set<string>();
  for (const videoUrl of options.videoUrls ?? []) {
    if (!videoUrl) continue;
    const key = normalizeTourMediaCompareKey(videoUrl);
    if (key) blocked.add(key);
  }

  const featuredId = options.featuredId || null;
  const featured = featuredId ? embeds.find((embed) => embed.id === featuredId) : undefined;
  const ordered = featured
    ? [featured, ...embeds.filter((embed) => embed.id !== featuredId)]
    : embeds;

  const seen = new Set<string>();
  const filtered: T[] = [];

  for (const embed of ordered) {
    const value = getValue(embed);
    if (!value) continue;

    const key = normalizeTourMediaCompareKey(value);
    if (!key) {
      // Unrecognized HTML (no src) — keep once by raw content.
      const rawKey = `raw:${value.trim()}`;
      if (seen.has(rawKey)) continue;
      seen.add(rawKey);
      filtered.push(embed);
      continue;
    }

    if (blocked.has(key) || seen.has(key)) continue;
    seen.add(key);
    filtered.push(embed);
  }

  return filtered;
};

export type TourMediaUrlRef = {
  id?: string;
  url: string;
  label: string;
  kind: 'embed' | 'video_link';
};

export type TourMediaDuplicateConflict = {
  candidate: TourMediaUrlRef;
  existing: TourMediaUrlRef;
  /** User-facing explanation for the warning dialog. */
  message: string;
};

const describeTourMediaRef = (ref: TourMediaUrlRef) => {
  if (ref.kind === 'video_link') {
    return ref.label || 'the listing Video Link';
  }
  return ref.label || 'an existing embed';
};

/**
 * Detect when a candidate URL normalizes to the same media as an existing
 * embed or listing video_link (YouTube/Vimeo share vs player URLs included).
 */
export const findTourMediaDuplicateConflict = (
  candidate: {
    id?: string;
    url: string;
    label?: string;
    kind?: 'embed' | 'video_link';
  },
  existing: TourMediaUrlRef[],
): TourMediaDuplicateConflict | null => {
  const candidateUrl = candidate.url.trim();
  if (!candidateUrl) return null;

  const candidateKey = normalizeTourMediaCompareKey(candidateUrl);
  if (!candidateKey) return null;

  const candidateRef: TourMediaUrlRef = {
    id: candidate.id,
    url: candidateUrl,
    label: candidate.label?.trim() || (candidate.kind === 'video_link' ? 'Video Link' : 'Embed'),
    kind: candidate.kind ?? 'embed',
  };

  for (const item of existing) {
    if (!item.url.trim()) continue;
    if (candidate.id && item.id && candidate.id === item.id) continue;
    const existingKey = normalizeTourMediaCompareKey(item.url);
    if (!existingKey || existingKey !== candidateKey) continue;

    const existingLabel = describeTourMediaRef(item);
    const message =
      item.kind === 'video_link'
        ? `This link is the same as ${existingLabel}. Use one listing video — do not add it again as a separate embed.`
        : `This link matches ${existingLabel}. Duplicate video embeds are not allowed.`;

    return { candidate: candidateRef, existing: item, message };
  }

  return null;
};

/** First pairwise duplicate within a list (order preserved). */
export const findDuplicateAmongTourMediaUrls = (
  items: TourMediaUrlRef[],
): TourMediaDuplicateConflict | null => {
  const seen = new Map<string, TourMediaUrlRef>();
  for (const item of items) {
    const key = normalizeTourMediaCompareKey(item.url);
    if (!key) continue;
    const prior = seen.get(key);
    if (prior) {
      return findTourMediaDuplicateConflict(item, [prior]);
    }
    seen.set(key, item);
  }
  return null;
};
