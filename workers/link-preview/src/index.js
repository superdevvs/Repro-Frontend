/**
 * Injects share metadata into the real SPA document at the edge.
 *
 * Crawlers do not execute JavaScript, so the React app cannot supply its own
 * Open Graph tags. Rather than serving a different document to clients we guess
 * are crawlers - iMessage/LinkPresentation in particular looks like Safari -
 * every GET of a shareable route receives the same SPA HTML with a rewritten
 * head. Humans get an unchanged application; crawlers get real tags.
 *
 * Two rules drive the failure behaviour:
 *
 *  1. Unbranded routes are rewritten even when the API is unavailable. The
 *     static shell carries R/E Pro Photos branding, which must never appear on
 *     an MLS link, so a neutral tag set is substituted instead.
 *  2. The metadata subrequest is time-boxed. Delivering the app always wins
 *     over decorating it.
 */

const PATH_TYPES = new Map([
  ['/', 'dashboard'],
  ['/client-portal', 'portal'],
  ['/tour/branded', 'branded'],
  ['/tour/mls', 'mls'],
  ['/tour/g-mls', 'g-mls'],
  ['/tour/video/branded', 'video-branded'],
  ['/tour/video/mls', 'video-mls'],
  ['/tour/video/generic', 'video-generic'],
  ['/tour/3d/branded', '3d-branded'],
  ['/tour/3d/mls', '3d-mls'],
]);

const STATIC_TYPES = new Set(['dashboard', 'portal']);
const THREE_D_TYPES = new Set(['3d-branded', '3d-mls']);
const PROVIDERS = new Set(['matterport', 'iguide', 'zillow']);

// Must match config('link_preview.unbranded_types').
const UNBRANDED_TYPES = new Set(['mls', 'g-mls', 'video-mls', 'video-generic', '3d-mls']);

// The SPA must not wait on the API. A miss costs a generic card, not a page.
const METADATA_TIMEOUT_MS = 800;

const NEUTRAL_CARD_PATH = '/og-tour.jpg';
const BRANDED_CARD_PATH = '/og-image.jpg';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const removeElement = {
  element(element) {
    element.remove();
  },
};

const metadataTags = (metadata) => {
  const image = metadata.image || {};
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const url = escapeHtml(metadata.url);
  const imageUrl = escapeHtml(image.url);
  const imageAlt = escapeHtml(image.alt || metadata.title);
  const siteName = escapeHtml(metadata.site_name || metadata.title);

  return [
    `<meta name="description" content="${description}">`,
    `<link rel="canonical" href="${url}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${siteName}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${imageUrl}">`,
    `<meta property="og:image:secure_url" content="${imageUrl}">`,
    '<meta property="og:image:type" content="image/jpeg">',
    `<meta property="og:image:width" content="${Number(image.width) || 1200}">`,
    `<meta property="og:image:height" content="${Number(image.height) || 630}">`,
    `<meta property="og:image:alt" content="${imageAlt}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${imageUrl}">`,
    `<meta name="twitter:image:alt" content="${imageAlt}">`,
  ].join('');
};

/**
 * Tags used when the API cannot be reached. Unbranded types get a card and copy
 * that carry no photographer, agent or brokerage identity; the static shell's
 * branded tags would otherwise survive onto an MLS link.
 */
const fallbackMetadata = (type, shareUrl) => {
  const unbranded = UNBRANDED_TYPES.has(type);
  const cardUrl = new URL(unbranded ? NEUTRAL_CARD_PATH : BRANDED_CARD_PATH, shareUrl).toString();

  if (unbranded) {
    return {
      title: 'Property Tour',
      description: 'View the listing photos, floor plan, and media for this property.',
      site_name: 'Property Tour',
      url: shareUrl,
      image: { url: cardUrl, width: 1200, height: 630, alt: 'Property tour' },
    };
  }

  return {
    title: 'Property Tour | R/E Pro Photos',
    description: 'View the listing photos, floor plan, and media for this property.',
    site_name: 'R/E Pro Photos',
    url: shareUrl,
    image: { url: cardUrl, width: 1200, height: 630, alt: 'Property tour' },
  };
};

const isUsableMetadata = (metadata) => Boolean(
  metadata
  && typeof metadata.title === 'string' && metadata.title !== ''
  && typeof metadata.description === 'string' && metadata.description !== ''
  && typeof metadata.url === 'string' && metadata.url !== ''
  && metadata.image
  && typeof metadata.image.url === 'string' && metadata.image.url !== '',
);

export default {
  async fetch(request, env) {
    if (request.method !== 'GET') {
      return fetch(request);
    }

    const incomingUrl = new URL(request.url);
    const path = incomingUrl.pathname.replace(/\/$/, '') || '/';
    const type = PATH_TYPES.get(path);
    if (!type) {
      return fetch(request);
    }

    // Rebuild the canonical share URL from validated inputs only, so an
    // attacker-supplied query string cannot end up inside og:url.
    const shareUrl = new URL(path, incomingUrl.origin);
    const metadataUrl = new URL(`/api/public/link-previews/${encodeURIComponent(type)}`, env.API_ORIGIN);
    let inputsValid = true;

    if (!STATIC_TYPES.has(type)) {
      const shootId = incomingUrl.searchParams.get('shootId');
      if (shootId && /^[1-9][0-9]*$/.test(shootId)) {
        metadataUrl.searchParams.set('shootId', shootId);
        shareUrl.searchParams.set('shootId', shootId);
      } else {
        inputsValid = false;
      }
    }

    if (inputsValid && THREE_D_TYPES.has(type)) {
      const provider = incomingUrl.searchParams.get('provider');
      if (provider) {
        if (PROVIDERS.has(provider)) {
          metadataUrl.searchParams.set('provider', provider);
          shareUrl.searchParams.set('provider', provider);
        } else {
          inputsValid = false;
        }
      }
    }

    const originRequest = fetch(request);
    const metadataRequest = inputsValid
      ? fetch(metadataUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
        cf: { cacheEverything: true, cacheTtl: 60 },
      }).then((response) => (response.ok ? response.json() : null)).catch(() => null)
      : Promise.resolve(null);

    const [originResponse, resolved] = await Promise.all([originRequest, metadataRequest]);

    const contentType = (originResponse.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html')) {
      return originResponse;
    }

    let metadata = isUsableMetadata(resolved) ? resolved : null;
    if (!metadata) {
      // The static shell is already correct for the dashboard and portal, so
      // leave it alone. Every other route would otherwise inherit its branding.
      if (STATIC_TYPES.has(type)) {
        return originResponse;
      }
      metadata = fallbackMetadata(type, shareUrl.toString());
    }

    const headers = new Headers(originResponse.headers);
    // The body changes, so length, encoding and the origin validator no longer
    // describe it. The origin's own Cache-Control is preserved: overriding it
    // would let a rewritten shell outlive the hashed assets it references.
    headers.delete('Content-Length');
    headers.delete('Content-Encoding');
    headers.delete('ETag');
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    }

    const htmlResponse = new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    });

    return new HTMLRewriter()
      .on('title', {
        element(element) {
          element.setInnerContent(metadata.title);
        },
      })
      .on('meta[name="description"]', removeElement)
      .on('link[rel="canonical"]', removeElement)
      .on('meta[property^="og:"]', removeElement)
      .on('meta[name^="twitter:"]', removeElement)
      .on('head', {
        element(element) {
          element.prepend(metadataTags(metadata), { html: true });
        },
      })
      .transform(htmlResponse);
  },
};
