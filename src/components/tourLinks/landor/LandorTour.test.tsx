import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackLinkClick } from '@/lib/tourTracking';
import { normalizePublicTourData } from '../publicTourData';
import { LandorTour } from './LandorTour';

vi.mock('@/lib/tourTracking', () => ({ trackLinkClick: vi.fn(), trackShare: vi.fn(), trackMediaView: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const propertyPayload = {
  shoot: { id: 42, address: '123 Oak Street', city: 'Boston', state: 'MA', zip: '02108',
    client_name: 'Avery Agent', client_company: 'Oak Realty', client_email: 'avery@example.test', client_phone: '+1 (617) 555-0123', client_avatar: 'https://media.test/agent.jpg' },
  branding: { logo: 'https://media.test/logo.svg', primary_color: '#176b46', show_map: true },
  photos: ['https://media.test/living.jpg'], hero_photos: ['https://media.test/exterior.jpg'],
  property_details: { bedrooms: 4, bathrooms: 2.5, sqft: 2500, garage_cars: 2, year_built: 2006,
    price: '1250000', description: 'A sun-filled home with a private garden.', property_type: 'single_family',
    listing_type: 'for_sale', property_status: 'available', lot_size: '0.3 acres', mls_id: 'BOS123' },
  show_garage: true,
  video_link: 'https://youtu.be/abcdefghijk',
  floorplans: [{ url: 'https://media.test/plan.pdf', preview_images: ['https://media.test/plan.jpg'], label: 'Main level' }],
  tour_links: { realtor_info: 'Available for private viewings.', embeds: [{ id: 'walkthrough', title: 'Interactive walkthrough', branded: 'https://tour.test/branded', mls: 'https://tour.test/unbranded' }] },
};

const valueFor = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;

describe('Landor property tour', () => {
  it('renders real property details, chosen hero photos, and the property floorplan', async () => {
    const user = userEvent.setup();
    render(<LandorTour data={normalizePublicTourData(propertyPayload, 'branded')} />);
    expect(screen.getByRole('heading', { name: '123 Oak Street', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(propertyPayload.property_details.description)).toBeInTheDocument();
    expect(valueFor('Bedrooms')).toHaveTextContent('4');
    expect(valueFor('Bathrooms')).toHaveTextContent('2.5');
    expect(valueFor('Interior area')).toHaveTextContent('2,500 sq ft');
    expect(valueFor('Year built')).toHaveTextContent('2006');
    expect(valueFor('Garage spaces')).toHaveTextContent('2');
    expect(valueFor('MLS number')).toHaveTextContent('BOS123');
    expect(valueFor('Lot size')).toHaveTextContent('0.3 acres');
    expect(valueFor('Property type')).toHaveTextContent('Single Family');
    expect(valueFor('Price')?.textContent?.replace(/,/g, '')).toBe('$1250000');
    expect(screen.getByAltText('123 Oak Street — property exterior')).toHaveAttribute('src', 'https://media.test/exterior.jpg');
    await user.click(screen.getByRole('tab', { name: 'Plans' }));
    expect(screen.getByAltText('Floor plan 1')).toHaveAttribute('src', 'https://media.test/plan.jpg');
  });

  it('updates property facts, address, hero photo, contacts, and garage visibility from new source data', () => {
    const { container, rerender } = render(<LandorTour data={normalizePublicTourData(propertyPayload, 'branded')} />);
    const updated = { ...propertyPayload,
      shoot: { ...propertyPayload.shoot, address: '987 Pine Avenue', client_email: 'updated@example.test' },
      hero_photos: ['https://media.test/updated-exterior.jpg'], show_garage: false,
      property_details: { ...propertyPayload.property_details, bedrooms: 0, bathrooms: 1, sqft: 900, price: 650000, description: 'Updated studio listing.' } };
    rerender(<LandorTour data={normalizePublicTourData(updated, 'branded')} />);
    expect(valueFor('Bedrooms')).toHaveTextContent('0');
    expect(valueFor('Interior area')).toHaveTextContent('900 sq ft');
    expect(valueFor('Price')?.textContent?.replace(/,/g, '')).toBe('$650000');
    expect(screen.queryByText('Garage spaces')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '987 Pine Avenue', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Updated studio listing.')).toBeInTheDocument();
    expect(screen.queryByText(propertyPayload.property_details.description)).not.toBeInTheDocument();
    expect(container.querySelector('img[src="https://media.test/exterior.jpg"]')).toBeNull();
    expect(screen.getByAltText('987 Pine Avenue — property exterior')).toHaveAttribute('src', updated.hero_photos[0]);
    expect(screen.getByRole('link', { name: 'Email contact' })).toHaveAttribute('href', 'mailto:updated@example.test?subject=Property%20inquiry%3A%20987%20Pine%20Avenue');
    expect(document.title).toBe('987 Pine Avenue | Property tour');
  });

  it.each(['mls', 'generic-mls'] as const)('excludes agent identity and contact actions from %s while showing its unbranded tour', async (variant) => {
    const user = userEvent.setup();
    const normalized = normalizePublicTourData(propertyPayload, variant);
    // Defense in depth: variants must remain unbranded even if private fields arrive upstream.
    const data = { ...normalized, shoot: { ...normalized.shoot!, ...propertyPayload.shoot },
      branding: normalizePublicTourData(propertyPayload, 'branded').branding,
      tourSettings: { ...normalized.tourSettings, realtor_info: 'Available for private viewings.' } };
    const { container } = render(<LandorTour data={data} />);
    expect(screen.queryByText('Avery Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Oak Realty')).not.toBeInTheDocument();
    expect(screen.queryByText('Available for private viewings.')).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="mailto:"], a[href^="tel:"], img[src="https://media.test/logo.svg"], img[src="https://media.test/agent.jpg"]')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Contact agent' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '3D tour' }));
    expect(screen.getByTitle('Interactive walkthrough')).toHaveAttribute('src', 'https://tour.test/unbranded');
    expect(container.innerHTML).not.toContain('https://tour.test/branded');
  });

  it('does not fabricate property statistics, amenities, photos, or unavailable media links', () => {
    const { container } = render(<LandorTour data={normalizePublicTourData({ shoot: { id: 42, address: '123 Oak Street' } }, 'branded')} />);
    for (const label of ['Bedrooms', 'Bathrooms', 'Interior area', 'Year built', 'Garage spaces', 'Property type', 'Price', 'MLS number']) {
      expect(screen.queryByText(label, { selector: 'dt' })).not.toBeInTheDocument();
    }
    expect(container.querySelector('img, video, iframe')).toBeNull();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Gallery & tours' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Explore the gallery' })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Under Construction|Office apartment|26,346|Swimming Pool|Landor media/);
  });

  it('connects real contact and map links, and closes mobile navigation after selecting a valid target', () => {
    render(<LandorTour data={normalizePublicTourData(propertyPayload, 'branded')} />);
    expect(screen.getByText('Avery Agent')).toBeInTheDocument();
    expect(screen.getByText('Available for private viewings.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email contact' })).toHaveAttribute('href', 'mailto:avery@example.test?subject=Property%20inquiry%3A%20123%20Oak%20Street');
    const phoneLinks = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('tel:'));
    expect(phoneLinks.length).toBeGreaterThan(0);
    for (const link of phoneLinks) expect(link).toHaveAttribute('href', 'tel:+16175550123');
    const map = screen.getByRole('link', { name: 'Open in Maps' });
    expect(new URL(map.getAttribute('href')!).searchParams.get('query')).toBe('123 Oak Street, Boston, MA, 02108');
    map.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(map);
    expect(trackLinkClick).toHaveBeenCalledWith(42, 'branded', 'map', map.getAttribute('href'));
    const navigation = screen.getByRole('navigation', { name: 'Property sections' });
    for (const link of within(navigation).getAllByRole('link')) expect(document.querySelector(link.getAttribute('href')!)).not.toBeNull();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(navigation).getByRole('link', { name: 'Overview' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows a locked state without exposing any supplied media or contact actions', () => {
    const { container } = render(<LandorTour data={normalizePublicTourData({ ...propertyPayload, locked: true, message: 'Awaiting payment.' }, 'branded')} />);
    expect(screen.getByRole('heading', { name: 'This tour is locked' })).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment.')).toBeInTheDocument();
    expect(container.querySelector('img, video, iframe, a, button')).toBeNull();
    expect(container.innerHTML).not.toContain('media.test');
    expect(container.innerHTML).not.toContain('tour.test');
    expect(container.innerHTML).not.toContain('avery@example.test');
  });
});
