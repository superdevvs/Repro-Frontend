import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeifyGallery } from './homeify/HomeifyGallery';
import { LandorGallery } from './landor/LandorGallery';
import { NeoTour } from './NeoTour';

vi.mock('@/lib/tourTracking', () => ({ trackMediaView: vi.fn() }));
const photos = ['https://media.test/one-web.jpg', 'https://media.test/two-web.jpg'];
const photoRenditions = Object.fromEntries(photos.map((web, index) => [web, {
  web, thumbnail: `https://media.test/thumb-${index}.jpg`, grid: `https://media.test/grid-${index}.jpg`,
}]));
const props = { photos, photoRenditions, address: '1 Oak', tourType: 'branded' as const };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('public tour image loading', () => {
  it('prioritizes the Homeify hero and uses small strip images without changing lightbox quality', () => {
    const { container } = render(<HomeifyGallery {...props} />);
    const hero = container.querySelector('.homeify-hero-image');
    expect(hero?.getAttribute('src')).toBe(photos[0]);
    expect(hero?.getAttribute('fetchpriority')).toBe('high');
    expect(Array.from(container.querySelectorAll('.homeify-thumb img')).map(img => img.getAttribute('src')))
      .toEqual(['https://media.test/thumb-0.jpg', 'https://media.test/thumb-1.jpg']);
    fireEvent.click(screen.getByRole('button', { name: 'See All 2 Photos' }));
    expect(document.querySelector('.homeify-lightbox-image')?.getAttribute('src')).toBe(photos[0]);
  });

  it('uses grid images for both Landor gallery layouts and full web images in the viewer', () => {
    const { container } = render(<LandorGallery {...props} />);
    expect(Array.from(container.querySelectorAll('.landor-gallery-card img')).map(img => img.getAttribute('src')))
      .toEqual(['https://media.test/grid-0.jpg', 'https://media.test/grid-1.jpg']);
    expect(Array.from(container.querySelectorAll('.landor-masonry-card img')).map(img => img.getAttribute('src')))
      .toEqual(['https://media.test/grid-0.jpg', 'https://media.test/grid-1.jpg']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Open photo 2 of 2' })[0]);
    expect(document.querySelector('.landor-lightbox-image')?.getAttribute('src')).toBe(photos[1]);
  });

  it('reuses the already-authorized parent payload when rendering Neo instead of fetching the tour twice', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('IntersectionObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
    window.history.replaceState({}, '', '/tour/branded?address=1+Oak&city=Austin&state=TX&unitId=3');
    render(<NeoTour initialData={{ shoot: { id: 1, address: '1 Oak' }, photos, tour_links: {} }} />);
    expect(await screen.findByAltText('Hero Property')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
