import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import type { ShootDetailsOverviewTabProps } from '@/components/shoots/tabs/ShootDetailsOverviewTab';
import { apiClient } from '@/services/api';
import { ShootUnitScopeProvider } from './ShootUnitScope';
import { withShootUnitOverview } from './withShootUnitOverview';

vi.mock('@/services/api', () => ({ apiClient: { patch: vi.fn() } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

let fixtureId = 0;
const makeShoot = (): ShootData => ({
  id: `overview-unit-scope-${++fixtureId}`, units_revision: 7,
  location: { address: 'One shared address', city: 'Rockville', state: 'MD', zip: '20852', fullAddress: 'One shared address' },
  propertyDetails: { sqft: 4000, lockboxCode: 'building-code' },
  payment: { baseQuote: 300, taxRate: 0, taxAmount: 0, totalQuote: 300, totalPaid: 0 },
  services: ['HDR Photos', 'Floorplan'],
  units: [
    { id: 1, client_key: 'unit-one', label: '101', kind: 'unit', sqft: 900, beds: 1, baths: 1, access_notes: 'Use the north door' },
    { id: 2, client_key: 'unit-two', label: '102', kind: 'unit', sqft: 1200, beds: 2, baths: 2, access_notes: 'Collect key from concierge' },
  ],
  service_lines: [
    { id: '2', service_id: '2', shoot_service_id: '151', client_key: 'line-one', shoot_unit_id: 1, name: 'HDR Photos', price: 100 },
    { id: '3', service_id: '3', shoot_service_id: '152', client_key: 'line-two', shoot_unit_id: 2, name: 'Floorplan', price: 200 },
  ],
} as ShootData);

function OverviewProbe({ shoot, unitSelector, unitAccessNotes, onSave }: ShootDetailsOverviewTabProps) {
  return <section aria-label="Overview content">
    <div data-testid="location-slot">{unitSelector}</div>
    <output data-testid="selected-services">{shoot.services.join(', ')}</output>
    <output data-testid="selected-sqft">{String(shoot.propertyDetails?.sqft)}</output>
    <output data-testid="selected-access">{unitAccessNotes}</output>
    <output data-testid="shared-address">{shoot.location.address}</output>
    <output data-testid="shared-payment">{shoot.payment.totalQuote}</output>
    <button onClick={() => onSave?.({ propertyDetails: { sqft: 1500 } })}>Save selected dimensions</button>
  </section>;
}

const UnitOverview = withShootUnitOverview(OverviewProbe);
const makeProps = (shoot: ShootData, overrides: Partial<ShootDetailsOverviewTabProps> = {}): ShootDetailsOverviewTabProps => ({
  shoot, isAdmin: true, isRep: false, isPhotographer: false, isEditor: false, isClient: false,
  role: 'admin', onShootUpdate: vi.fn(), ...overrides,
});
const show = (props: ShootDetailsOverviewTabProps) => render(
  <ShootUnitScopeProvider shoot={props.shoot}><UnitOverview {...props} /></ShootUnitScopeProvider>,
);

beforeEach(() => { vi.mocked(apiClient.patch).mockReset(); });
afterEach(cleanup);

describe('overview unit scope integration', () => {
  it('embeds one selector and changes unit services, dimensions and access while retaining shared data', () => {
    const shoot = makeShoot();
    const before = JSON.stringify(shoot);
    const onSave = vi.fn();
    show(makeProps(shoot, { onSave }));

    expect(screen.getAllByLabelText('Selected unit')).toHaveLength(1);
    expect(screen.getByTestId('location-slot')).toContainElement(screen.getByLabelText('Selected unit'));
    expect(screen.getByLabelText('Selected unit')).toHaveClass('border-t');
    expect(screen.queryByLabelText('Property unit progress')).not.toBeInTheDocument();
    expect(screen.queryByText(/Whole property/)).not.toBeInTheDocument();
    expect(screen.getByTestId('selected-services')).toHaveTextContent('HDR Photos');
    expect(screen.getByTestId('selected-access')).toHaveTextContent('Use the north door');

    fireEvent.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.getByTestId('selected-services')).toHaveTextContent('Floorplan');
    expect(screen.getByTestId('selected-services')).not.toHaveTextContent('HDR Photos');
    expect(screen.getByTestId('selected-sqft')).toHaveTextContent('1200');
    expect(screen.getByTestId('selected-access')).toHaveTextContent('Collect key from concierge');
    expect(screen.getByTestId('shared-address')).toHaveTextContent('One shared address');
    expect(screen.getByTestId('shared-payment')).toHaveTextContent('300');

    fireEvent.click(screen.getByRole('button', { name: 'Save selected dimensions' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      expected_units_revision: 7,
      units: [expect.objectContaining({ id: 1, sqft: 900 }), expect.objectContaining({ id: 2, sqft: 1500 })],
    }));
    expect(JSON.stringify(shoot)).toBe(before);
  });

  it.each([
    [true, 'Manage units', 'Manage property units'],
    [false, 'View units', 'Property units'],
  ] as const)('opens the existing manager from the selector for admin=%s with matching edit permissions', (isAdmin, action, title) => {
    show(makeProps(makeShoot(), { isAdmin, isClient: !isAdmin, role: isAdmin ? 'admin' : 'client' }));
    expect(screen.queryByRole('button', { name: action })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change unit' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Select unit' })).getByRole('button', { name: action }));
    expect(screen.queryByRole('dialog', { name: 'Select unit' })).not.toBeInTheDocument();
    const manager = screen.getByRole('dialog', { name: title });
    expect(within(manager).getByText('101')).toBeInTheDocument();
    expect(within(manager).getByText('102')).toBeInTheDocument();
    expect(within(manager).queryAllByRole('button', { name: 'Edit' })).toHaveLength(isAdmin ? 2 : 0);
    expect(Boolean(within(manager).queryByRole('button', { name: 'Save all changes' }))).toBe(isAdmin);
    expect(Boolean(within(manager).queryByRole('button', { name: 'Add unit' }))).toBe(isAdmin);
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it.each(['isEditMode', 'isUnitSwitchDisabled'] as const)('locks embedded navigation when %s is true', flag => {
    show(makeProps(makeShoot(), { [flag]: true }));
    for (const name of ['Change unit', 'Previous unit', 'Next unit']) expect(screen.getByRole('button', { name })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.getByTestId('selected-services')).toHaveTextContent('HDR Photos');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('retains keyboard focus on unit navigation after the scoped overview remounts', async () => {
    const shoot = makeShoot();
    shoot.units = [...shoot.units!, { id: 3, client_key: 'unit-three', label: '103', kind: 'unit', sqft: 1500, beds: 3, baths: 2 }];
    show(makeProps(shoot));
    const next = screen.getByRole('button', { name: 'Next unit' });
    next.focus();
    fireEvent.click(next);
    expect(screen.getByTestId('selected-services')).toHaveTextContent('Floorplan');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next unit' })).toHaveFocus());
  });

  it('returns focus to Change unit after choosing a different unit from the dialog', async () => {
    show(makeProps(makeShoot()));
    const trigger = screen.getByRole('button', { name: 'Change unit' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /102/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('selected-services')).toHaveTextContent('Floorplan');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change unit' })).toHaveFocus());
  });

  it('keeps switching locked until the roster save and refresh finish', async () => {
    let finishSave!: () => void;
    let finishRefresh!: () => void;
    const refresh = new Promise<null>(resolve => { finishRefresh = () => resolve(null); });
    vi.mocked(apiClient.patch).mockImplementation(() => new Promise(resolve => { finishSave = () => resolve({ data: {} }); }));
    const props = makeProps(makeShoot(), { onShootUpdate: vi.fn(() => refresh) });
    show(props);
    fireEvent.click(screen.getByRole('button', { name: 'Change unit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage units' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save all changes' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change unit', hidden: true })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next unit', hidden: true })).toBeDisabled();
    expect(apiClient.patch).toHaveBeenCalledWith(`/shoots/${props.shoot.id}`, expect.objectContaining({ expected_units_revision: 7, units: expect.any(Array) }));
    await act(async () => finishSave());
    expect(props.onShootUpdate).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Change unit', hidden: true })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await act(async () => finishRefresh());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(props.onShootUpdate).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Change unit' })).toBeEnabled();
  });

  it('leaves a legacy single-property overview unscoped', () => {
    const shoot = { ...makeShoot(), units: [] };
    show(makeProps(shoot));
    expect(screen.queryByLabelText('Selected unit')).not.toBeInTheDocument();
    expect(screen.getByTestId('selected-services')).toHaveTextContent('HDR Photos, Floorplan');
    expect(screen.getByTestId('selected-sqft')).toHaveTextContent('4000');
    expect(screen.getByTestId('selected-access')).toBeEmptyDOMElement();
  });
});
