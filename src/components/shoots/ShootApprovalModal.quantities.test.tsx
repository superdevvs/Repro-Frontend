import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootApprovalModal } from './ShootApprovalModal';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
const photographers = [{ id: 9, name: 'QA Photographer' }];
const shoot = {
  id: 42, address: '42 Service Lane', timezone: 'UTC', scheduled_at: '2026-10-28T09:00:00Z', photographer_id: 9,
  services: [
    { id: 10, name: 'Photos', price: 200, quantity: 25, allow_multiple: true, pivot: { price: 100, quantity: 1 } },
    { id: 11, name: 'Floorplan', price: 80, allow_multiple: false, pivot: { quantity: 3 } },
  ],
  service_items: [
    { service_id: 10, shoot_service_id: 500, name: 'Photos', price: 150, quantity: 2, allow_multiple: true },
    { service_id: 11, shoot_service_id: 501, name: 'Floorplan', price: 80, quantity: 3, allow_multiple: false },
  ],
  baseQuote: 540, taxAmount: 54, tax_percent: 10, totalQuote: 594,
};
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (url: RequestInfo | URL) => ({
    ok: true, status: 200, json: async () => String(url).endsWith('/feasibility')
      ? { data: { enabled: false, status: 'available', available: true, reason_codes: [], transitions: [], visits: [], alternatives: [], can_override: false,
        can_confirm_location: false, policy_version: 'hybrid-travel-v1', schedule_version: null } }
      : String(url).includes('/api/shoots/') ? { data: shoot } : { data: [] },
  }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('actual shoot approval service quantities', () => {
  it('changes opted-in quantities using booked prices, updates taxes, and preserves disabled service counts in approval', async () => {
    const approved = vi.fn();
    render(<ShootApprovalModal isOpen shootId={42} photographers={photographers} onClose={vi.fn()} onApproved={approved} />);
    await screen.findByRole('button', { name: 'Increase Photos quantity' });
    expect(screen.getByLabelText('Photos quantity')).toHaveTextContent('2');
    expect(screen.getByText('Floorplan × 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Increase Floorplan quantity' })).not.toBeInTheDocument();
    expect(screen.getByText('$594.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Increase Photos quantity' }));
    expect(screen.getByLabelText('Photos quantity')).toHaveTextContent('3');
    expect(screen.getByText('$759.00')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve Shoot' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Approve Shoot' }));
    await waitFor(() => expect(approved).toHaveBeenCalled());
    const request = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/42/approve'));
    const payload = JSON.parse(String(request?.[1]?.body));
    expect(payload.service_items).toEqual([
      expect.objectContaining({ service_id: 10, quantity: 3 }),
      expect.objectContaining({ service_id: 11, quantity: 3 }),
    ]);
    expect(payload.service_items[0]).not.toHaveProperty('price');
  });
});
