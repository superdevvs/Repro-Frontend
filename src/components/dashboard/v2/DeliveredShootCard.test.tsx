import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import { DeliveredShootCard } from './DeliveredShootCard';

afterEach(cleanup);
const shoot = (overrides: Partial<DashboardShootSummary> = {}): DashboardShootSummary => ({
  id: 5930,
  addressLine: '6539 Annapolis Road',
  clientName: 'Moyo Akinbola Planitar Inc.',
  scheduledLocalDate: '2026-11-04',
  timeLabel: '10:00 AM',
  paymentStatus: 'unpaid',
  services: [{ label: 'Premium iGuide with Floor plans', type: 'service_19' }],
  heroImage: null,
  previewImages: [],
  ...overrides,
} as DashboardShootSummary);

describe('delivered card photo and Spotlight behavior', () => {
  it('uses the selected layout for a delivery without photos, preserving details and selection', () => {
    const onSelect = vi.fn();
    const { container } = render(<DeliveredShootCard shoot={shoot()} showPaymentStatus onSelect={onSelect} />);
    expect(container.querySelector('[data-delivery-spotlight]')).not.toBeNull();
    expect(screen.getByText('iGUIDE')).toBeTruthy();
    expect(screen.getByText('Floor plan')).toBeTruthy();
    expect(screen.getByText('2 services')).toBeTruthy();
    expect(screen.getByText('Unpaid')).toBeTruthy();
    expect(screen.getByText(/Nov 4/)).toBeTruthy();
    fireEvent.click(screen.getByText('6539 Annapolis Road'));
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('always keeps a suitable photo thumbnail even when the shoot includes tours', () => {
    const { container } = render(<DeliveredShootCard shoot={shoot({ heroImage: 'https://cdn.test/exterior.jpg' })} showPaymentStatus />);
    expect(screen.getByAltText('6539 Annapolis Road').getAttribute('src')).toBe('https://cdn.test/exterior.jpg');
    expect(container.querySelector('[data-delivery-spotlight]')).toBeNull();
  });

  it('ignores placeholder/floor-plan heroes and uses a real preview when available', () => {
    const { container, rerender } = render(<DeliveredShootCard shoot={shoot({ heroImage: '/no-image-placeholder.svg' })} showPaymentStatus={false} />);
    expect(container.querySelector('[data-delivery-spotlight]')).not.toBeNull();
    rerender(<DeliveredShootCard shoot={shoot({ heroImage: 'https://cdn.test/floorplans/layout.jpg', previewImages: ['https://cdn.test/exterior.jpg'] })} showPaymentStatus={false} />);
    expect(screen.getByAltText('6539 Annapolis Road').getAttribute('src')).toBe('https://cdn.test/exterior.jpg');
    expect(container.querySelector('[data-delivery-spotlight]')).toBeNull();
  });

  it('tries the next photograph after a failed image, then falls back only when all fail', () => {
    const { container, rerender } = render(<DeliveredShootCard shoot={shoot({ heroImage: 'https://cdn.test/first.jpg', previewImages: ['https://cdn.test/second.jpg'] })} showPaymentStatus={false} />);
    fireEvent.error(screen.getByAltText('6539 Annapolis Road'));
    expect(screen.getByAltText('6539 Annapolis Road').getAttribute('src')).toBe('https://cdn.test/second.jpg');
    fireEvent.error(screen.getByAltText('6539 Annapolis Road'));
    expect(container.querySelector('[data-delivery-spotlight]')).not.toBeNull();
    rerender(<DeliveredShootCard shoot={shoot({ heroImage: 'https://cdn.test/new.jpg' })} showPaymentStatus={false} />);
    expect(screen.getByAltText('6539 Annapolis Road').getAttribute('src')).toBe('https://cdn.test/new.jpg');
  });

  it('shows a single floor-plan illustration without introducing a tour', () => {
    const { container } = render(<DeliveredShootCard shoot={shoot({ heroImage: 'https://cdn.test/floorplans/plan.jpg', services: [{ label: '2D Floor plans', type: 'service_17' }] })} showPaymentStatus={false} />);
    expect(screen.queryByText('iGUIDE')).toBeNull();
    expect(screen.getByText('1 service')).toBeTruthy();
    expect(container.querySelectorAll('.delivery-spotlight__illustration')).toHaveLength(1);
    expect(container.querySelector('.delivery-spotlight__illustration')?.getAttribute('src')).toContain('/floorplan.webp');
  });

  it('shows +N more for large packages and neutral artwork for unknown services', () => {
    const { container, rerender } = render(<DeliveredShootCard shoot={shoot({ services: [{ label: 'HDR Photos, Video & Matterport + Floor plans', type: 'service_55' }] })} showPaymentStatus={false} />);
    expect(screen.getByText('4 services')).toBeTruthy();
    expect(screen.getByText('+2 more')).toBeTruthy();
    expect(container.querySelectorAll('.delivery-spotlight__illustration')).toHaveLength(2);
    rerender(<DeliveredShootCard shoot={shoot({ services: [{ label: 'Property measurements', type: 'custom' }] })} showPaymentStatus={false} />);
    expect(screen.getByText('Property measurements')).toBeTruthy();
    expect(container.querySelector('.delivery-spotlight__illustration')?.getAttribute('src')).toContain('/media.webp');
  });
});
