import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ShootData } from '@/types/shoots';
import { ShootDetailsSidebar } from './ShootDetailsSidebar';
import { transformShootFromApi } from '@/context/shootNormalization';

const mocks = vi.hoisted(() => ({ canMarkPaid: true }));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ can: () => mocks.canMarkPaid }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/messaging/ManualNotificationDialog', () => ({
  ManualNotificationDialog: ({ open }: { open: boolean }) => open ? <div>Manual notification form</div> : null,
}));

const fixture = {
  id: '156',
  status: 'delivered',
  scheduledDate: '2026-10-13',
  time: '10:00',
  timezone: 'America/New_York',
  location: { address: 'Sample property', city: 'Point of Rocks', state: 'MD', zip: '21777', fullAddress: 'Sample property' },
  client: { id: '7', name: 'Sample Client', email: 'sample@example.com', phone: '555-123-4567', company: 'Sample Company' },
  photographer: { id: '12', name: 'Primary Photographer' },
  services: ['HDR Photos', 'Aerial Photos', 'Unassigned Photos'],
  serviceObjects: [
    { id: '1', name: 'HDR Photos', price: 250, quantity: 1, category: { id: '1', name: 'Photos' }, photographer_id: '20', photographer: { id: '20', name: 'Photo Photographer' }, delivery_status: 'delivered' },
    { id: '2', name: 'Aerial Photos', price: 100, quantity: 1, category: { id: '1', name: 'Photos' }, photographer_id: '21', photographer: { id: '21', name: 'Aerial Photographer' }, delivery_status: 'ready', workflow_status: 'delivered' },
    { id: '3', name: 'Unassigned Photos', price: 75, quantity: 1, category: { id: '1', name: 'Photos' }, delivery_status: 'cancelled' },
  ],
  payment: { baseQuote: 425, taxRate: 0, taxAmount: 0, totalQuote: 425, totalPaid: 0 },
} as ShootData;

const show = (overrides: Partial<React.ComponentProps<typeof ShootDetailsSidebar>> = {}) => {
  const onMarkPaid = vi.fn();
  const onReschedule = vi.fn();
  render(<MemoryRouter><ShootDetailsSidebar shoot={fixture} isAdmin isSuperAdmin={false} onMarkPaid={onMarkPaid} onReschedule={onReschedule} {...overrides} /></MemoryRouter>);
  return { onMarkPaid, onReschedule };
};

beforeEach(() => { mocks.canMarkPaid = true; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('compact shoot record preserves allowed controls and contact privacy', () => {
  it('shows canonical-only normalized unit lines with their distinct assignees and unit labels', () => {
    const shoot = transformShootFromApi({
      id: 156,
      photographer: { id: 12, name: 'Primary Photographer' },
      units: [
        { id: 1, client_key: 'u1', label: 'Unit 101', kind: 'unit', sqft: 900, beds: 1, baths: 1 },
        { id: 2, client_key: 'u2', label: 'Lobby', kind: 'common_area', sqft: 200, beds: 0, baths: 0 },
      ],
      service_lines: [
        { shoot_service_id: 90, service_id: 5, shoot_unit_id: 1, name: 'Photos', price: 150, category: { id: '1', name: 'Photos' }, photographer_id: 20, photographer: { id: 20, name: 'Photo Photographer' } },
        { shoot_service_id: 91, service_id: 5, shoot_unit_id: 2, name: 'Photos', price: 80, unit_label: 'Lobby', category: { id: '1', name: 'Photos' }, photographer_id: 21, photographer: { id: 21, name: 'Aerial Photographer' } },
        { id: 'fee-1', name: 'Rush fee', source: 'invoice_adjustment', is_invoice_adjustment: true, price: 25 },
      ],
    });
    expect(shoot.serviceObjects ?? []).toHaveLength(0);
    show({ shoot });
    const services = screen.getByRole('region', { name: 'Services and team' });
    expect(within(services).getAllByText('Photos')).toHaveLength(2);
    expect(within(services).getByText('Unit 101')).toBeInTheDocument();
    expect(within(services).getByText('Lobby')).toBeInTheDocument();
    expect(within(services).getByText('Photo Photographer')).toBeInTheDocument();
    expect(within(services).getByText('Aerial Photographer')).toBeInTheDocument();
    expect(within(services).queryByText('Rush fee')).not.toBeInTheDocument();
    expect(within(services).queryByText('No services assigned')).not.toBeInTheDocument();
  });

  it('prefers canonical line identity over legacy objects that omit unit labels', () => {
    const canonicalLine = { ...fixture.serviceObjects![0], unit: { id: '1', label: 'Unit 202', kind: 'unit' as const, sqft: null, beds: null, baths: null } };
    show({ shoot: { ...fixture, serviceObjects: [fixture.serviceObjects![0]], serviceItems: [canonicalLine] } });
    expect(screen.getByText('Unit 202')).toBeInTheDocument();
  });

  it('supports unnormalized service_lines without borrowing a primary photographer', () => {
    const line = { ...fixture.serviceObjects![2], unit_label: 'Unit 303' };
    show({ shoot: { ...fixture, services: [], serviceObjects: [], serviceItems: undefined, service_items: undefined, service_lines: [line] } });
    expect(screen.getByText('Unassigned Photos')).toBeInTheDocument();
    expect(screen.getByText('Unit 303')).toBeInTheDocument();
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
    expect(screen.queryByText('Primary Photographer')).not.toBeInTheDocument();
  });

  it('shows each service assignee without borrowing the primary or a category assignee', () => {
    show();
    const services = screen.getByRole('region', { name: 'Services and team' });
    expect(within(services).getByText('Photo Photographer')).toBeInTheDocument();
    expect(within(services).getByText('Aerial Photographer')).toBeInTheDocument();
    expect(within(services).getByText('Not assigned')).toBeInTheDocument();
    expect(within(services).queryByText('Primary Photographer')).not.toBeInTheDocument();
    expect(within(services).getAllByLabelText('Delivered')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Change Photographer' })).toBeInTheDocument();
  });

  it('opens the existing reschedule, manual payment and notification controls', () => {
    const { onMarkPaid, onReschedule } = show();
    fireEvent.click(screen.getByText('Billing details'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Paid' }));
    expect(onMarkPaid).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));
    expect(onReschedule).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Additional actions'));
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('Manual notification form')).toBeInTheDocument();
  });

  it('keeps the manual payment permission authoritative', () => {
    mocks.canMarkPaid = false;
    show();
    fireEvent.click(screen.getByText('Billing details'));
    expect(screen.queryByRole('button', { name: 'Mark as Paid' })).not.toBeInTheDocument();
  });

  it('keeps editor client and billing information absent', () => {
    show({ isAdmin: false, isEditor: true, onReschedule: undefined });
    expect(screen.queryByText('Sample Client')).not.toBeInTheDocument();
    expect(screen.queryByText('sample@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Billing' })).not.toBeInTheDocument();
    expect(screen.queryByText('Additional actions')).not.toBeInTheDocument();
  });

  it('keeps editing manager notification access without billing access', () => {
    show({ isAdmin: false, isEditingManager: true, onReschedule: undefined });
    expect(screen.getByText('Sample Client')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Billing' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Additional actions'));
    expect(screen.getByRole('button', { name: 'Notify' })).toBeInTheDocument();
  });

  it('limits a photographer to the client name and scheduled contact window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T13:00:00Z'));
    show({ isAdmin: false, isPhotographer: true, onReschedule: undefined });
    expect(screen.getByText('Sample Client')).toBeInTheDocument();
    expect(screen.queryByText('sample@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('Sample Company')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Contact details'));
    expect(screen.getByText('555-123-4567')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Billing' })).not.toBeInTheDocument();
  });

  it('hides photographer contact after the contact window closes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T13:00:00Z'));
    show({ isAdmin: false, isPhotographer: true, onReschedule: undefined });
    expect(screen.queryByText('Contact details')).not.toBeInTheDocument();
    expect(screen.queryByText('555-123-4567')).not.toBeInTheDocument();
  });

  it('keeps representative contact access without adding administrative billing controls', () => {
    show({ isAdmin: false, onReschedule: undefined });
    fireEvent.click(screen.getByText('Contact details'));
    expect(screen.getByText('sample@example.com')).toBeInTheDocument();
    expect(screen.getByText('555-123-4567')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Billing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change Photographer' })).not.toBeInTheDocument();
  });
});
