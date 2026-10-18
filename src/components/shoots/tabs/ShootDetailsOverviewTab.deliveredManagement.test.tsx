import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootDetailsOverviewTab } from './ShootDetailsOverviewTab';

const auth = vi.hoisted(() => ({ user: { id: '9', role: 'salesRep', secondary_roles: [] as string[] } }));
vi.mock('@/components/auth', () => ({ useAuth: () => auth }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/features/shoot-units/withShootUnitOverview', () => ({ withShootUnitOverview: (component: unknown) => component }));
vi.mock('@/features/shoot-units/useShootUnitScope', () => ({ useShootUnitScope: () => ({ unit: null, isMultiUnit: false }) }));
vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));
vi.mock('@/hooks/useShootFiles', () => ({ useShootFiles: () => ({ data: [] }) }));
vi.mock('@/hooks/useEditorRates', () => ({ useEditorRates: () => ({ rates: [] }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/UserPreferencesContext', () => ({ useUserPreferences: () => ({
  formatTemperature: String, formatTime: String, formatDate: String,
}) }));
vi.mock('./overview/shootOverviewEditorSupport', async (importOriginal) => ({
  ...await importOriginal<typeof import('./overview/shootOverviewEditorSupport')>(),
  useOverviewLookupData: vi.fn(), usePhotographerAssignmentOptions: vi.fn(), usePhotographerDistanceAvailability: vi.fn(),
}));
vi.mock('./overview/OverviewPropertyLocationSection', () => ({ OverviewPropertyLocationSection: ({ isEditMode, propertyMetrics }: { isEditMode: boolean; propertyMetrics: { label: string; value: string }[] }) => <><input aria-label="Property edit" readOnly={!isEditMode} /><output aria-label="Property metrics">{propertyMetrics.map(metric => metric.label).join(', ')}</output></> }));
vi.mock('./overview/OverviewAccessSection', () => ({ OverviewAccessSection: () => null, OverviewAccessDescription: () => null }));
vi.mock('./overview/OverviewClientSection', () => ({ OverviewClientSection: ({ isEditMode }: { isEditMode: boolean }) => <input aria-label="Client edit" readOnly={!isEditMode} /> }));
vi.mock('./overview/OverviewPaymentSummarySection', () => ({ OverviewPaymentSummarySection: ({ isEditMode }: { isEditMode: boolean }) => <input aria-label="Price edit" readOnly={!isEditMode} /> }));
vi.mock('./overview/OverviewPhotographerPickerDialog', () => ({ OverviewPhotographerPickerDialog: ({ open }: { open: boolean }) => open ? <div>Photographer picker</div> : null }));
vi.mock('@/features/travel/TravelFeasibilityPanel', () => ({ TravelFeasibilityPanel: () => <div>Travel controls</div> }));
vi.mock('@/components/payments/StripePaymentDialog', () => ({ StripePaymentDialog: () => null }));
vi.mock('./overview/MediaLinksSection', () => ({ MediaLinksSection: () => null }));
vi.mock('./overview/OverviewVideoEmbedsSection', () => ({ OverviewVideoEmbedsSection: () => null }));
vi.mock('@/features/complimentary-reshoots/CompReshootOverviewStrip', () => ({ CompReshootOverviewStrip: () => null }));

const shoot = {
  id: '42', status: 'delivered', workflowStatus: 'delivered', scheduledDate: '2026-09-01', time: '10:00',
  location: { address: '42 Service Lane', city: 'Baltimore', state: 'MD', zip: '21201' },
  services: [], serviceItems: [{ service_id: 10, name: 'Photography', price: 100, quantity: 1,
    duration_minutes: 60, scheduled_at: '2026-09-01T10:00:00', category: 'Photos' }],
  payment: { totalQuote: 100, totalPaid: 0 }, canManageBooking: true, propertyDetails: { year_built: 2026 },
} as unknown as ShootData;

function mount(role: string, status = 'delivered', secondaryRoles: string[] = [], workflowStatus = status) {
  auth.user = { ...auth.user, role, secondary_roles: secondaryRoles };
  return render(<MemoryRouter><ShootDetailsOverviewTab shoot={{ ...shoot, status, workflowStatus }}
    role={role} isAdmin={['admin', 'superadmin', 'editing_manager'].includes(role)} isRep
    isPhotographer={false} isEditor={false} isClient={false} isEditMode onShootUpdate={vi.fn()} />
  </MemoryRouter>);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
    enabled: false, status: 'available', available: true, reason_codes: [], transitions: [], alternatives: [],
    can_override: false, policy_version: '1', schedule_version: '1',
  } }))));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('delivered sales rep overview edit scope', () => {
  it('limits read-only property metrics to beds, baths, and square footage', () => {
    render(<MemoryRouter><ShootDetailsOverviewTab shoot={shoot} role="salesRep" isAdmin={false} isRep
      isPhotographer={false} isEditor={false} isClient={false} isEditMode={false} onShootUpdate={vi.fn()} />
    </MemoryRouter>);
    expect(screen.getByLabelText('Property metrics')).toHaveTextContent(/^Beds, Baths, Sqft$/);
    expect(screen.getByLabelText('Property edit')).toHaveAttribute('readonly');
  });

  it.each(['delivered', 'delivered_to_client', 'ready_for_client', 'admin_verified'])('allows %s service corrections while keeping appointments and assignments locked', async status => {
    mount('salesRep', status);
    await waitFor(() => expect(screen.getByTestId('service-cell')).toHaveTextContent('Photography'));
    expect(screen.getByTestId('add-new-service')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove Photography' })).toBeDisabled();
    expect(screen.getByTestId('photographer-cell')).toBeDisabled();
    expect(document.querySelector('[data-service-schedule-picker]')).toBeNull();
    expect(screen.queryByText('Travel controls')).not.toBeInTheDocument();
    for (const label of ['Property edit', 'Client edit', 'Price edit']) {
      expect(screen.getByLabelText(label)).not.toHaveAttribute('readonly');
    }
  });

  it('keeps appointment controls locked for a secondary rep on a nonprivileged primary role', () => {
    mount('editor', 'delivered', ['sales_rep']);
    expect(screen.getByTestId('add-new-service')).toBeEnabled();
    expect(screen.getByTestId('photographer-cell')).toBeDisabled();
  });

  it.each([['delivered', 'scheduled'], ['scheduled', 'delivered']])('keeps production locked when status %s and workflow %s disagree', (status, workflowStatus) => {
    mount('salesRep', status, [], workflowStatus);
    expect(screen.getByTestId('add-new-service')).toBeEnabled();
    expect(screen.getByTestId('photographer-cell')).toBeDisabled();
    expect(screen.queryByText('Travel controls')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Price edit')).not.toHaveAttribute('readonly');
  });

  it('honors explicit denied booking edits for a delivered order', () => {
    auth.user = { ...auth.user, role: 'salesRep', secondary_roles: [] };
    render(<MemoryRouter><ShootDetailsOverviewTab shoot={{ ...shoot, canManageBooking: false }}
      role="salesRep" isAdmin={false} isRep isPhotographer={false} isEditor={false} isClient={false}
      isEditMode onShootUpdate={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByTestId('add-new-service')).toBeNull();
  });

  it.each(['admin', 'superadmin', 'editing_manager'])('preserves delivered service editing for %s with a secondary rep role', async role => {
    mount(role, 'delivered', ['sales_rep']);
    await waitFor(() => expect(screen.getByTestId('service-cell')).toHaveTextContent('Photography'));
    expect(screen.getByTestId('add-new-service')).toBeInTheDocument();
    expect(screen.getByTestId('photographer-cell')).toBeInTheDocument();
  });

  it('preserves service editing for a scheduled rep booking', async () => {
    mount('salesRep', 'scheduled');
    await waitFor(() => expect(screen.getByTestId('service-cell')).toHaveTextContent('Photography'));
    expect(screen.getByTestId('photographer-cell')).toBeInTheDocument();
  });
});
