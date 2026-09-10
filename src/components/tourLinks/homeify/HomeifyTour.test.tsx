import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackLinkClick } from '@/lib/tourTracking';
import { normalizePublicTourData } from '../publicTourData';
import { HomeifyTour } from './HomeifyTour';

vi.mock('@/lib/tourTracking', () => ({ trackLinkClick: vi.fn(), trackShare: vi.fn(), trackMediaView: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const propertyPayload = {
  shoot: { id: 42, address: '123 Oak Street', city: 'Boston', state: 'MA', zip: '02108',
    client_name: 'Avery Agent', client_company: 'Oak Realty', client_email: 'avery@example.test', client_phone: '+1 (617) 555-0123', client_avatar: 'https://media.test/agent.jpg' },
  branding: { logo: 'https://media.test/logo.svg', primary_color: '#176b46' },
  photos: ['https://media.test/living.jpg'], hero_photos: ['https://media.test/exterior.jpg'],
  property_details: { bedrooms: 4, bathrooms: 2.5, sqft: 2500, garage_cars: 2, year_built: 2006,
    price: '1250000', description: 'A sun-filled home with a private garden.', property_type: 'single_family',
    listing_type: 'for_sale', property_status: 'available', lot_size: '0.3 acres', mls_id: 'BOS123' },
  show_garage: true,
  video_link: 'https://youtu.be/abcdefghijk',
  floorplans: [{ url: 'https://media.test/plan.pdf', preview_images: ['https://media.test/plan.jpg'], label: 'Main level' }],
  tour_links: { embeds: [{ id: 'walkthrough', title: 'Interactive walkthrough', branded: 'https://tour.test/branded', mls: 'https://tour.test/unbranded' }] },
};

describe('Homeify property tour', () => {
  it('renders the real property fields, selected hero media, and floorplan preview', () => {
    const { container } = render(<HomeifyTour data={normalizePublicTourData(propertyPayload, 'branded')} />);
    expect(screen.getByRole('heading', { name: '123 Oak Street', level: 1 })).toBeInTheDocument();
    expect(container.querySelector('.homeify-price')?.textContent?.replace(/,/g, '')).toBe('$1250000');
    expect(screen.getByText(propertyPayload.property_details.description)).toBeInTheDocument();
    expect(screen.getByText('0.3 acres')).toBeInTheDocument();
    expect(screen.getByText('BOS123')).toBeInTheDocument();
    expect(screen.getByAltText('123 Oak Street — photo 1')).toHaveAttribute('src', 'https://media.test/exterior.jpg');
    expect(screen.getByAltText('Floor plan 1')).toHaveAttribute('src', 'https://media.test/plan.jpg');
    const facts = container.querySelector('.homeify-stats');
    expect(facts).toHaveTextContent('4Bedrooms');
    expect(facts).toHaveTextContent('2.5Bathrooms');
    expect(facts).toHaveTextContent('2,500Square feet');
    expect(facts).toHaveTextContent('2006Year built');
    expect(facts).toHaveTextContent('2Garage spaces');
  });

  it.each(['mls', 'generic-mls'] as const)('keeps agent identity and logos out of the %s presentation', (variant) => {
    const { container } = render(<HomeifyTour data={normalizePublicTourData(propertyPayload, variant)} />);
    expect(screen.queryByText('Avery Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Oak Realty')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Contact agent' })).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="mailto:"], a[href^="tel:"], .homeify-logo, .homeify-contact')).toBeNull();
    expect(screen.getByTitle('Interactive walkthrough')).toHaveAttribute('src', 'https://tour.test/unbranded');
  });

  it('hides unavailable video, walkthrough, and floorplan sections and their navigation', () => {
    const data = normalizePublicTourData({ shoot: { id: 42, address: '123 Oak Street' }, floorplans: [{ url: 'https://media.test/plan.pdf' }] }, 'branded');
    const { container } = render(<HomeifyTour data={data} />);
    expect(container.querySelector('#video, #tour, #floorplan')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Video' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '3D tour' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Floor plans' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Photos' })).not.toBeInTheDocument();
  });

  it('updates the same property fields and garage visibility when the source data changes', () => {
    const { container, rerender } = render(<HomeifyTour data={normalizePublicTourData(propertyPayload, 'branded')} />);
    const updated = normalizePublicTourData({ ...propertyPayload, show_garage: false,
      property_details: { ...propertyPayload.property_details, bedrooms: 0, bathrooms: 1, sqft: 900, price: 650000, description: 'Updated studio listing.' } }, 'branded');
    rerender(<HomeifyTour data={updated} />);
    expect(container.querySelector('.homeify-stats')).toHaveTextContent('0Bedrooms');
    expect(container.querySelector('.homeify-stats')).toHaveTextContent('900Square feet');
    expect(screen.queryByText('Garage spaces')).not.toBeInTheDocument();
    expect(container.querySelector('.homeify-price')?.textContent?.replace(/,/g, '')).toBe('$650000');
    expect(screen.getByText('Updated studio listing.')).toBeInTheDocument();
  });

  it('connects contact, map, media, and mobile navigation links to the property', () => {
    render(<HomeifyTour data={normalizePublicTourData(propertyPayload, 'branded')} />);
    const phone = screen.getByRole('link', { name: '+1 (617) 555-0123' });
    expect(phone).toHaveAttribute('href', 'tel:+16175550123');
    expect(screen.getByRole('link', { name: 'Email contact' })).toHaveAttribute('href', 'mailto:avery@example.test?subject=Property%20inquiry%3A%20123%20Oak%20Street');
    const map = screen.getByRole('link', { name: 'Open in Maps' });
    expect(new URL(map.getAttribute('href')!).searchParams.get('query')).toBe('123 Oak Street, Boston, MA, 02108');
    map.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(map);
    expect(trackLinkClick).toHaveBeenCalledWith(42, 'branded', 'map', map.getAttribute('href'));
    const navigation = screen.getByRole('navigation', { name: 'Property sections' });
    for (const link of within(navigation).getAllByRole('link')) {
      expect(document.querySelector(link.getAttribute('href')!)).not.toBeNull();
    }
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(navigation).getByRole('link', { name: 'Overview' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the locked state without property media or contact actions', () => {
    const { container } = render(<HomeifyTour data={normalizePublicTourData({ ...propertyPayload, locked: true, message: 'Awaiting payment.' }, 'branded')} />);
    expect(screen.getByRole('heading', { name: 'This tour is locked' })).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment.')).toBeInTheDocument();
    expect(container.querySelector('video, iframe, .homeify-contact')).toBeNull();
  });
});
