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
