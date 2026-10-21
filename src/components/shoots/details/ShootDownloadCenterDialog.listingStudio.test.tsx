import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootDownloadCenterDialog } from './ShootDownloadCenterDialog';
import type { ShootData } from '@/types/shoots';

const mocks = vi.hoisted(() => ({
  eligibility: vi.fn(), model: vi.fn(), can: vi.fn(), onClose: vi.fn(), onDownload: vi.fn(),
  auth: { user: { id: 'client-41', role: 'client' }, role: 'client', isImpersonating: false },
  permissionsLoading: false,
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ can: mocks.can, isLoading: mocks.permissionsLoading }) }));
vi.mock('@/services/listingStudioFreeEdits', () => ({ getFreeEditsEligibility: mocks.eligibility }));
vi.mock('./shootDownloadCenterModel', () => ({ buildShootDownloadCenterModel: mocks.model }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const available = { eligible: true, reason: null, email_verified: true, claim: null };
const photoModel = { wholeShootPhotoCount: 3, services: [], editedVideos: [], videoLinks: [], threeDLinks: [], floorplanPdfs: [], floorplanJpgs: [], tourLinks: [] };
const shoot = { id: 'delivered-shoot', workflowStatus: 'delivered', status: 'delivered', files: [], services: [] } as unknown as ShootData;
function LocationProbe() { return <output data-testid="location">{useLocation().pathname}</output>; }
function mount(options: { shoot?: ShootData; open?: boolean; isClient?: boolean; isDownloading?: boolean; client?: QueryClient } = {}) {
  const client = options.client ?? new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  function DownloadCenter() {
    const [open, setOpen] = useState(options.open ?? true);
    return <ShootDownloadCenterDialog shoot={options.shoot ?? shoot} open={open} isClient={options.isClient ?? true}
      isDownloading={options.isDownloading ?? false} downloadStatusMessage="" onOpenChange={next => { mocks.onClose(next); setOpen(next); }} onDownloadArchive={mocks.onDownload} />;
  }
  const result = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/shoots/delivered-shoot']}>
    <LocationProbe />
    <DownloadCenter />
  </MemoryRouter></QueryClientProvider>);
  return { ...result, client };
}

beforeEach(() => {
  vi.clearAllMocks(); mocks.eligibility.mockReset(); mocks.model.mockReset();
  mocks.auth.user = { id: 'client-41', role: 'client' }; mocks.auth.role = 'client'; mocks.auth.isImpersonating = false;
  mocks.permissionsLoading = false; mocks.can.mockReturnValue(true);
  mocks.eligibility.mockResolvedValue(available); mocks.model.mockReturnValue(photoModel); mocks.onDownload.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Listing Studio offer in the client Download Center', () => {
  it('keeps photo downloads first and closes the dialog when navigating to the existing intake', async () => {
    mount();
    const link = await screen.findByRole('link', { name: 'Try 3 free edits' });
    const photos = screen.getByRole('region', { name: 'Photos' });
    expect(photos.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /High res/ }));
    await waitFor(() => expect(mocks.onDownload).toHaveBeenCalledWith('original', { label: 'all photos', assetType: 'photos' }));
    await screen.findByRole('link', { name: 'Try 3 free edits' });
    fireEvent.click(screen.getByRole('link', { name: 'Try 3 free edits' }));
    expect(mocks.onClose).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('location')).toHaveTextContent('/listing-studio/free-edits');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['already_claimed', 'email_already_claimed', 'email_not_verified'])('hides an unavailable offer without exposing the reason: %s', async reason => {
    mocks.eligibility.mockResolvedValue({ ...available, eligible: false, reason });
    const { client } = mount();
    await waitFor(() => expect(mocks.eligibility).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole('complementary', { name: 'Listing Studio photo edits' })).not.toBeInTheDocument();
    expect(screen.queryByText(/claimed|verified|another account/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /High res/ })).toBeEnabled();
  });

  it('hides an existing claim even if stale eligibility still says true', async () => {
    mocks.eligibility.mockResolvedValue({ ...available, claim: { id: 1, ticket_id: 8, status: 'open' } });
    const { client } = mount();
    await waitFor(() => expect(mocks.eligibility).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Try 3 free edits' })).not.toBeInTheDocument());
  });

  it('removes the offer when a successful claim updates the shared eligibility cache', async () => {
    const { client } = mount(); await screen.findByRole('link', { name: 'Try 3 free edits' });
    act(() => client.setQueryData(['listing-studio-free-edits', 'client-41'], { ...available, eligible: false, reason: 'already_claimed' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Try 3 free edits' })).not.toBeInTheDocument());
  });

  it('shares the account-scoped eligibility cache between delivered shoots', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const first = mount({ client }); await screen.findByRole('link', { name: 'Try 3 free edits' }); first.unmount();
    mount({ client, shoot: { ...shoot, id: 'another-delivered-shoot' } });
    expect(await screen.findByRole('link', { name: 'Try 3 free edits' })).toBeVisible();
    expect(mocks.eligibility).toHaveBeenCalledTimes(1);
  });

  it('does not show another account’s cached eligibility', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const first = mount({ client }); await screen.findByRole('link', { name: 'Try 3 free edits' }); first.unmount();
    mocks.auth.user = { id: 'client-42', role: 'client' };
    mocks.eligibility.mockResolvedValue({ ...available, eligible: false, reason: 'already_claimed' });
    mount({ client }); await waitFor(() => expect(mocks.eligibility).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('link', { name: 'Try 3 free edits' })).not.toBeInTheDocument();
  });

  it('keeps downloads available while eligibility is loading or fails', async () => {
    let fail!: (value: unknown) => void;
    mocks.eligibility.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
    mount();
    expect(screen.getByRole('button', { name: /High res/ })).toBeEnabled();
    expect(screen.queryByRole('link', { name: 'Try 3 free edits' })).not.toBeInTheDocument();
    await act(async () => fail(new Error('Unavailable')));
    expect(screen.getByRole('button', { name: /High res/ })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Try 3 free edits' })).not.toBeInTheDocument();
    expect(mocks.eligibility).toHaveBeenCalledTimes(1);
  });

  it.each(['admin', 'superadmin', 'salesRep', 'photographer', 'editor'])('never fetches or promotes the client offer to %s', role => {
    mocks.auth.user.role = role; mount();
    expect(mocks.eligibility).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Try 3 free edits' })).not.toBeInTheDocument();
  });

  it('does not show while impersonating or using a staff role', () => {
    mocks.auth.isImpersonating = true;
    const first = mount(); expect(mocks.eligibility).not.toHaveBeenCalled(); first.unmount();
    mocks.auth.isImpersonating = false; mocks.auth.role = 'admin';
    mount(); expect(mocks.eligibility).not.toHaveBeenCalled();
  });

  it.each([true, false])('does not fetch without a confirmed Support permission (loading=%s)', loading => {
    mocks.permissionsLoading = loading; mocks.can.mockReturnValue(false);
    mount(); expect(mocks.eligibility).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Try 3 free edits' })).not.toBeInTheDocument();
  });

  it.each(['scheduled', 'uploaded', 'editing', 'ready', 'cancelled'])('omits the offer before delivery or after cancellation (%s)', status => {
    mount({ shoot: { ...shoot, status, workflowStatus: status } });
    expect(mocks.eligibility).not.toHaveBeenCalled();
  });

  it('does not fetch for empty photo downloads, closed dialogs or an active download', () => {
    const closed = mount({ open: false }); expect(mocks.eligibility).not.toHaveBeenCalled(); closed.unmount();
    const busy = mount({ isDownloading: true }); expect(mocks.eligibility).not.toHaveBeenCalled(); busy.unmount();
    const staff = mount({ isClient: false }); expect(mocks.eligibility).not.toHaveBeenCalled(); staff.unmount();
    mocks.model.mockReturnValue({ ...photoModel, wholeShootPhotoCount: 0 });
    mount(); expect(mocks.eligibility).not.toHaveBeenCalled();
  });
});
