type HostedVideo = { provider: 'youtube' | 'vimeo'; id: string; privacyHash?: string };

/** Use exact provider hosts and retain case-sensitive video IDs. */
const hostedVideo = (source: string): HostedVideo | null => {
  try {
    const url = new URL(source);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be'].includes(host)) {
      const id = host.endsWith('youtu.be') ? url.pathname.slice(1)
        : url.pathname === '/watch' ? url.searchParams.get('v')
          : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
      return id && /^[\w-]{11}$/.test(id) ? { provider: 'youtube', id } : null;
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
      const match = url.pathname.match(host === 'player.vimeo.com' ? /^\/video\/(\d+)\/?$/ : /^\/(\d+)(?:\/([\w]+))?\/?$/);
      return match ? { provider: 'vimeo', id: match[1], privacyHash: url.searchParams.get('h') || match[2] || undefined } : null;
    }
  } catch { /* A relative or unknown source is compared without provider rewriting. */ }
  return null;
};

/** Pull only the source from pasted markup; no markup is rendered. */
export const extractTourMediaSource = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || !(trimmed.includes('<') && trimmed.includes('>'))) return trimmed;
  const match = trimmed.match(/<(?:iframe|source)\b[^>]*\bsrc=["']([^"']+)["']/i)
    || trimmed.match(/<video\b[^>]*\bsrc=["']([^"']+)["']/i);
  return match?.[1]?.trim().replace(/&amp;/gi, '&') || '';
};

export const getTourMediaEmbedUrl = (value: string): string | null => {
  const source = extractTourMediaSource(value);
  if (!source) return null;
  const video = hostedVideo(source);
  if (video?.provider === 'youtube') return `https://www.youtube.com/embed/${video.id}`;
  if (video?.provider === 'vimeo') {
    const player = new URL(`https://player.vimeo.com/video/${video.id}`);
    if (video.privacyHash) player.searchParams.set('h', video.privacyHash);
    return player.toString();
  }
  return source;
};

/** Presentation options differ across templates; they do not identify another video. */
export const normalizeTourMediaCompareKey = (value: string): string | null => {
  const source = extractTourMediaSource(value);
  if (!source) return null;
  const video = hostedVideo(source);
  if (video) return `${video.provider}:${video.id}`;
  try {
    const url = new URL(source);
    url.hash = '';
    for (const key of ['autoplay', 'mute', 'muted', 'rel', 'share', 'fl', 'fe']) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.toString();
  } catch { return source; }
};

/** Keep the first source, preserving its URL and any access credentials. */
export const uniqueTourMediaUrls = (values: Array<string | null | undefined>, excluded: Array<string | null | undefined> = []): string[] => {
  const seen = new Set(excluded.flatMap((value) => value ? [normalizeTourMediaCompareKey(value)] : []).filter(Boolean));
  return values.filter((value): value is string => {
    if (!value?.trim()) return false;
    const key = normalizeTourMediaCompareKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
