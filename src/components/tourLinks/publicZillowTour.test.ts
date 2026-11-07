import { describe, expect, it } from 'vitest';
import { normalizePublicZillowTourUrl, preparePublicZillowFloorplanUrl, resolvePublicZillowSources } from './publicZillowTour';

describe('public Zillow walkthrough URLs', () => {
  it.each(['view-imx', 'view-3d-home'])('preserves the published %s URL and its viewing options', (path) => {
    const url = `https://www.zillow.com/${path}/9651242b-a1a2-4b06-80f9-0839b6fecd5a?setAttribution=mls&wl=true&initialViewType=pano`;
    expect(normalizePublicZillowTourUrl(` ${url} `)).toBe(url);
    expect(normalizePublicZillowTourUrl(url.replace('www.zillow.com', 'zillow.com'))).toContain('https://zillow.com/');
  });

  it.each([
    undefined, null, {}, '', 'javascript:alert(1)', '//www.zillow.com/view-imx/tour',
    'http://www.zillow.com/view-imx/tour', 'https://www.zillow.com.example.test/view-imx/tour',
    'https://www.zillow.com@evil.test/view-imx/tour', 'https://user:password@www.zillow.com/view-imx/tour',
    'https://www.zillow.com:8443/view-imx/tour', 'https://www.zillow.com/homedetails/123',
    'https://www.zillow.com/view-imx/', 'https://www.zillow.com/view-imx/tour/other',
  ])('rejects sources that are not a public Zillow walkthrough: %j', (value) => {
    expect(normalizePublicZillowTourUrl(value)).toBe('');
  });
});


describe('public Zillow floorplans', () => {
  const tourUrl = 'https://www.zillow.com/view-imx/example?wl=true&initialViewType=pano';
  const floorplanUrl = tourUrl.replace('pano', 'floorplan');

  it('keeps published viewing options and uses the floorplan view only for interactive models', () => {
    expect(preparePublicZillowFloorplanUrl(tourUrl)).toBe(floorplanUrl);
    expect(preparePublicZillowFloorplanUrl(tourUrl.replace('view-imx', 'view-3d-home'))).toBe('');
    expect(resolvePublicZillowSources({ tour_links: { zillow_3d: tourUrl } }, 'branded')).toEqual({ tourUrl, floorplanUrl });
  });

  it('honors explicit server restrictions and locks without using legacy fallback links', () => {
    const tour_links = { zillow_3d: tourUrl };
    expect(resolvePublicZillowSources({ tour_links, zillow_viewer: null }, 'branded')).toEqual({ tourUrl: '', floorplanUrl: '' });
    expect(resolvePublicZillowSources({ tour_links, locked: true }, 'branded')).toEqual({ tourUrl: '', floorplanUrl: '' });
    expect(resolvePublicZillowSources({ zillow_viewer: { inline_url: tourUrl, floorplan_url: null } }, 'branded')).toEqual({ tourUrl, floorplanUrl: '' });
  });

  it.each(['mls', 'generic-mls'] as const)('requires explicit unbranded viewing flags for %s', (variant) => {
    expect(resolvePublicZillowSources({ tour_links: { zillow_3d: tourUrl } }, variant)).toEqual({ tourUrl: '', floorplanUrl: '' });
    const unbranded = tourUrl + '&setAttribution=mls';
    expect(resolvePublicZillowSources({ tour_links: { zillow_3d: unbranded } }, variant).floorplanUrl).toContain('initialViewType=floorplan');
    expect(resolvePublicZillowSources({ tour_links: { zillow_3d: unbranded + '&setAttribution=branded' } }, variant)).toEqual({ tourUrl: '', floorplanUrl: '' });
    expect(resolvePublicZillowSources({ tour_links: { zillow_3d: unbranded + '&setAttribution[]=branded' } }, variant)).toEqual({ tourUrl: '', floorplanUrl: '' });
  });

  it('keeps a branded floorplan out of an otherwise unbranded viewer payload', () => {
    const unbranded = tourUrl + '&setAttribution=mls';
    expect(resolvePublicZillowSources({ zillow_viewer: { inline_url: unbranded, floorplan_url: floorplanUrl } }, 'mls')).toEqual({ tourUrl: unbranded, floorplanUrl: '' });
  });

  it('rejects a separate model masquerading as the same property floorplan', () => {
    expect(resolvePublicZillowSources({ zillow_viewer: { inline_url: tourUrl, floorplan_url: floorplanUrl.replace('example', 'another') } }, 'branded')).toEqual({ tourUrl, floorplanUrl: '' });
  });
});
