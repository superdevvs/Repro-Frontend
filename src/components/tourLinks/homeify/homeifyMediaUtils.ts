import { getTourMediaEmbedUrl } from '../tourMediaEmbedUrl';

const safeUrl = (raw: string) => {
  try { const url = new URL(raw, window.location.origin); return ['https:', 'http:'].includes(url.protocol) ? url : null; }
  catch { return null; }
};

/** Read only media sources from embed markup; no HTML or script is inserted into the page. */
export const homeifyEmbedUrl = (value: string, autoplay = false): string => {
  const raw = value.includes('<') ? new DOMParser().parseFromString(value, 'text/html').querySelector('iframe[src], video[src], video source[src]')?.getAttribute('src') || '' : value.trim();
  const url = safeUrl(raw);
  if (!raw || !url) return '';
  const player = new URL(getTourMediaEmbedUrl(url.toString()) || url.toString());
  if (player.hostname === 'www.youtube.com' && player.pathname.startsWith('/embed/')) {
    player.hostname = 'www.youtube-nocookie.com';
    player.searchParams.set('rel', '0');
    if (autoplay) { player.searchParams.set('autoplay', '1'); player.searchParams.set('mute', '1'); }
    return player.toString();
  }
  if (player.hostname === 'player.vimeo.com') {
    if (autoplay) { player.searchParams.set('autoplay', '1'); player.searchParams.set('muted', '1'); }
    return player.toString();
  }
  if (autoplay) { url.searchParams.set('autoplay', '1'); url.searchParams.set('mute', '1'); }
  return url.toString();
};
