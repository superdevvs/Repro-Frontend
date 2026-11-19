import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackLinkClick } from '@/lib/tourTracking';
import { normalizePublicTourData, type PublicTourData } from './publicTourData';
import { formatTourPrice } from './tourDisplayUtils';
import { OfenTour } from './ofen/OfenTour';
import { MaisonTour } from './maison/MaisonTour';

vi.mock('@/lib/tourTracking', () => ({ trackLinkClick: vi.fn(), trackShare: vi.fn(), trackMediaView: vi.fn() }));

beforeEach(() => {
  // Render every lazily-mounted viewer immediately so its frame can be asserted.
  vi.stubGlobal('IntersectionObserver', undefined);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

const fullPayload = {
  shoot: { id: 42, address: '123 Oak Street', city: 'Boston', state: 'MA', zip: '02108',
    client_name: 'Avery Agent', client_company: 'Oak Realty', client_email: 'avery@example.test', client_phone: '+1 (617) 555-0123', client_avatar: 'https://media.test/agent.jpg' },
  branding: { logo: 'https://media.test/logo.svg', primary_color: '#176b46', show_map: true },
  photos: ['https://media.test/living.jpg', 'https://media.test/kitchen.jpg', 'https://media.test/bedroom.jpg'],
  hero_photos: ['https://media.test/exterior.jpg'],
  property_details: { bedrooms: 4, bathrooms: 2.5, sqft: 2500, garage_cars: 2, year_built: 2006,
    price: '1250000', description: 'A sun-filled home with a private garden.', property_type: 'single_family',
    listing_type: 'for_sale', property_status: 'available', lot_size: '0.3 acres', mls_id: 'BOS123' },
  show_garage: true,
  video_link: 'https://youtu.be/abcdefghijk',
  matterport_url: 'https://my.matterport.com/show/?m=abc123',
  floorplans: [{ url: 'https://media.test/plan.pdf', preview_images: ['https://media.test/plan.jpg'], label: 'Main level' }],
  tour_links: { realtor_info: 'Available for private viewings.', embeds: [{ id: 'walkthrough', title: 'Interactive walkthrough', branded: 'https://tour.test/branded', mls: 'https://tour.test/unbranded' }] },
};

type Theme = { name: string; Component: ComponentType<{ data: PublicTourData }>; rootClass: string; demoText: RegExp };
const themes: Theme[] = [
  { name: 'Ofen', Component: OfenTour, rootClass: 'ofen-tour', demoText: /Chestnut|Brookline|Boolii|Ofen|Unsplash|Lummi|Schedule a viewing|Mortgage/i },
  { name: 'Maison', Component: MaisonTour, rootClass: 'maison-tour', demoText: /Maison|WebCodingPlace|Lorem|Belgravia|Mortgage|Request a viewing/i },
];

const valueFor = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;

describe.each(themes)('$name property tour', ({ Component, rootClass, demoText }) => {
  it('renders the real property, every published media type and the agent block', async () => {
    const user = userEvent.setup();
    const { container } = render(<Component data={normalizePublicTourData(fullPayload, 'branded')} />);
    expect(container.firstElementChild).toHaveClass(rootClass);
    expect(screen.getByRole('heading', { name: '123 Oak Street', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(fullPayload.property_details.description)).toBeInTheDocument();
    expect(valueFor('Bedrooms')).toHaveTextContent('4');
    expect(valueFor('Bathrooms')).toHaveTextContent('2.5');
    expect(valueFor('Interior area')).toHaveTextContent('2,500 sq ft');
    expect(valueFor('Year built')).toHaveTextContent('2006');
    expect(valueFor('Garage spaces')).toHaveTextContent('2');
    expect(valueFor('MLS number')).toHaveTextContent('BOS123');
    expect(valueFor('Property type')).toHaveTextContent('Single Family');
    expect(screen.getAllByText(formatTourPrice('1250000')).length).toBeGreaterThan(0);
    expect(screen.getByAltText('123 Oak Street — main photo')).toHaveAttribute('src', 'https://media.test/exterior.jpg');

    expect(screen.getByTitle('Property video 1')).toHaveAttribute('src', expect.stringContaining('youtube-nocookie.com/embed/abcdefghijk'));
    expect(screen.getByTitle('Matterport 3D tour')).toHaveAttribute('src', expect.stringContaining('my.matterport.com/show'));
    expect(screen.getByTitle('Interactive walkthrough')).toHaveAttribute('src', 'https://tour.test/branded');
    expect(screen.getByAltText('Floor plan 1')).toHaveAttribute('src', 'https://media.test/plan.jpg');

    expect(screen.getByText('Avery Agent')).toBeInTheDocument();
    expect(screen.getByText('Available for private viewings.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Email contact/ })).toHaveAttribute('href', 'mailto:avery@example.test?subject=Property%20inquiry%3A%20123%20Oak%20Street');
    expect(container.querySelector('img[src="https://media.test/logo.svg"]')).not.toBeNull();
    for (const link of container.querySelectorAll('a[href^="tel:"]')) expect(link).toHaveAttribute('href', 'tel:+16175550123');

    await user.click(screen.getAllByRole('button', { name: 'Open photo 2 of 4' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img')).toHaveAttribute('alt', '123 Oak Street — photo 2 of 4');
    await user.click(within(dialog).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog).getByText('Photo 3 of 4')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(demoText);
  });

  it('hides every section without data and never shows placeholder content', () => {
    const { container } = render(<Component data={normalizePublicTourData({ shoot: { id: 42, address: '123 Oak Street' } }, 'branded')} />);
    expect(screen.getByRole('heading', { name: '123 Oak Street', level: 1 })).toBeInTheDocument();
    for (const label of ['Bedrooms', 'Bathrooms', 'Interior area', 'Year built', 'Garage spaces', 'Property type', 'Price', 'MLS number']) {
      expect(screen.queryByText(label, { selector: 'dt' })).not.toBeInTheDocument();
    }
    expect(container.querySelector('img, video, iframe')).toBeNull();
    for (const id of ['gallery', 'video', 'tour', 'floorplans', 'contact']) expect(container.querySelector(`#${id}`)).toBeNull();
    const navigation = screen.getByRole('navigation', { name: 'Property sections' });
    expect(within(navigation).queryByRole('link', { name: /Photos|Video|3D|Floor plans|Agent/ })).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull();
    expect(container.textContent).not.toMatch(demoText);
  });

  it.each(['mls', 'generic-mls'] as const)('keeps the %s tour unbranded even if private fields arrive upstream', (variant) => {
    const normalized = normalizePublicTourData(fullPayload, variant);
    const data = { ...normalized, shoot: { ...normalized.shoot!, ...fullPayload.shoot },
      branding: normalizePublicTourData(fullPayload, 'branded').branding,
      tourSettings: { ...normalized.tourSettings, realtor_info: 'Available for private viewings.' } };
    const { container } = render(<Component data={data} />);
    expect(screen.queryByText('Avery Agent')).not.toBeInTheDocument();
    expect(screen.queryByText(/Oak Realty/)).not.toBeInTheDocument();
    expect(screen.queryByText('Available for private viewings.')).not.toBeInTheDocument();
    expect(container.querySelector('#contact')).toBeNull();
    expect(container.querySelector('a[href^="mailto:"], a[href^="tel:"], img[src="https://media.test/logo.svg"], img[src="https://media.test/agent.jpg"]')).toBeNull();
    expect(screen.getByTitle('Interactive walkthrough')).toHaveAttribute('src', 'https://tour.test/unbranded');
    expect(container.innerHTML).not.toContain('https://tour.test/branded');
  });

  it.each(['branded', 'mls', 'generic-mls'] as const)('leaves video and 3D tours switched off on %s out of the page', (variant) => {
    // The server answers a switched-off source with null; saved links must not bring it back.
    const hidden = { ...fullPayload, video_link: null, matterport_url: null, zillow_viewer: null, iguide_viewer: null,
      tour_links: { ...fullPayload.tour_links, embeds: [], video_branded: 'https://vimeo.com/1246542939', video_mls: 'https://vimeo.com/1246542939', video_generic: 'https://vimeo.com/1246542939',
        matterport_branded: 'https://my.matterport.com/show/?m=hidden', matterport_mls: 'https://my.matterport.com/show/?m=hidden', zillow_3d: 'https://www.zillow.com/view-imx/hidden?wl=true&setAttribution=mls' } };
    const { container } = render(<Component data={normalizePublicTourData(hidden, variant)} />);
    // Only the optional location map may remain.
    expect(container.querySelector('iframe:not([title^="Map of"]), video')).toBeNull();
    expect(container.querySelector('#video, #tour')).toBeNull();
    expect(container.innerHTML).not.toMatch(/vimeo|matterport|zillow/i);
    expect(screen.getAllByRole('button', { name: /Open photo 1 of/ }).length).toBeGreaterThan(0);
  });

  it('links navigation to sections that exist and tracks the map link', () => {
    render(<Component data={normalizePublicTourData(fullPayload, 'branded')} />);
    const navigation = screen.getByRole('navigation', { name: 'Property sections' });
    const links = within(navigation).getAllByRole('link');
    expect(links.length).toBeGreaterThan(3);
    for (const link of links) expect(document.querySelector(link.getAttribute('href')!)).not.toBeNull();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(links[0]);
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    const map = screen.getByRole('link', { name: /Open in Maps/ });
    expect(new URL(map.getAttribute('href')!).searchParams.get('query')).toBe('123 Oak Street, Boston, MA, 02108');
    map.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(map);
    expect(trackLinkClick).toHaveBeenCalledWith(42, 'branded', 'map', map.getAttribute('href'));
  });

  it('shows a locked state without exposing media or contact details', () => {
    const { container } = render(<Component data={normalizePublicTourData({ ...fullPayload, locked: true, message: 'Awaiting payment.' }, 'branded')} />);
    expect(screen.getByRole('heading', { name: 'This tour is locked' })).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment.')).toBeInTheDocument();
    expect(container.querySelector('img, video, iframe, a, button')).toBeNull();
    expect(container.innerHTML).not.toMatch(/media\.test|tour\.test|avery@example\.test/);
  });
});
