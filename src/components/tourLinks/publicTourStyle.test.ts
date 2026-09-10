import { describe, expect, it } from 'vitest';
import { isLandorTourStyle, resolvePublicTourPalette, resolvePublicTourStyle } from './publicTourStyle';
import { LANDOR_STYLE_IDS } from './landor/landorRegistry';

describe('resolvePublicTourStyle', () => {
  it.each(['default', 'neo', 'homeify', 'landor', ...LANDOR_STYLE_IDS.filter((id) => id !== 'landor')] as const)(
    'preserves saved %s without a valid preview',
    (style) => {
      expect(resolvePublicTourStyle(style, null)).toBe(style);
      expect(resolvePublicTourStyle(style, 'unrecognized')).toBe(style);
    },
  );

  it.each(['homeify', ...LANDOR_STYLE_IDS] as const)('lets the %s preview override every saved choice', (preview) => {
    for (const saved of ['default', 'neo', 'homeify', 'landor']) {
      expect(resolvePublicTourStyle(saved, preview)).toBe(preview);
    }
  });

  it.each([null, undefined, '', 'unknown', {}, 42])('falls back to Default for invalid saved style %s', (saved) => {
    expect(resolvePublicTourStyle(saved, null)).toBe('default');
  });

  it('only accepts the new layout names as preview overrides', () => {
    expect(resolvePublicTourStyle('landor', 'default')).toBe('landor');
    expect(resolvePublicTourStyle('homeify', 'neo')).toBe('homeify');
  });

  it('recognizes every Landor style id', () => {
    for (const id of LANDOR_STYLE_IDS) expect(isLandorTourStyle(id)).toBe(true);
    expect(isLandorTourStyle('homeify')).toBe(false);
  });
});

describe('resolvePublicTourPalette', () => {
  it.each(['repro', 'navy', 'charcoal', 'sand', 'emerald'] as const)('preserves saved %s', (palette) => {
    expect(resolvePublicTourPalette(palette, null)).toBe(palette);
  });

  it('lets preview override saved palette', () => {
    expect(resolvePublicTourPalette('repro', 'navy')).toBe('navy');
  });

  it('falls back to RePro red', () => {
    expect(resolvePublicTourPalette('nope', 'also-nope')).toBe('repro');
  });
});
