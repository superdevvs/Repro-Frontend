import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandedPage } from './BrandedPage';
import { MlsCompliant } from './MlsCompliant';
import { GenericMLS } from './GenericMLS';
import { LandorMedia } from './landor/LandorMedia';
import { HomeifyMedia } from './homeify/HomeifyMedia';
import { normalizePublicTourData } from './publicTourData';
import { NeoTour } from './NeoTour';

vi.mock('@/lib/tourTracking', () => ({ trackPageView: vi.fn(), trackMediaView: vi.fn(), trackLinkClick: vi.fn(), trackDownload: vi.fn() }));
const url = 'https://www.zillow.com/view-imx/f2b5a984-31f1-4eb5-8db4-32c85a5f994d?setAttribution=mls&wl=true&initialViewType=pano';
const payload = { shoot: { id: 5884, address: '911 McDaniel Court' }, photos: [], floorplans: [], tour_style: 'default', tour_links: { zillow_3d: url } };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
  vi.stubGlobal('IntersectionObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Zillow floorplan routing', () => {
  it.each([['branded', BrandedPage], ['mls', MlsCompliant], ['g-mls', GenericMLS]] as const)('shows validated tour and floorplan sections on %s', async (variant, Page) => {
    window.history.replaceState({}, '', `/tour/${variant}?shootId=5884`);
    render(<Page />);
    expect(await screen.findByTitle('Zillow 3D tour')).toHaveAttribute('src', url);
    expect(screen.getByRole('link', { name: 'Floor Plans' })).toHaveAttribute('href', '#floorplan');
    expect(screen.getByTitle('Zillow interactive floor plan')).toHaveAttribute('src', url.replace('pano', 'floorplan'));
    expect(document.querySelector('a[href*="zillow.com"]')).toBeNull();
  });

  it('preserves the initial Landor walkthrough and exposes its floorplan tab', () => {
    render(<LandorMedia data={normalizePublicTourData(payload, 'mls')} />);
    expect(screen.getByRole('tab', { name: '3D tour' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTitle('Zillow 3D tour')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Plans' }), { button: 0, ctrlKey: false });
    expect(screen.getByTitle('Zillow interactive floor plan')).toBeInTheDocument();
    expect(screen.queryByTitle('Zillow 3D tour')).not.toBeInTheDocument();
  });

  it('supports the Homeify floorplan fallback', () => {
    render(<HomeifyMedia data={normalizePublicTourData(payload, 'mls')} />);
    expect(screen.getByTitle('Zillow 3D tour')).toBeInTheDocument();
    expect(screen.getByTitle('Zillow interactive floor plan')).toBeInTheDocument();
  });

  it('exposes the floorplan through the existing Neo section navigation', async () => {
    window.history.replaceState({}, '', '/tour/branded?shootId=5884');
    render(<NeoTour initialData={payload} />);
    expect(await screen.findByTitle('Zillow 3D tour')).toBeInTheDocument();
    expect(screen.getByTitle('Zillow interactive floor plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Floor Plans' })).toBeInTheDocument();
  });
});
