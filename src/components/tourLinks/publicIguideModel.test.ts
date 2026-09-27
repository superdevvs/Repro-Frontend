import { describe, expect, it } from 'vitest';
import {
  normalizePublicTourUrl,
  preparePublicIguideEmbedUrl,
  resolvePublicEmbedSources,
  resolvePublicIguideSources,
  resolvePublicTourVariantFromPath,
} from './publicIguideModel';

describe('resolvePublicIguideSources', () => {
  it('prefers the canonical nested viewer and keeps distinct inline/open URLs', () => {
    const sources = resolvePublicIguideSources({
      iguide_viewer: {
        source: 'uploaded_offline_package',
        inline_url: 'https://viewer.example.test/embed/signed',
        open_url: 'https://viewer.example.test/full/signed',
        expires_at: '2026-09-01T12:00:00Z',
      },
      iguide_tour_url: 'https://stale.example.test/tour',
    }, 'branded');

    expect(sources).toEqual({
      expiresAt: '2026-09-01T12:00:00Z',
      inlineUrl: 'https://viewer.example.test/embed/signed',
      openUrl: 'https://viewer.example.test/full/signed',
      source: 'uploaded_offline_package',
    });
  });

  it('fails closed when the canonical viewer contains an unsafe URL', () => {
    const sources = resolvePublicIguideSources({
      iguide_viewer: { inline_url: 'javascript:alert(1)' },
      iguide_tour_url: 'https://stale.example.test/tour',
    }, 'branded');

    expect(sources.inlineUrl).toBe('');
    expect(sources.openUrl).toBe('');
  });

  it.each(['mls', 'generic-mls'] as const)(
    'does not use branded legacy destinations for %s',
    (variant) => {
      const sources = resolvePublicIguideSources({
        tour_links: {
          iguide_branded: 'https://branded.example.test/tour',
          iGuide: 'https://branded.example.test/legacy',
        },
      }, variant);

      expect(sources.inlineUrl).toBe('');
    },
  );

  it('supports provider/manual URLs from a legacy branded response', () => {
    const sources = resolvePublicIguideSources({
      tour_links: { iguide_branded: 'https://iguide.example.test/manual-tour' },
    }, 'branded');

    expect(sources.inlineUrl).toBe('https://iguide.example.test/manual-tour');
    expect(sources.openUrl).toBe(sources.inlineUrl);
  });
});

describe('preparePublicIguideEmbedUrl', () => {
  it.each([
    'https://youriguide.com/embed/sample/?autostart=1&noinitanimation=1',
    'https://unbranded.youriguide.com/embed/sample/',
    'https://iguidephotos.com/embed/sample/',
    'https://unbranded.iguideradix.com/view-path/',
  ])('starts %s on the property tour with the floor plan minimized', (input) => {
    const url = new URL(preparePublicIguideEmbedUrl(input));
    expect(url.searchParams.get('page')).toBe('tour');
    expect(url.searchParams.get('minfp')).toBe('1');
    expect(url.searchParams.get('autostart')).toBe('1');
    expect(url.searchParams.has('noinitanimation')).toBe(false);
    expect(url.searchParams.has('autoplay')).toBe(false);
  });

  it('leaves non-iGUIDE viewers unchanged', () => {
    const input = 'https://matterport.example.test/show?autoplay=1';
    expect(preparePublicIguideEmbedUrl(input)).toBe(input);
  });
});

describe('public tour URL and embed safety', () => {
  it('distinguishes branded, MLS, and generic MLS routes', () => {
    expect(resolvePublicTourVariantFromPath('/tour/branded')).toBe('branded');
    expect(resolvePublicTourVariantFromPath('/tour/mls')).toBe('mls');
    expect(resolvePublicTourVariantFromPath('/tour/g-mls')).toBe('generic-mls');
  });

  it('accepts only HTTP(S) viewer URLs', () => {
    expect(normalizePublicTourUrl('https://example.test/tour')).toBe('https://example.test/tour');
    expect(normalizePublicTourUrl('http://example.test/tour')).toBe('http://example.test/tour');
    expect(normalizePublicTourUrl('javascript:alert(1)')).toBe('');
    expect(normalizePublicTourUrl('data:text/html,unsafe')).toBe('');
  });

  it.each(['mls', 'generic-mls'] as const)(
    'never falls back to a branded embed for %s',
    (variant) => {
      expect(resolvePublicEmbedSources({
        branded: '<iframe src="https://branded.example.test" />',
        branded_embed: 'https://branded.example.test/legacy',
        url: 'https://branded.example.test/fallback',
      }, variant)).toEqual({ branded: '', mls: '' });
    },
  );
});
