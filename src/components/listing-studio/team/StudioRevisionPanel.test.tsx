import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { StudioRevisionPanel } from './StudioRevisionPanel';
import { listingStudioTeam } from '@/services/listingStudioTeamService';
import { readStudioDelivery } from '@/lib/listingStudioDelivery';
import type { StudioRevisionTask } from '@/types/listingStudioTeam';

vi.mock('@/services/listingStudioTeamService', () => ({ listingStudioTeam: { detail: vi.fn(), assignees: vi.fn(), deliver: vi.fn(), start: vi.fn(), assign: vi.fn(), resume: vi.fn(), transition: vi.fn(), downloadSource: vi.fn() } }));
vi.mock('./StudioRevisionMedia', () => ({ StudioRevisionMedia: ({ variant }: { variant: string }) => <div>{variant} preview</div> }));
let currentTask: StudioRevisionTask; let queryClient: QueryClient;
const taskId = '00000000-0000-4000-8000-000000000010';
function fixture(): StudioRevisionTask {
  return { id: taskId, orderId: 'order-1', itemId: 'item-1', version: 4, status: 'in_progress', itemStatus: 'processing', service: 'grass', client: { id: '42', name: 'Example Client' }, assignee: { id: '87', name: 'Example Editor' }, instructions: 'Refine the lawn edge.', createdAt: '2026-10-31T12:00:00Z', updatedAt: '2026-10-31T12:05:00Z', assignedAt: '2026-10-31T12:02:00Z', startedAt: '2026-10-31T12:05:00Z', deliveredAt: null, source: { originalPreviewAvailable: true, resultPreviewAvailable: true }, deliveryPreviewAvailable: false, actions: { canAssign: false, canStart: false, canDeliver: true, canViewSource: true, canViewDelivery: false, canResumeDelivery: false, canHold: true, canFail: false, canCancel: false }, recovery: { state: 'none', reasonCode: null, message: null }, deliveryAttempt: null, deliveryConstraints: { mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], maxFileBytes: 10485760, maxPixels: 40000000, maxFiles: 1 } };
}
function view() { return render(<QueryClientProvider client={queryClient}><StudioRevisionPanel accountId="87" taskId={taskId} /></QueryClientProvider>); }
function image() { const file = new File(['private-result'], 'finished.jpg', { type: 'image/jpeg' }); Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer }); return file; }
beforeEach(() => {
  sessionStorage.clear(); vi.clearAllMocks(); vi.stubGlobal('crypto', webcrypto); currentTask = fixture();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(listingStudioTeam.detail).mockImplementation(async () => currentTask);
  vi.mocked(listingStudioTeam.deliver).mockImplementation(async () => {
    currentTask = { ...currentTask, version: 5, actions: { ...currentTask.actions, canDeliver: false, canHold: false }, deliveryAttempt: { id: 'attempt-1', status: 'pending', reasonCode: null, message: null, canResume: false } };
    return { task: currentTask, created: true };
  });
});
afterEach(() => { cleanup(); queryClient.clear(); vi.unstubAllGlobals(); });

describe('team revision actions and delivery', () => {
  it('uses server action permissions and does not offer management actions to an assigned editor', async () => {
    view(); await screen.findByText('Requested changes');
    expect(screen.queryByLabelText('Assigned editor')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unable to complete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel revision' })).not.toBeInTheDocument();
    expect(listingStudioTeam.assignees).not.toHaveBeenCalled();
  });
  it('submits one delivery and waits for local finalization rather than claiming it is delivered', async () => {
    view(); await screen.findByLabelText('Finished photo'); const user = userEvent.setup(); await user.upload(screen.getByLabelText('Finished photo'), image());
    await user.dblClick(screen.getByRole('button', { name: 'Deliver finished photo' }));
    await screen.findByText(/Saving the delivered photo/);
    expect(listingStudioTeam.deliver).toHaveBeenCalledTimes(1);
    expect(listingStudioTeam.deliver).toHaveBeenCalledWith(taskId, expect.any(File), 4, expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(screen.queryByRole('button', { name: 'Deliver finished photo' })).not.toBeInTheDocument();
    expect(readStudioDelivery('87', taskId)).toBeNull();
  });
  it('preserves exact upload identity after a lost response and checks task status first', async () => {
    vi.mocked(listingStudioTeam.deliver).mockRejectedValueOnce(new Error('Lost response'));
    const first = view(); await screen.findByLabelText('Finished photo'); const user = userEvent.setup(); await user.upload(screen.getByLabelText('Finished photo'), image());
    await user.click(screen.getByRole('button', { name: 'Deliver finished photo' })); await screen.findByRole('button', { name: 'Check delivery status' });
    const key = vi.mocked(listingStudioTeam.deliver).mock.calls[0][3]; first.unmount(); view(); await screen.findByLabelText('Finished photo');
    expect(listingStudioTeam.deliver).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Check delivery status' }));
    expect(listingStudioTeam.deliver).toHaveBeenCalledTimes(1);
    await user.upload(screen.getByLabelText('Finished photo'), image()); await user.click(screen.getByRole('button', { name: 'Retry pending upload' }));
    await waitFor(() => expect(listingStudioTeam.deliver).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listingStudioTeam.deliver).mock.calls[1][2]).toBe(4); expect(vi.mocked(listingStudioTeam.deliver).mock.calls[1][3]).toBe(key);
  });
  it('requires fresh review after a rejected version and uses a new key for the next delivery', async () => {
    vi.mocked(listingStudioTeam.deliver).mockImplementationOnce(async () => {
      currentTask = { ...currentTask, version: 6 };
      throw { response: { status: 409, data: { code: 'version_conflict', message: 'This revision changed. Review its latest version.' } } };
    });
    view(); await screen.findByLabelText('Finished photo'); const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Finished photo'), image()); await user.click(screen.getByRole('button', { name: 'Deliver finished photo' }));
    await screen.findByText('This revision changed. Review its latest version.');
    expect(readStudioDelivery('87', taskId)).toBeNull();
    expect(screen.getByRole('button', { name: 'Deliver finished photo' })).toBeDisabled();
    const firstKey = vi.mocked(listingStudioTeam.deliver).mock.calls[0][3];
    await user.upload(screen.getByLabelText('Finished photo'), new File(['new-photo'], 'new.jpg', { type: 'image/jpeg' }));
    // jsdom does not implement File.arrayBuffer; use the same helper bytes with a fresh filename.
    await user.upload(screen.getByLabelText('Finished photo'), image());
    await user.click(screen.getByRole('button', { name: 'Deliver finished photo' }));
    await waitFor(() => expect(listingStudioTeam.deliver).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listingStudioTeam.deliver).mock.calls[1][2]).toBe(6);
    expect(vi.mocked(listingStudioTeam.deliver).mock.calls[1][3]).not.toBe(firstKey);
  });
});
