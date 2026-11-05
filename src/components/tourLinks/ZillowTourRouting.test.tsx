import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NeoTour } from './NeoTour';
import { Public3dRedirect } from './Public3dRedirect';

const zillowUrl = 'https://www.zillow.com/view-imx/example?wl=true&initialViewType=pano';
const payload = { shoot: { id: 42, address: '42 Redwood Avenue' }, tour_links: { zillow_3d: zillowUrl } };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
  });
  window.history.replaceState({}, '', '/tour/branded?shootId=42');
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('public Zillow tour routing', () => {
  it('embeds Zillow on the Neo branded layout from the already authorized payload', async () => {
    const { container } = render(<NeoTour initialData={payload} />);
    expect(await screen.findByTitle('Zillow 3D tour')).toHaveAttribute('src', zillowUrl);
    expect(container.querySelector('a[href*="zillow.com"]')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['/tour/mls', '/tour/g-mls'])('keeps the branded Zillow source out of Neo on %s', async (path) => {
    window.history.replaceState({}, '', `${path}?shootId=42`);
    render(<NeoTour initialData={payload} />);
    await screen.findByText('42 Redwood Avenue');
    expect(screen.queryByTitle('Zillow 3D tour')).not.toBeInTheDocument();
  });

  it('keeps direct Zillow walkthrough URLs inside the property tour wrapper', async () => {
    window.history.replaceState({}, '', '/tour/3d/branded?shootId=42&unitId=7&provider=zillow');
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    const { container } = render(<Public3dRedirect variant="branded" />);
    expect(await screen.findByTitle('Zillow 3D tour')).toHaveAttribute('src', zillowUrl);
    expect(window.location.pathname).toBe('/tour/3d/branded');
    expect(screen.getByRole('link', { name: 'View the full property tour' })).toHaveAttribute('href', '/tour/branded?shootId=42&unitId=7');
    expect(container.querySelector('a[href*="zillow.com"]')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/42/branded?unitId=7'), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it.each([{ variant: 'mls' as const, locked: false }, { variant: 'branded' as const, locked: true }])('does not embed a disallowed Zillow destination: %j', async ({ variant, locked }) => {
    window.history.replaceState({}, '', `/tour/3d/${variant}?shootId=42&provider=zillow`);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...payload, locked }) });
    render(<Public3dRedirect variant={variant} />);
    expect(await screen.findByText('The 3D walkthrough is not available yet.')).toBeInTheDocument();
    expect(screen.queryByTitle('Zillow 3D tour')).not.toBeInTheDocument();
  });
});
