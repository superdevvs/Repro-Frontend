import { useShootsTabsCardController } from '@/components/dashboard/v2/useShootsTabsCardController';
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedShootCard } from '@/components/shoots/SharedShootCard';
import { ScheduledShootListRow } from './ScheduledShootListRow';
import { useShootHistoryData } from '@/hooks/useShootHistoryData';
import { DEFAULT_HISTORY_FILTERS, DEFAULT_OPERATIONAL_FILTERS } from './shootHistoryUtils';
import type { ShootData } from '@/types/shoots';

const mocks = vi.hoisted(() => ({ get: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: { get: mocks.get }, getApiHeaders: () => ({}) }));
vi.mock('@/hooks/useShootHistoryMapGeocoding', () => ({ useShootHistoryMapGeocoding: () => ({ geoCache: {}, setGeoCache: vi.fn() }) }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => false }));
vi.mock('@/hooks/useWeatherData', () => ({ useWeatherData: () => ({}) }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/contexts/UserPreferencesContext', () => ({ useUserPreferences: () => ({
  formatDate: () => 'Sep 30, 2026', formatTime: (value: string) => value, formatTemperature: (value: string) => value,
}) }));

const shoot = {
  id: '101', status: 'requested', workflowStatus: 'requested', scheduledDate: '2026-09-30', time: '10:00:00',
  location: { address: '12 Requested Street', city: 'Austin', state: 'TX', zip: '78701' },
  client: { id: '999', name: 'Other reps client', email: 'client@example.invalid' }, photographer: { name: 'Photographer' },
  services: ['Photography'], payment: { baseQuote: 0, taxRate: 0, taxAmount: 0, totalQuote: 0, totalPaid: 0 },
} as ShootData;

beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ data: { data: [shoot], meta: { count: 60 } } }); });
afterEach(cleanup);

describe('sales requested shoot controls', () => {
  it.each(['card', 'row'] as const)('exposes working approve, modify and decline actions in the %s', (layout) => {
    const actions = { onApprove: vi.fn(), onModify: vi.fn(), onDecline: vi.fn() };
    render(layout === 'card'
      ? <SharedShootCard shoot={shoot} role="salesRep" {...actions} />
      : <ScheduledShootListRow shoot={shoot} viewerRole="salesRep" onSelect={vi.fn()} {...actions} />);
    fireEvent.click(screen.getByRole('button', { name: /^Approve$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Modify$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Decline$/ }));
    Object.values(actions).forEach((callback) => expect(callback).toHaveBeenCalledWith(shoot));
  });

  it('keeps the Requested tab accessible when every pending request has a past date', () => {
    const requested = shootDataToSummary({ ...shoot, scheduledDate: '2000-01-01' });
    const { result } = renderHook(() => useShootsTabsCardController({
      role: 'salesRep', upcomingShoots: [], requestedShoots: [requested], onSelect: vi.fn(),
    }));
    expect(result.current.hasPastRequests).toBe(true);
    expect(result.current.requestedCount).toBe(1);
    expect(result.current.filteredRequestedShoots).toHaveLength(1);
    act(() => result.current.setActiveTab('requested'));
    expect(result.current.activeTab).toBe('requested');
  });

  it('keeps requested actions hidden from clients', () => {
    render(<SharedShootCard shoot={shoot} role="client" onApprove={vi.fn()} onModify={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Approve$/ })).toBeNull();
  });

  it('requests the selected status before pagination and resets the page when switching subtabs', async () => {
    const { result, rerender } = renderHook(({ subTab }: { subTab: 'all' | 'requested' }) => useShootHistoryData({
      toast: mocks.toast, navigate: vi.fn(), role: 'salesRep', user: null, activeTab: 'scheduled', scheduledSubTab: subTab,
      operationalFilters: DEFAULT_OPERATIONAL_FILTERS, historyFilters: DEFAULT_HISTORY_FILTERS, viewMode: 'list',
      canViewAllShoots: false, canViewHistory: false, canViewInvoice: false, shouldHideClientDetails: false,
      isSuperAdmin: false, isAdmin: false, isEditingManager: false, isPhotographer: false, isEditor: false,
      formatDatePref: () => '', formatTime: (value) => value,
    }), { initialProps: { subTab: 'all' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleOperationalPageChange('next'));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('/shoots', expect.objectContaining({ params: expect.objectContaining({ page: 2 }) })));
    rerender({ subTab: 'requested' });
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('/shoots', expect.objectContaining({ params: expect.objectContaining({ page: 1, scheduled_status: 'requested' }) })));
    expect(result.current.operationalData).toHaveLength(1);
  });
});

