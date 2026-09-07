import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';

const mocks = vi.hoisted(() => ({ download: vi.fn(), toast: vi.fn(), get: vi.fn() }));
vi.mock('@/utils/shootMediaDownload', () => ({ downloadShootRawFiles: mocks.download }));
vi.mock('@/services/api', () => ({ apiClient: { get: mocks.get }, getApiHeaders: () => ({}) }));
vi.mock('@/hooks/useShootHistoryMapGeocoding', () => ({ useShootHistoryMapGeocoding: () => ({ geoCache: {}, setGeoCache: vi.fn() }) }));
vi.mock('@/contexts/UserPreferencesContext', () => ({ useUserPreferences: () => ({ formatDate: () => 'Sep 7, 2026' }) }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

import { useShootHistoryData } from '@/hooks/useShootHistoryData';
import { DEFAULT_HISTORY_FILTERS, DEFAULT_OPERATIONAL_FILTERS } from './shootHistoryUtils';
import { CompletedAlbumCard } from './CompletedAlbumCard';
import { CompletedShootListRow } from './CompletedShootListRow';

const shoot = {
  id: '101', status: 'uploaded', workflowStatus: 'uploaded', scheduledDate: '2026-09-07', time: '10:00:00',
  location: { address: '12 Oak Street', city: 'Austin', state: 'TX', zip: '78701', fullAddress: '12 Oak Street, Austin, TX 78701' },
  client: { name: 'Client', email: 'client@example.invalid', totalShoots: 1 }, photographer: { name: 'Photographer' },
  services: ['Photography'], payment: { baseQuote: 0, taxRate: 0, taxAmount: 0, totalQuote: 0, totalPaid: 0 },
} as ShootData;

function HistoryDownload({ layout, role }: { layout: 'card' | 'row'; role: 'admin' | 'editor' | 'salesRep' }) {
  const data = useShootHistoryData({
    toast: mocks.toast, navigate: vi.fn(), role, user: null, activeTab: 'completed',
    operationalFilters: DEFAULT_OPERATIONAL_FILTERS, historyFilters: DEFAULT_HISTORY_FILTERS,
    viewMode: layout === 'card' ? 'grid' : 'list', canViewAllShoots: true, canViewHistory: false,
    canViewInvoice: false, shouldHideClientDetails: false, isSuperAdmin: false, isAdmin: role === 'admin',
    isEditingManager: false, isPhotographer: false, isEditor: role === 'editor',
    formatDatePref: () => 'Sep 7, 2026', formatTime: (value) => value,
  });
  const Component = layout === 'card' ? CompletedAlbumCard : CompletedShootListRow;
  return <Component shoot={shoot} onSelect={vi.fn()} isAdmin={role === 'admin'} isEditor={role === 'editor'}
    onDownload={data.canDownloadHistoryShoot(shoot) ? data.handleDownloadShoot : undefined}
    isDownloading={data.downloadingShootIds.has(String(shoot.id))} />;
}

beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ data: { data: [] } }); });
afterEach(cleanup);

describe('history download buttons', () => {
  it.each([['card', 'admin'], ['row', 'editor']] as const)('keeps the %s button busy through failure and permits a retry', async (layout, role) => {
    let rejectDownload!: (reason: Error) => void;
    mocks.download.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectDownload = reject; }));
    await act(async () => { render(<HistoryDownload layout={layout} role={role} />); });
    const buttons = screen.getAllByRole('button', { name: 'Downloads' });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);
    expect(mocks.download).toHaveBeenCalledTimes(1);
    expect(mocks.download).toHaveBeenCalledWith({ shootId: '101', address: '12 Oak Street, Austin, TX, 78701' });
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button.querySelector('.animate-spin')).not.toBeNull();
    });
    await act(async () => { rejectDownload(new Error('Please retry this download.')); });
    await waitFor(() => expect(buttons[0]).toBeEnabled());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Download failed' }));
    mocks.download.mockResolvedValueOnce({ mode: 'blob' });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(buttons[0]).toHaveAttribute('aria-busy', 'false'));
  });

  it('keeps raw download unavailable to sales', async () => {
    await act(async () => { render(<HistoryDownload layout="card" role="salesRep" />); });
    expect(screen.queryByRole('button', { name: 'Downloads' })).not.toBeInTheDocument();
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
