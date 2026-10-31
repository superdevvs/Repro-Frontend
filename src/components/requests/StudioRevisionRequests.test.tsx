import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestManagerProvider, useRequestManager } from '@/context/RequestManagerContext';
import { StudioRevisionRequestsProvider } from '@/context/StudioRevisionRequestsContext';
import { PendingReviewsCard } from '@/components/dashboard/v2/PendingReviewsCard';
import { RequestManagerModal } from './RequestManagerModal';
import ListingStudioRevisions from '@/pages/ListingStudioRevisions';
import { listingStudioTeam } from '@/services/listingStudioTeamService';
import type { StudioRevisionTask } from '@/types/listingStudioTeam';

const taskId = '00000000-0000-4000-8000-000000000001';
const state = vi.hoisted(() => ({ role: 'admin', user: { id: 87, secondary_roles: [] as string[] }, isImpersonating: false, isLoading: false }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ ...state, user: { ...state.user, secondary_roles: [...state.user.secondary_roles] } }) }));
vi.mock('@/services/listingStudioTeamService', () => ({ listingStudioTeam: { list: vi.fn() } }));
vi.mock('@/components/listing-studio/team/StudioRevisionPanel', () => ({ StudioRevisionPanel: ({ accountId, taskId }: { accountId: string; taskId: string }) => <div>Private revision {accountId} / {taskId}</div> }));
vi.mock('@/components/shoots/EditingTasks', () => ({ EditingTasks: () => <button>Editing tasks</button> }));
const shootRequest = { id: 9, tracking_code: 'shoot-9', summary: 'Fix the living room', priority: 'high' as const, status: 'open' as const, target_team: 'editor' };
const task = { id: taskId, service: 'staging', status: 'queued', client: { id: '10', name: 'Studio client' }, assignee: null, createdAt: '2026-10-31T08:00:00Z' } as StudioRevisionTask;
let client: QueryClient;

function LocationProbe() { const location = useLocation(); return <output aria-label="Location">{location.pathname}{location.search}</output>; }
function OpenRequests() { const { openModal } = useRequestManager(); return <button onClick={() => openModal([], undefined, 'client')}>Open requests</button>; }
function Dashboard({ card = true }: { card?: boolean }) {
  return <RequestManagerProvider><StudioRevisionRequestsProvider>
    <OpenRequests />
    {card && <PendingReviewsCard reviews={[]} issues={[]} onSelect={vi.fn()} showClientTab showEditingTab editingRequests={[shootRequest]} />}
    <RequestManagerModal /><LocationProbe />
  </StudioRevisionRequestsProvider></RequestManagerProvider>;
}
function view(path = '/dashboard', card = true) {
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/listing-studio/revisions" element={<ListingStudioRevisions />} />
    <Route path="/dashboard" element={<Dashboard card={card} />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); state.role = 'admin'; state.user = { id: 87, secondary_roles: [] }; state.isImpersonating = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(listingStudioTeam.list).mockImplementation(async (page = 1, status = '', perPage = 20) => ({
    tasks: perPage === 1 ? [] : [task],
    pagination: { page, perPage, total: ({ queued: 4, assigned: 2, in_progress: 1 } as Record<string, number>)[status] ?? 1, hasMore: false },
  }));
});
afterEach(() => { cleanup(); client.clear(); });

describe('Studio revisions in dashboard requests', () => {
  it('adds active totals to Editing without loading task history and filters both sources', async () => {
    view();
    const editing = await screen.findByRole('button', { name: 'Editing (8)' });
    expect(listingStudioTeam.list).toHaveBeenCalledTimes(3);
    expect(vi.mocked(listingStudioTeam.list).mock.calls.map(call => [call[1], call[2]])).toEqual([['queued', 1], ['assigned', 1], ['in_progress', 1]]);
    fireEvent.click(editing);
    expect(await screen.findByText('Listing Studio')).toBeVisible();
    expect(screen.getByText('Fix the living room')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Shoot edits' }));
    expect(screen.queryByText('Listing Studio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editing tasks' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Studio revisions' }));
    expect(await screen.findByText('Listing Studio')).toBeVisible();
    expect(screen.queryByText('Fix the living room')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Listing Studio.*Studio client/ }));
    const manager = await screen.findByRole('dialog', { name: 'Request Manager' });
    expect(await within(manager).findByText(`Private revision 87 / ${taskId}`)).toBeVisible();
    fireEvent.click(within(manager).getByRole('button', { name: 'Back to editing requests' }));
    expect(await within(manager).findByText('Listing Studio')).toBeVisible();
    expect(within(manager).getByRole('button', { name: 'Studio revisions' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('redirects legacy task links into the existing manager even before a Requests card mounts', async () => {
    view(`/listing-studio/revisions?task=${taskId}`, false);
    const manager = await screen.findByRole('dialog', { name: 'Request Manager' });
    expect(await within(manager).findByText(`Private revision 87 / ${taskId}`)).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/dashboard$/);
    fireEvent.click(within(manager).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await client.invalidateQueries({ queryKey: ['studio-team'] });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open requests' }));
    expect(screen.queryByText(`Private revision 87 / ${taskId}`)).not.toBeInTheDocument();
  });

  it('keeps revision status and pagination when returning from a task', async () => {
    vi.mocked(listingStudioTeam.list).mockImplementation(async (page = 1, status = '', perPage = 20) => ({ tasks: perPage === 1 ? [] : [task], pagination: { page, perPage, total: perPage === 1 ? 1 : 21, hasMore: page === 1 && perPage !== 1 } }));
    view('/dashboard?requests=editing&editingSource=studio', false);
    const manager = await screen.findByRole('dialog', { name: 'Request Manager' });
    await within(manager).findByText('Listing Studio');
    fireEvent.change(within(manager).getByLabelText('Revision status'), { target: { value: 'assigned' } });
    await waitFor(() => expect(listingStudioTeam.list).toHaveBeenCalledWith(1, 'assigned'));
    await waitFor(() => expect(within(manager).getByRole('button', { name: 'Next' })).toBeEnabled());
    fireEvent.click(within(manager).getByRole('button', { name: 'Next' }));
    await within(manager).findByText('Page 2');
    fireEvent.click(within(manager).getByRole('button', { name: /Listing Studio.*Studio client/ }));
    await within(manager).findByText(`Private revision 87 / ${taskId}`);
    fireEvent.click(within(manager).getByRole('button', { name: 'Back to editing requests' }));
    expect(within(manager).getByLabelText('Revision status')).toHaveValue('assigned');
    expect(within(manager).getByText('Page 2')).toBeVisible();
  });

  it('discards invalid task ids while retaining the revision queue bookmark', async () => {
    view('/listing-studio/revisions?task=not-a-task', false);
    const manager = await screen.findByRole('dialog', { name: 'Request Manager' });
    expect(await within(manager).findByText('Listing Studio')).toBeVisible();
    expect(within(manager).queryByText(/Private revision/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/dashboard$/);
  });

  it.each(['admin', 'superadmin', 'editing_manager', 'editor'])('keeps Studio access for %s', async role => {
    state.role = role; view();
    expect(await screen.findByRole('button', { name: 'Editing (8)' })).toBeVisible();
  });

  it.each(['client', 'photographer', 'salesRep'])('does not fetch or expose Studio tasks for an unauthorized %s', async role => {
    state.role = role; view(`/listing-studio/revisions?task=${taskId}`);
    await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/dashboard$/));
    expect(listingStudioTeam.list).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editing (1)' }));
    expect(screen.queryByRole('group', { name: 'Editing request source' })).not.toBeInTheDocument();
  });

  it('does not expose Studio data while impersonating', async () => {
    state.isImpersonating = true; view(`/listing-studio/revisions?task=${taskId}`);
    await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/dashboard$/));
    expect(listingStudioTeam.list).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('preserves a secondary staff entry in the client request manager and respects server denial', async () => {
    state.role = 'client'; state.user.secondary_roles = ['editing_manager'];
    vi.mocked(listingStudioTeam.list).mockRejectedValue({ response: { status: 403 } });
    view('/dashboard', false);
    fireEvent.click(screen.getByRole('button', { name: 'Open requests' }));
    fireEvent.click(screen.getByRole('tab', { name: /Editing/ }));
    expect(await screen.findByText('Studio revisions are not available for this account.')).toBeVisible();
    expect(screen.queryByText(/Private revision/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editing tasks' })).not.toBeInTheDocument();
    expect(listingStudioTeam.list).toHaveBeenCalledTimes(4);
  });
});
