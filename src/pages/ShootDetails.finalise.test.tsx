import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeliveryPlan } from '@/services/mediaMarkService';
import type { ShootData } from '@/types/shoots';
import { MediaMarkDialogHost } from '@/components/shoots/tabs/media/mark/MediaMarkDialog';
import ShootDetails from './ShootDetails';

const mocks = vi.hoisted(() => ({
  fastForward: false, refresh: vi.fn(), finalize: vi.fn(), plan: vi.fn(),
  shoot: {
    id: '6037', status: 'ready', workflowStatus: 'ready', files: [], rawPhotoCount: 0,
    editedPhotoCount: 0, canFinalizeNoMedia: false, canFinalizeDelivery: true,
    location: { address: '3104 Plank Road', city: 'Fredericksburg', state: 'VA', zip: '22407' },
  },
}));
vi.mock('@/components/auth', () => ({ useAuth: () => ({ role: 'admin', user: { id: '5', role: 'admin' } }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'admin', user: { id: '5', role: 'admin' } }) }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: vi.fn() }));
vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useRescheduleAccess', () => ({ useRescheduleAccess: () => ({ access: 'none' }) }));
vi.mock('@/contexts/UserPreferencesContext', () => ({ useUserPreferences: () => ({ formatTemperature: String, formatTime: String, formatDate: String }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/features/shoot-units/ShootUnitScope', () => ({ ShootUnitScopeProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/features/shoot-units/ShootDetailsPanelUnitChrome', () => ({ ShootDetailsPanelUnitChrome: () => null }));
vi.mock('@/components/shoots/details/useHoldNotifications', () => ({ useHoldNotifications: () => ({}), describeHoldNotifications: () => '' }));
vi.mock('@/components/shoots/details/useShootPageOverview', () => ({ useShootPageOverview: () => ({ isOverviewModalOpen: false }) }));
vi.mock('@/components/shoots/modal/useShootDetailsScreen', () => ({ useShootDetailsScreen: () => ({
  shoot: mocks.shoot, shootLoading: false, refreshShoot: mocks.refresh, rawFileCount: 0,
  currentUserRole: 'admin', roleFlags: { isAdmin: true, isAdminOrRep: true }, visibleTabs: [],
  capabilities: { normalizedStatus: 'ready', canFinalise: true, isFastForwardFinalise: mocks.fastForward },
}) }));
vi.mock('@/components/shoots/modal/useShootDetailsModalActions', () => ({ useShootDetailsModalActions: () => ({ selectedFileIds: [], setIsDownloadDialogOpen: vi.fn() }) }));
vi.mock('@/components/shoots/details/ShootDetailsPageHeader', () => ({ ShootDetailsPageHeader: ({ onFinalise, isFinalising }: { onFinalise: () => void; isFinalising: boolean }) => <button disabled={isFinalising} onClick={onFinalise}>Finalize & Deliver</button> }));
vi.mock('@/components/shoots/details/ShootDetailsPageDialogs', () => ({ ShootDetailsPageDialogs: () => null }));
vi.mock('@/components/shoots/tabs/ShootDetailsMediaTab', () => ({ ShootDetailsMediaTab: () => null }));
vi.mock('@/components/shoots/tabs/ShootDetailsNotesTab', () => ({ ShootDetailsNotesTab: () => null }));
vi.mock('@/components/shoots/tabs/ShootDetailsSettingsTab', () => ({ ShootDetailsSettingsTab: () => null }));
vi.mock('@/components/shoots/tabs/ShootDetailsSlideshowTab', () => ({ ShootDetailsSlideshowTab: () => null }));
vi.mock('@/components/shoots/tabs/ShootDetailsActivityLogTab', () => ({ ShootDetailsActivityLogTab: () => null }));
vi.mock('@/components/shoots/tabs/ShootDetailsIssuesTab', () => ({ ShootDetailsIssuesTab: () => null }));
vi.mock('@/components/shoots/tabs/ShootDetailsSidebar', () => ({ ShootDetailsSidebar: () => null }));
vi.mock('@/components/shoots/AddServiceDialog', () => ({ AddServiceDialog: () => null }));
vi.mock('@/components/shoots/ShootDetailsModal', () => ({ ShootDetailsModal: () => null }));
vi.mock('@/components/shoots/finalize/finalizeShootWithProgressToast', () => ({ finalizeShootWithProgressToast: mocks.finalize }));
vi.mock('@/services/mediaMarkService', async original => ({ ...await original<object>(), getDeliveryPlan: mocks.plan }));

const providerPlan = (): DeliveryPlan => ({
  revision: 'pending-iguide', shoot_id: 6037, summary: 'Waiting for provider output.',
  ready_component_ids: [], remaining_component_ids: ['6274:floorplan', '6274:tour'],
  capabilities: { can_finalize: true, can_manual_no_content: true, can_assign_service: true },
  components: (['floorplan', 'tour'] as const).map(kind => ({
    id: `6274:${kind}`, shoot_service_id: 6274, unit_id: null, service_name: 'Premium iGuide with Floor plans',
    kind, label: kind === 'floorplan' ? 'Floorplans' : 'Property tour', status: 'pending',
    required: true, resolved: false, deferred: false, file_ids: [],
    reason_codes: ['external_review_required'], reason: 'Provider output needs review.',
    methods: ['external', 'defer', 'manual_no_content'],
  })),
});
const show = () => render(<MemoryRouter initialEntries={['/shoots/6037/3104-plank-road']}>
  <Routes><Route path="/shoots/:id/:slug?" element={<ShootDetails />} /></Routes><MediaMarkDialogHost />
</MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks(); mocks.fastForward = false; mocks.shoot.canFinalizeNoMedia = false;
  mocks.refresh.mockResolvedValue(mocks.shoot as unknown as ShootData);
  mocks.plan.mockResolvedValue(providerPlan()); mocks.finalize.mockResolvedValue({ status: 'completed', warnings: [] });
});
afterEach(cleanup);

describe('shoot page finalization', () => {
  it('opens delivery review and defers pending iGUIDE without requiring uploaded files', async () => {
    show(); fireEvent.click(screen.getByRole('button', { name: 'Finalize & Deliver' }));
    await screen.findByRole('heading', { name: 'Finalise shoot' });
    expect(mocks.finalize).not.toHaveBeenCalled();
    const apply = screen.getByRole('button', { name: 'Finalise' });
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole('switch', { name: 'Finalise without waiting' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Premium iGuide with Floor plans' }));
    expect(apply).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /Reason for proceeding/ }), { target: { value: 'Waiting for iGUIDE delivery' } });
    expect(apply).toBeEnabled(); fireEvent.click(apply);
    await screen.findByText('All set');
    expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({
      shootId: '6037', body: expect.objectContaining({
        component_ids: ['6274:floorplan', '6274:tour'], mode: 'auto', allow_without_content: true,
        reason: 'Waiting for iGUIDE delivery', plan_revision: 'pending-iguide', confirmed: true,
      }),
    }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('preserves the server-authorized whole-shoot no-media fast-forward path', async () => {
    mocks.fastForward = true; mocks.shoot.canFinalizeNoMedia = true;
    show(); fireEvent.click(screen.getByRole('button', { name: 'Finalize & Deliver' }));
    await waitFor(() => expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({
      shootId: '6037', body: { final_status: 'admin_verified', allow_no_media_delivery: true },
    })));
    expect(mocks.plan).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Finalise shoot' })).not.toBeInTheDocument();
  });
});
