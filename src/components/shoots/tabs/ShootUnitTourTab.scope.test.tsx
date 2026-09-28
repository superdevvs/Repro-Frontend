import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import type { ShootDetailsTourTabProps } from './ShootDetailsTourTab';
import { ShootUnitScopeProvider } from '@/features/shoot-units/ShootUnitScope';
import { ShootDetailsTourTab } from './ShootUnitTourTab';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('./ShootDetailsTourTab', () => ({
  ShootDetailsTourContent: ({ shoot, unitId, iguideLineId, isClientReleaseLocked }: ShootDetailsTourTabProps) => <div data-testid="tour-content">
    <output data-testid="tour-unit">{unitId ?? 'building'}</output>
    <output data-testid="tour-services">{shoot.services.join(', ')}</output>
    <output data-testid="tour-provider-line">{iguideLineId}</output>
    <output data-testid="tour-description">{String(shoot.tourLinks?.property_description ?? '')}</output>
    <output data-testid="tour-release-locked">{String(isClientReleaseLocked)}</output>
  </div>,
}));

let fixtureId = 0;
const makeShoot = (count = 2): ShootData => ({
  id: `tour-scope-${++fixtureId}`, services: ['Building services'],
  scheduledDate: '2026-09-28', time: '09:00', status: 'delivered',
  client: { name: 'Test client', email: 'client@example.test', totalShoots: 1 },
  photographer: { name: 'Test photographer' },
  location: { address: '1 Test Street', city: 'Rockville', state: 'MD', zip: '20852', fullAddress: '1 Test Street, Rockville, MD 20852' },
  payment: { baseQuote: 200, taxRate: 0, taxAmount: 0, totalQuote: 200, totalPaid: 200 },
  tourLinks: { property_description: 'Building description must not leak into units' },
  units: Array.from({ length: count }, (_, i) => ({
    id: i + 1, client_key: `unit-${i + 1}`, label: `Unit ${String(i + 1).padStart(3, '0')}`,
    kind: 'unit', sqft: 900 + i, beds: 1, baths: 1, ready_service_count: 1,
    tour_links: { property_description: `Description for unit ${i + 1}` }, include_common_area_media: false,
  })),
  service_lines: Array.from({ length: count }, (_, i) => ({
    id: '2', service_id: '2', shoot_service_id: String(1001 + i), shoot_unit_id: i + 1,
    name: `iGuide Floorplan ${i + 1}`, price: 200, quantity: 1,
  })),
});

const show = (props: ShootDetailsTourTabProps) => render(
  <ShootUnitScopeProvider shoot={props.shoot}><ShootDetailsTourTab {...props} /></ShootUnitScopeProvider>,
);
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('embedded Tours unit selector', () => {
  it('searches all 100 units through a bounded selector and projects only the selected unit and provider line', () => {
    const shoot = makeShoot(100);
    const before = JSON.stringify(shoot);
    show({ shoot, isAdmin: true, onShootUpdate: vi.fn() });
    expect(screen.getAllByLabelText('Selected unit')).toHaveLength(1);
    expect(screen.getByLabelText('Tour unit')).toContainElement(screen.getByLabelText('Selected unit'));
    expect(screen.getByTestId('tour-unit')).toHaveTextContent(/^1$/);
    fireEvent.click(screen.getByRole('button', { name: 'Change unit' }));
    expect(document.querySelectorAll('button[aria-pressed]')).toHaveLength(8);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search units' }), { target: { value: '100' } });
    expect(document.querySelectorAll('button[aria-pressed]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Unit 100/ }));
    expect(screen.getByTestId('tour-unit')).toHaveTextContent(/^100$/);
    expect(screen.getByTestId('tour-provider-line')).toHaveTextContent(/^1100$/);
    expect(screen.getByTestId('tour-services')).toHaveTextContent(/^iGuide Floorplan 100$/);
    expect(screen.getByTestId('tour-description')).toHaveTextContent('Description for unit 100');
    expect(screen.queryByText('Building description must not leak into units')).not.toBeInTheDocument();
    expect(JSON.stringify(shoot)).toBe(before);
  });

  it('lets a client leave a pending unit for its released sibling while withholding pending controls and content', () => {
    const shoot = makeShoot();
    shoot.units![0].ready_service_count = 0;
    show({ shoot, isAdmin: false, isClient: true, isClientReleaseLocked: true, onShootUpdate: vi.fn() });
    expect(screen.getByText('Unit 001 tour is not released yet')).toBeInTheDocument();
    expect(screen.queryByTestId('tour-content')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Include common-area/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Theme and realtor settings/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.queryByText('Unit 001 tour is not released yet')).not.toBeInTheDocument();
    expect(screen.getByTestId('tour-unit')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('tour-release-locked')).toHaveTextContent('false');
    expect(screen.getByRole('checkbox', { name: /Include common-area/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous unit' }));
    expect(screen.queryByTestId('tour-content')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change unit' })).toBeEnabled();
  });

  it('locks the selector during inflight uploads', () => {
    show({ shoot: makeShoot(), isAdmin: true, isUnitSwitchDisabled: true, onShootUpdate: vi.fn() });
    expect(screen.getByRole('button', { name: 'Change unit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next unit' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.getByTestId('tour-unit')).toHaveTextContent(/^1$/);
  });

  it('locks switching until the original unit option PATCH and refresh finish', async () => {
    let finishPatch!: (response: Response) => void;
    let finishRefresh!: () => void;
    const refreshed = new Promise<void>(resolve => { finishRefresh = resolve; });
    const request = vi.fn(() => new Promise<Response>(resolve => { finishPatch = resolve; }));
    vi.stubGlobal('fetch', request);
    const shoot = makeShoot();
    const onShootUpdate = vi.fn(() => refreshed);
    show({ shoot, isAdmin: true, onShootUpdate });
    fireEvent.click(screen.getByRole('checkbox', { name: /Include common-area/ }));
    expect(request).toHaveBeenCalledWith(expect.stringContaining(`/shoots/${shoot.id}/units/1/tour`), expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ include_common_area_media: true }),
    }));
    expect(screen.getByRole('button', { name: 'Change unit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next unit' })).toBeDisabled();
    await act(async () => finishPatch(Response.json({ data: {} })));
    expect(onShootUpdate).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Next unit' })).toBeDisabled();
    await act(async () => finishRefresh());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next unit' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.getByTestId('tour-unit')).toHaveTextContent(/^2$/);
    expect(screen.getByRole('checkbox', { name: /Include common-area/ })).not.toBeChecked();
    expect(request).toHaveBeenCalledOnce();
  });

  it('renders a single-property tour without a selector', () => {
    const shoot = { ...makeShoot(), units: [] };
    show({ shoot, isAdmin: true, onShootUpdate: vi.fn() });
    expect(screen.queryByLabelText('Selected unit')).not.toBeInTheDocument();
    expect(screen.getByTestId('tour-unit')).toHaveTextContent('building');
    expect(screen.getByTestId('tour-services')).toHaveTextContent('Building services');
  });
});
