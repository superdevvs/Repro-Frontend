const safeUrl = (raw: string) => {
  try { const url = new URL(raw, window.location.origin); return ['https:', 'http:'].includes(url.protocol) ? url : null; }
  catch { return null; }
};

/** Read only media sources from embed markup; no HTML or script is inserted into the page. */
export const homeifyEmbedUrl = (value: string, autoplay = false): string => {
  const raw = value.includes('<') ? new DOMParser().parseFromString(value, 'text/html').querySelector('iframe[src], video[src], video source[src]')?.getAttribute('src') || '' : value.trim();
  const url = safeUrl(raw);
  if (!raw || !url) return '';
  const youtube = /^(www\.|m\.)?youtube\.com$/.test(url.hostname) ? url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] : url.hostname === 'youtu.be' ? url.pathname.slice(1) : null;
  if (youtube && /^[\w-]+$/.test(youtube)) return `https://www.youtube-nocookie.com/embed/${youtube}?rel=0${autoplay ? '&autoplay=1&mute=1' : ''}`;
  const vimeo = /^(www\.)?vimeo\.com$/.test(url.hostname) ? url.pathname.match(/^\/(\d+)(?:\/([\w]+))?\/?$/) : null;
  if (vimeo) {
    const player = new URL(`https://player.vimeo.com/video/${vimeo[1]}`);
    const privacyHash = url.searchParams.get('h') || vimeo[2];
    if (privacyHash) player.searchParams.set('h', privacyHash);
    if (autoplay) { player.searchParams.set('autoplay', '1'); player.searchParams.set('muted', '1'); }
    return player.toString();
  }
  if (autoplay) { url.searchParams.set('autoplay', '1'); url.searchParams.set('mute', '1'); }
  return url.toString();
};
