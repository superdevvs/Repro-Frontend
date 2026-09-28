import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandedPage } from './BrandedPage';

vi.mock('@/lib/tourTracking', () => ({
  trackPageView: vi.fn(), trackMediaView: vi.fn(), trackLinkClick: vi.fn(), trackDownload: vi.fn(),
}));

const fetchMock = vi.fn();
const primary = 'https://media.example.test/primary.mp4';
const second = 'https://media.example.test/second.mp4';
const payload = {
  shoot: { id: 42, address: '42 Redwood Avenue', city: 'Austin', state: 'TX' },
  photos: ['https://media.example.test/property.jpg'],
  tour_style: 'default',
  historical_import: true,
  videos: [primary, second],
  video_link: primary,
  tour_links: { zillow_3d: 'https://www.zillow.com/view-3d-home/example' },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
  });
  window.history.replaceState({}, '', '/tour/branded?shootId=42');
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('historical branded tour media', () => {
  it('keeps the primary video once and exposes imported additional video and the Zillow link', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    const { container } = render(<BrandedPage />);
    expect(await screen.findByRole('heading', { name: 'Video Tour' })).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll('video')).map(video => video.getAttribute('src'))).toEqual([primary, second]);
    expect(screen.getByLabelText('Property video 1')).toHaveAttribute('src', second);
    expect(screen.getByRole('link', { name: 'Open Zillow 3D tour' })).toHaveAttribute('href', payload.tour_links.zillow_3d);
  });

  it('does not enable additional uploaded videos for ordinary tours or accept a lookalike Zillow host', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...payload, historical_import: false, tour_links: { zillow_3d: 'https://www.zillow.com.example.test/tour' } }) });
    const { container } = render(<BrandedPage />);
    expect(await screen.findByRole('heading', { name: 'Video Tour' })).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll('video')).map(video => video.getAttribute('src'))).toEqual([primary]);
    expect(screen.queryByRole('link', { name: 'Open Zillow 3D tour' })).not.toBeInTheDocument();
  });

  it('keeps the payment lock ahead of all imported videos and external tour links', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ...payload, locked: true, message: 'Payment is pending.' }) });
    const { container } = render(<BrandedPage />);
    expect(await screen.findByText('Tour Locked')).toBeInTheDocument();
    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Zillow 3D tour' })).not.toBeInTheDocument();
  });
});
