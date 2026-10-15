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
vi.mock('./overview/OverviewPropertyLocationSection', () => ({ OverviewPropertyLocationSection: ({ isEditMode }: { isEditMode: boolean }) => <input aria-label="Property edit" readOnly={!isEditMode} /> }));
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
  payment: { totalQuote: 100, totalPaid: 0 }, canManageBooking: true,
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
  it.each(['delivered', 'delivered_to_client', 'ready_for_client', 'admin_verified'])('keeps %s service, schedule and artist data read-only while allowing details and pricing', async status => {
    mount('salesRep', status);
    await waitFor(() => expect(screen.getByRole('region', { name: 'Booked services' })).toBeInTheDocument());
    expect(screen.queryByTestId('add-new-service')).not.toBeInTheDocument();
    expect(screen.queryByTestId('service-cell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('photographer-cell')).not.toBeInTheDocument();
    expect(screen.queryByText('Travel controls')).not.toBeInTheDocument();
    for (const label of ['Property edit', 'Client edit', 'Price edit']) {
      expect(screen.getByLabelText(label)).not.toHaveAttribute('readonly');
    }
  });

  it('also restricts a secondary rep on a nonprivileged primary role', () => {
    mount('editor', 'delivered', ['sales_rep']);
    expect(screen.queryByTestId('add-new-service')).not.toBeInTheDocument();
  });

  it.each([['delivered', 'scheduled'], ['scheduled', 'delivered']])('keeps production locked when status %s and workflow %s disagree', (status, workflowStatus) => {
    mount('salesRep', status, [], workflowStatus);
    expect(screen.queryByTestId('add-new-service')).not.toBeInTheDocument();
    expect(screen.queryByTestId('photographer-cell')).not.toBeInTheDocument();
    expect(screen.queryByText('Travel controls')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Price edit')).not.toHaveAttribute('readonly');
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
