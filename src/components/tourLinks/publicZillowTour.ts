/** Zillow's published walkthrough URLs can be used directly in an iframe. */
export function normalizePublicZillowTourUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
    if (url.hostname !== 'www.zillow.com' && url.hostname !== 'zillow.com') return '';
    if (!/^\/view-(?:imx|3d-home)\/[a-zA-Z0-9-]+\/?$/.test(url.pathname)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export type PublicZillowSources = { tourUrl: string; floorplanUrl: string };

export function preparePublicZillowFloorplanUrl(value: unknown): string {
  const normalized = normalizePublicZillowTourUrl(value);
  if (!normalized) return '';
  const url = new URL(normalized);
  if (!url.pathname.startsWith('/view-imx/')) return '';
  url.searchParams.set('initialViewType', 'floorplan');
  return url.toString();
}

const isUnbrandedZillowUrl = (value: string): boolean => {
  const params = new URL(value).searchParams;
  return params.getAll('setAttribution').length === 1 && params.getAll('wl').length === 1
    && !Array.from(params.keys()).some((key) => /^(setAttribution|wl)\[/.test(key))
    && params.get('setAttribution') === 'mls' && ['true', '1'].includes(params.get('wl') || '');
};

/** Respect the server's explicit viewer decision, with a fallback for older payloads. */
export function resolvePublicZillowSources(payload: unknown, variant: 'branded' | 'mls' | 'generic-mls'): PublicZillowSources {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const empty = { tourUrl: '', floorplanUrl: '' };
  if (data.locked === true || data.locked === 1 || data.locked === '1' || data.locked === 'true') return empty;
  const viewer = data.zillow_viewer && typeof data.zillow_viewer === 'object'
    ? data.zillow_viewer as Record<string, unknown> : {};
  const links = data.tour_links && typeof data.tour_links === 'object'
    ? data.tour_links as Record<string, unknown> : {};
  const hasViewer = Object.prototype.hasOwnProperty.call(data, 'zillow_viewer');
  const tourUrl = normalizePublicZillowTourUrl(hasViewer ? viewer.inline_url : links.zillow_3d);
  if (!tourUrl) return empty;
  if (variant !== 'branded' && !isUnbrandedZillowUrl(tourUrl)) return empty;
  const floorplanUrl = preparePublicZillowFloorplanUrl(hasViewer ? viewer.floorplan_url : tourUrl);
  if (floorplanUrl && (new URL(floorplanUrl).pathname !== new URL(tourUrl).pathname
    || (variant !== 'branded' && !isUnbrandedZillowUrl(floorplanUrl)))) return { tourUrl, floorplanUrl: '' };
  return { tourUrl, floorplanUrl };
}
