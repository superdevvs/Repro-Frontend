import type { VideoHTMLAttributes } from 'react';

export const restrictedVideoControlsList = 'nodownload noplaybackrate noremoteplayback';

export const restrictedVideoProps: Pick<
  VideoHTMLAttributes<HTMLVideoElement>,
  'controlsList' | 'disablePictureInPicture' | 'disableRemotePlayback'
> = {
  controlsList: restrictedVideoControlsList,
  disablePictureInPicture: true,
  disableRemotePlayback: true,
};

const stripPictureInPictureAllow = (allowValue: string) =>
  allowValue
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item && item.toLowerCase() !== 'picture-in-picture')
    .join('; ');

const restrictVideoElement = (video: HTMLVideoElement) => {
  video.setAttribute('controlsList', restrictedVideoControlsList);
  video.setAttribute('disablePictureInPicture', '');
  video.setAttribute('disableRemotePlayback', '');
};

const fallbackSanitizeTourEmbedHtml = (
  html: string,
  transformSrc: (src: string) => string,
) =>
  html
    .replace(/(<iframe\b[^>]*\ssrc=["'])([^"']*)(["'][^>]*>)/gi, (_match, start, src, end) => {
      return `${start}${transformSrc(src)}${end}`;
    })
    .replace(/(<iframe\b[^>]*\sallow=["'])([^"']*)(["'][^>]*>)/gi, (_match, start, allow, end) => {
      return `${start}${stripPictureInPictureAllow(allow)}${end}`;
    })
    .replace(/<video\b([^>]*)>/gi, (match, attrs) => {
      let nextAttrs = String(attrs)
        .replace(/\scontrolsList=["'][^"']*["']/i, '')
        .replace(/\sdisablePictureInPicture(=["'][^"']*["'])?/i, '')
        .replace(/\sdisableRemotePlayback(=["'][^"']*["'])?/i, '');

      nextAttrs += ` controlsList="${restrictedVideoControlsList}" disablePictureInPicture disableRemotePlayback`;
      return `<video${nextAttrs}>`;
    });

export const sanitizeTourEmbedHtml = (
  html: string,
  transformSrc: (src: string) => string = (src) => src,
) => {
  if (typeof DOMParser === 'undefined') {
    return fallbackSanitizeTourEmbedHtml(html, transformSrc);
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('iframe').forEach((iframe) => {
    const src = iframe.getAttribute('src');
    if (src) {
      iframe.setAttribute('src', transformSrc(src));
    }

    const allow = iframe.getAttribute('allow');
    if (!allow) return;

    const sanitizedAllow = stripPictureInPictureAllow(allow);
    if (sanitizedAllow) {
      iframe.setAttribute('allow', sanitizedAllow);
    } else {
      iframe.removeAttribute('allow');
    }
  });

  doc.querySelectorAll('video').forEach(restrictVideoElement);

  return doc.body.innerHTML;
};
