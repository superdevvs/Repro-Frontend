import { describe, expect, it } from 'vitest';
import { resolvePublicTourStyle } from './publicTourStyle';

describe('resolvePublicTourStyle', () => {
  it.each(['default', 'neo', 'homeify', 'landor'] as const)('preserves saved %s without a valid preview', (style) => {
    expect(resolvePublicTourStyle(style, null)).toBe(style);
    expect(resolvePublicTourStyle(style, 'unrecognized')).toBe(style);
  });

  it.each(['homeify', 'landor'] as const)('lets the %s preview override every saved choice', (preview) => {
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
});
