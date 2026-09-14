import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { buildShootPath, resolveShootAddressSlug, shootPathNeedsCanonicalising } from './shootPath';

const shootWith = (location: Partial<ShootData['location']>, id: string | number = 86): ShootData =>
  ({ id, location: { address: '', city: '', state: '', zip: '', fullAddress: '', ...location } } as unknown as ShootData);

describe('resolveShootAddressSlug', () => {
  it('slugifies the street address', () => {
    expect(resolveShootAddressSlug(shootWith({ address: '7319 Golden Horseshoe Ct' }))).toBe('7319-golden-horseshoe-ct');
  });

  it('strips punctuation, unit markers and accents without leaving stray dashes', () => {
    expect(resolveShootAddressSlug(shootWith({ address: ' 11700 Old Georgetown Rd. #4B, Unit (Rear) ' })))
      .toBe('11700-old-georgetown-rd-4b-unit-rear');
    expect(resolveShootAddressSlug(shootWith({ address: 'Château Élan Dr' }))).toBe('chateau-elan-dr');
  });

  it('falls back to the full address, then to nothing', () => {
    expect(resolveShootAddressSlug(shootWith({ fullAddress: '9137 Lakeland Valley Ct, Springfield, VA 22153' })))
      .toBe('9137-lakeland-valley-ct-springfield-va-22153');
    expect(resolveShootAddressSlug(shootWith({}))).toBe('');
    expect(resolveShootAddressSlug(null)).toBe('');
  });

  it('keeps very long addresses to a bounded length on a word boundary', () => {
    const slug = resolveShootAddressSlug(shootWith({ address: 'A'.repeat(20) + ' ' + 'B'.repeat(70) + ' ' + 'C'.repeat(30) }));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('buildShootPath', () => {
  it('puts the id first and the address after it', () => {
    expect(buildShootPath(shootWith({ address: '7319 Golden Horseshoe Ct' }))).toBe('/shoots/86/7319-golden-horseshoe-ct');
  });

  it('is plain /shoots/:id when no address is known or only an id is given', () => {
    expect(buildShootPath(shootWith({}))).toBe('/shoots/86');
    expect(buildShootPath(42)).toBe('/shoots/42');
    expect(buildShootPath('42')).toBe('/shoots/42');
  });

  it('carries a query string and hash through untouched', () => {
    expect(buildShootPath(shootWith({ address: '7319 Golden Horseshoe Ct' }), { search: '?action=pay', hash: '#workflow' }))
      .toBe('/shoots/86/7319-golden-horseshoe-ct?action=pay#workflow');
    expect(buildShootPath(42, { hash: 'requests' })).toBe('/shoots/42#requests');
  });
});

describe('shootPathNeedsCanonicalising', () => {
  const shoot = shootWith({ address: '7319 Golden Horseshoe Ct' });

  it('wants the slug added when the URL has none', () => {
    expect(shootPathNeedsCanonicalising(shoot, undefined)).toBe(true);
  });

  it('wants a stale slug replaced after the address changed', () => {
    expect(shootPathNeedsCanonicalising(shoot, '7319-golden-horseshoe-court')).toBe(true);
  });

  it('leaves a correct URL alone, and a slugless shoot alone', () => {
    expect(shootPathNeedsCanonicalising(shoot, '7319-golden-horseshoe-ct')).toBe(false);
    expect(shootPathNeedsCanonicalising(shootWith({}), undefined)).toBe(false);
  });
});
