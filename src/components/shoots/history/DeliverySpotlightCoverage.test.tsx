import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ShootData } from '@/types/shoots';
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext';
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils';
import { CompletedAlbumCard } from './CompletedAlbumCard';
import { CompletedShootListRow } from './CompletedShootListRow';
import { ClientDeliveredGridCard } from '@/features/dashboard/components/ClientDeliveredGridCard';
import { ClientShootTile } from '@/features/dashboard/components/ClientShootTile';

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://reprodashboard.com' }));
afterEach(cleanup);

const shoot = {
  id: '5930', status: 'delivered', workflowStatus: 'delivered',
  scheduledDate: '2026-11-04', completedDate: '2026-11-04', time: '10:00:00',
  location: { address: '6539 Annapolis Road', city: 'Landover Hills', state: 'MD', zip: '20784' },
  client: { name: 'Example Client' }, photographer: { name: 'Example Photographer' },
  services: ['Premium iGuide with Floor plans'], files: [],
  payment: { totalQuote: 800, totalPaid: 0, paymentStatus: 'unpaid' },
} as ShootData;
const exterior = 'https://reprodashboard.com/photos/exterior.jpg';
const alternate = 'https://reprodashboard.com/photos/interior.jpg';

describe('service covers across Shoot History roles and layouts', () => {
  it.each(['admin', 'client'] as const)('uses the approved fallback in %s grid and list views', viewerRole => {
    const onSelect = vi.fn();
    const onInvoice = vi.fn();
    const { container } = render(<UserPreferencesProvider>
      <CompletedAlbumCard shoot={shoot} onSelect={onSelect} viewerRole={viewerRole} isClient={viewerRole === 'client'} onViewInvoice={onInvoice} />
      <CompletedShootListRow shoot={shoot} onSelect={onSelect} viewerRole={viewerRole} isClient={viewerRole === 'client'} />
    </UserPreferencesProvider>);
    const covers = container.querySelectorAll('[data-delivery-spotlight]');
    expect(covers).toHaveLength(3); // Grid plus the mobile and desktop list thumbnails.
    covers.forEach(cover => expect(cover).toHaveAttribute('aria-label', 'iGUIDE + Floor plan'));
    expect(container.querySelector('img[src*="placeholder"]')).toBeNull();
    fireEvent.click(screen.getByTitle('View Invoice'));
    expect(onInvoice).toHaveBeenCalledWith(shoot);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('[data-shoot-id="5930"]')!);
    expect(onSelect).toHaveBeenCalledWith(shoot);
  });

  it.each([CompletedAlbumCard, CompletedShootListRow])('retains real photos, retries another preview, then uses services on load failure', Component => {
    const withPhotos = { ...shoot, heroImage: exterior, previewImages: [alternate] };
    const { container } = render(<UserPreferencesProvider><Component shoot={withPhotos} onSelect={vi.fn()} /></UserPreferencesProvider>);
    expect(container.querySelector('[data-delivery-spotlight]')).toBeNull();
    expect(screen.getAllByAltText(shoot.location.address)[0]).toHaveAttribute('src', exterior);
    fireEvent.error(screen.getAllByAltText(shoot.location.address)[0]);
    expect(screen.getAllByAltText(shoot.location.address)[0]).toHaveAttribute('src', alternate);
    fireEvent.error(screen.getAllByAltText(shoot.location.address)[0]);
    expect(container.querySelector('[data-delivery-spotlight]')).toHaveAttribute('aria-label', 'iGUIDE + Floor plan');
  });
});

describe('client dashboard delivery grid and list', () => {
  const renderClient = (layout: 'grid' | 'list', data: ShootData) => {
    const record = { data, summary: shootDataToSummary(data) };
    const onSelect = vi.fn();
    const props = { record, onSelect, onDownload: vi.fn(), onReschedule: vi.fn(), onCancel: vi.fn(), onContactSupport: vi.fn(), onRebook: vi.fn(), onRequestRevision: vi.fn(), onHoldAction: vi.fn(), onPayment: vi.fn() };
    const result = render(<UserPreferencesProvider>{layout === 'grid'
      ? <ClientDeliveredGridCard {...props} />
      : <ClientShootTile {...props} variant="completed" />}</UserPreferencesProvider>);
    return { ...result, record, onSelect };
  };
  it.each(['grid', 'list'] as const)('shows services and preserves opening the shoot in client %s', layout => {
    const { container, record, onSelect } = renderClient(layout, shoot);
    expect(container.querySelector('[data-delivery-spotlight]')).toHaveAttribute('aria-label', 'iGUIDE + Floor plan');
    fireEvent.click(container.querySelector('[data-shoot-id="5930"]')!);
    expect(onSelect).toHaveBeenCalledWith(record);
    if (layout === 'list') {
      expect(screen.getByRole('button', { name: /Pay \$800/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Downloads' })).not.toBeInTheDocument();
    }
  });
  it.each(['grid', 'list'] as const)('keeps a client %s photo and recovers to a service cover if it breaks', layout => {
    const { container } = renderClient(layout, { ...shoot, heroImage: exterior });
    expect(screen.getByAltText(shoot.location.address)).toHaveAttribute('src', exterior);
    expect(container.querySelector('[data-delivery-spotlight]')).toBeNull();
    fireEvent.error(screen.getByAltText(shoot.location.address));
    expect(container.querySelector('[data-delivery-spotlight]')).toHaveAttribute('aria-label', 'iGUIDE + Floor plan');
  });
  it('uses the booked service when a client shoot has only a floorplan preview', () => {
    const { container } = renderClient('grid', { ...shoot, services: ['2D Floor plans'], heroImage: 'https://reprodashboard.com/floorplans/plan.jpg' });
    expect(container.querySelector('[data-delivery-spotlight]')).toHaveAttribute('aria-label', 'Floor plan');
    expect(container.querySelector('img[src*="tour.webp"]')).toBeNull();
  });
});
