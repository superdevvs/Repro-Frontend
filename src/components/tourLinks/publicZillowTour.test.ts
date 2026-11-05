import { describe, expect, it } from 'vitest';
import { normalizePublicZillowTourUrl } from './publicZillowTour';

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
