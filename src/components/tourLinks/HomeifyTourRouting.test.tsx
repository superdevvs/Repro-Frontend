import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandedPage } from './BrandedPage';
import { MlsCompliant } from './MlsCompliant';
import { GenericMLS } from './GenericMLS';
import type { PublicTourData } from './publicTourData';

vi.mock('./homeify/HomeifyTour', () => ({
  HomeifyTour: ({ data }: { data: PublicTourData }) => (
    <div data-testid="homeify-tour" data-variant={data.variant}>
      {data.stats.beds} bedrooms
    </div>
  ),
}));

vi.mock('./landor/LandorTour', () => ({
  LandorTour: ({ data }: { data: PublicTourData }) => (
    <div data-testid="landor-tour" data-variant={data.variant}>
      {data.stats.beds} bedrooms
    </div>
  ),
}));

vi.mock('./NeoTour', () => ({ NeoTour: () => <div data-testid="neo-tour">Neo tour</div> }));
vi.mock('@/lib/tourTracking', () => ({
  trackPageView: vi.fn(),
  trackMediaView: vi.fn(),
  trackLinkClick: vi.fn(),
  trackDownload: vi.fn(),
}));

const fetchMock = vi.fn();
const layouts = ['homeify', 'landor'] as const;
const payload = {
  shoot: { id: 42, address: '42 Redwood Avenue', city: 'Austin', state: 'TX' },
  photos: ['https://example.test/property.jpg'],
  property_details: { bedrooms: 4 },
};

const respond = (data: unknown, ok = true) => {
  fetchMock.mockResolvedValue({ ok, json: async () => data });
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
  fetchMock.mockReset();
  window.history.replaceState({}, '', '/?shootId=42');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each([
  { Component: BrandedPage, variant: 'branded', endpoint: 'branded' },
  { Component: MlsCompliant, variant: 'mls', endpoint: 'mls' },
  { Component: GenericMLS, variant: 'generic-mls', endpoint: 'g-mls' },
])('Public tour layout routing for $variant', ({ Component, variant, endpoint }) => {
  it.each(layouts)('renders saved %s from the existing request and normalizes its variant', async (layout) => {
    respond({ ...payload, tour_style: layout });

    render(<Component />);

    const tour = await screen.findByTestId(`${layout}-tour`);
    expect(tour).toHaveAttribute('data-variant', variant);
    expect(tour).toHaveTextContent('4 bedrooms');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/42/${endpoint}?t=`));
  });

  it.each(layouts)('accepts saved %s inside tour_links', async (layout) => {
    respond({ ...payload, tour_links: { tour_style: layout } });

    render(<Component />);

    expect(await screen.findByTestId(`${layout}-tour`)).toBeInTheDocument();
  });

  it.each(layouts)('previews %s over saved Neo without saving or fetching again', async (layout) => {
    window.history.replaceState({}, '', `/?shootId=42&layout=${layout}`);
    respond({ ...payload, tour_style: 'neo' });

    render(<Component />);

    expect(await screen.findByTestId(`${layout}-tour`)).toBeInTheDocument();
    expect(screen.queryByTestId('neo-tour')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['homeify', 'landor'],
    ['landor', 'homeify'],
  ])('previews %s over saved %s', async (preview, saved) => {
    window.history.replaceState({}, '', `/?shootId=42&layout=${preview}`);
    respond({ ...payload, tour_style: saved });

    render(<Component />);

    expect(await screen.findByTestId(`${preview}-tour`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${saved}-tour`)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(layouts)('ignores unknown preview values while preserving saved %s', async (layout) => {
    window.history.replaceState({}, '', '/?shootId=42&layout=unrecognized');
    respond({ ...payload, tour_style: layout });

    render(<Component />);

    expect(await screen.findByTestId(`${layout}-tour`)).toBeInTheDocument();
  });

  it('leaves Default selected for an unknown preview layout', async () => {
    window.history.replaceState({}, '', '/?shootId=42&layout=unrecognized');
    respond({ ...payload, tour_style: 'default' });

    render(<Component />);

    expect(await screen.findByRole('heading', { name: 'Gallery' })).toBeInTheDocument();
    expect(screen.queryByTestId('homeify-tour')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landor-tour')).not.toBeInTheDocument();
    expect(screen.queryByTestId('neo-tour')).not.toBeInTheDocument();
  });

  it('preserves the saved Neo layout without a preview override', async () => {
    respond({ ...payload, tour_style: 'neo' });

    render(<Component />);

    expect(await screen.findByTestId('neo-tour')).toBeInTheDocument();
    expect(screen.queryByTestId('homeify-tour')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landor-tour')).not.toBeInTheDocument();
  });

  it.each(layouts)('keeps the loading state until the %s request resolves', (layout) => {
    window.history.replaceState({}, '', `/?shootId=42&layout=${layout}`);
    fetchMock.mockReturnValue(new Promise(() => undefined));

    render(<Component />);

    expect(screen.getByText('Loading property tour...')).toBeInTheDocument();
    expect(screen.queryByTestId(`${layout}-tour`)).not.toBeInTheDocument();
  });

  it.each(layouts)('keeps the payment lock ahead of saved or previewed %s', async (layout) => {
    window.history.replaceState({}, '', `/?shootId=42&layout=${layout}`);
    respond({ ...payload, tour_style: layout, locked: true, message: 'Payment is pending.' }, false);

    render(<Component />);

    expect(await screen.findByText('Tour Locked')).toBeInTheDocument();
    expect(screen.getByText('Payment is pending.')).toBeInTheDocument();
    expect(screen.queryByTestId(`${layout}-tour`)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(layouts)('does not treat a failed HTTP response as successful %s', async (layout) => {
    window.history.replaceState({}, '', `/?shootId=42&layout=${layout}`);
    respond({ ...payload, tour_style: layout }, false);

    render(<Component />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Tour unavailable');
    expect(screen.queryByTestId(`${layout}-tour`)).not.toBeInTheDocument();
  });

  it.each(layouts)('shows an unavailable state after a %s network failure', async (layout) => {
    window.history.replaceState({}, '', `/?shootId=42&layout=${layout}`);
    fetchMock.mockRejectedValue(new Error('Network unavailable'));

    render(<Component />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Tour unavailable');
    expect(screen.queryByTestId(`${layout}-tour`)).not.toBeInTheDocument();
  });

  it.each(layouts)('does not fetch or display %s without a property identifier', async (layout) => {
    window.history.replaceState({}, '', `/?layout=${layout}`);

    render(<Component />);

    expect(await screen.findByRole('alert')).toHaveTextContent('This property tour could not be found.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId(`${layout}-tour`)).not.toBeInTheDocument();
  });
});
