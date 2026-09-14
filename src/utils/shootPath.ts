import type { ShootData } from '@/types/shoots';

/**
 * Shoot detail URLs carry the property address so a link reads as a place:
 *
 *   /shoots/86/7319-golden-horseshoe-ct
 *
 * The id stays first and remains the only thing the route resolves on. Two
 * shoots at one address are routine (reshoots, twilight add-ons), so the address
 * is decoration for humans and search engines, never an identifier. A URL with
 * no slug or a stale one still works; the detail page rewrites it in place once
 * the shoot has loaded (see `shootPathNeedsCanonicalising`).
 */

const MAX_SLUG_LENGTH = 80;

type ShootLike = Pick<ShootData, 'id'> & {
  location?: Partial<ShootData['location']> | null;
  address?: string | null;
};

const slugify = (value: string): string => {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= MAX_SLUG_LENGTH) return slug;

  const cut = slug.slice(0, MAX_SLUG_LENGTH);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
};

/** The street address as a URL slug, or '' when the shoot has no usable address. */
export function resolveShootAddressSlug(shoot: ShootLike | null | undefined): string {
  if (!shoot) return '';

  const candidates = [shoot.location?.address, shoot.address, shoot.location?.fullAddress];
  for (const candidate of candidates) {
    const slug = typeof candidate === 'string' ? slugify(candidate) : '';
    if (slug) return slug;
  }

  return '';
}

const normaliseSearch = (search?: string) => (search ? (search.startsWith('?') ? search : `?${search}`) : '');
const normaliseHash = (hash?: string) => (hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '');

/**
 * The canonical in-app path for a shoot. Accepts a bare id for callers that only
 * have one; the detail page adds the address once it knows it.
 */
export function buildShootPath(
  shoot: ShootLike | string | number,
  options: { search?: string; hash?: string } = {},
): string {
  const id = typeof shoot === 'object' ? shoot.id : shoot;
  const slug = typeof shoot === 'object' ? resolveShootAddressSlug(shoot) : '';
  const base = `/shoots/${encodeURIComponent(String(id))}${slug ? `/${slug}` : ''}`;

  return `${base}${normaliseSearch(options.search)}${normaliseHash(options.hash)}`;
}

/** Whether the URL's slug segment should be rewritten to match the shoot's address. */
export function shootPathNeedsCanonicalising(shoot: ShootLike | null | undefined, currentSlug: string | undefined): boolean {
  const expected = resolveShootAddressSlug(shoot);
  if (!expected) return false;

  return (currentSlug ?? '') !== expected;
}
