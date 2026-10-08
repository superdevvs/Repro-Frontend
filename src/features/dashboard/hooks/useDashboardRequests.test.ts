import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDashboardRequests } from './useDashboardRequests';

const params = {
  location: { pathname: '/dashboard', search: '', hash: '', state: null, key: 'test' },
  navigate: vi.fn(),
  openModal: vi.fn(),
  openShootInModalById: vi.fn(async () => 'opened' as const),
  registerShootOpenHandler: vi.fn(),
  removeRequest: vi.fn(),
  toast: vi.fn(),
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('client request reviewer identity', () => {
  it('loads the rep queue and discards a late admin response after impersonation', async () => {
    let finishAdmin!: (response: unknown) => void;
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finishAdmin = resolve; }))
      .mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: '9', shootId: 9, note: 'Rep client', status: 'open' }] }) }));
    const { result, rerender } = renderHook(({ viewerScope }) => useDashboardRequests({ ...params, canViewDashboardClientRequests: true, viewerScope }), { initialProps: { viewerScope: 'admin:1' } });
    rerender({ viewerScope: 'salesRep:9' });
    await waitFor(() => expect(result.current.clientRequests.map((request) => request.id)).toEqual(['9']));
    await act(async () => finishAdmin({ ok: true, json: async () => ({ data: [{ id: '100', note: 'Other client' }] }) }));
    expect(result.current.clientRequests.map((request) => request.id)).toEqual(['9']);
  });
});


it.each(['verified', 'completed', 'todo'])('opens a requested %s photo in its own media lane', async (workflowStage) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }));
  renderHook(() => useDashboardRequests({ ...params, canViewDashboardClientRequests: true, viewerScope: 'editor:9' }));
  const handler = (params.registerShootOpenHandler.mock.calls as unknown as Array<[(request: unknown) => Promise<unknown>]>).at(-1)![0];
  await act(async () => { await handler({ id: 'request-1', shootId: 42, mediaFiles: [{ id: '1', workflowStage }] }); });
  expect(params.openShootInModalById).toHaveBeenCalledWith(42, expect.objectContaining({ initialTab: 'issues', initialMediaDisplayTab: workflowStage === 'todo' ? 'uploaded' : 'edited' }));
});
