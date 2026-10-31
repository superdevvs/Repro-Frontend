import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import fixture from '@/components/listing-studio/client/studioFixtures.test-data.json';
import { listingStudioClient } from '@/services/listingStudioClientService';
import { listingStudioStaff } from '@/services/listingStudioStaffService';
import { useStudioAccount } from './useStudioAccount';

const auth = vi.hoisted(() => ({ user: { id: 42, role: 'client', isActive: true }, isAuthenticated: true, isLoading: false, isImpersonating: false }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/listingStudioClientService', () => ({ listingStudioClient: { account: vi.fn() } }));
vi.mock('@/services/listingStudioStaffService', () => ({ listingStudioStaff: { account: vi.fn() } }));
const clients: QueryClient[] = [];
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return { client, Wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 42, role: 'client', isActive: true }; auth.isAuthenticated = true; auth.isLoading = false; auth.isImpersonating = false;
  vi.mocked(listingStudioClient.account).mockResolvedValue(fixture.account as Awaited<ReturnType<typeof listingStudioClient.account>>);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('shared Studio account query', () => {
  it('shares one balance request between the page and sidebar', async () => {
    const { client, Wrapper } = wrapper();
    const hook = renderHook(() => [useStudioAccount(), useStudioAccount()], { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current[0].data).toBeTruthy());
    expect(listingStudioClient.account).toHaveBeenCalledOnce();
    expect(client.getQueryData(['studio-client', '42', 'account'])).toEqual(fixture.account);
    expect(listingStudioClient.account).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it('uses actor and client identity for delegated balances and never calls the personal endpoint', async () => {
    auth.user.role = 'salesRep';
    const managed = { ...fixture.account, client: { id: '81', name: 'Jane', email: 'jane@example.test' }, management: { canPurchase: true, canManageSubscription: false } };
    vi.mocked(listingStudioStaff.account).mockResolvedValue(managed as Awaited<ReturnType<typeof listingStudioStaff.account>>);
    const { client, Wrapper } = wrapper();
    const hook = renderHook(() => useStudioAccount('81'), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data).toBeTruthy());
    expect(listingStudioStaff.account).toHaveBeenCalledWith('81', expect.any(AbortSignal));
    expect(listingStudioClient.account).not.toHaveBeenCalled();
    expect(client.getQueryData(['studio-managed-client', '42', '81', 'account'])).toEqual(managed);
  });
  it('masks cached financial data immediately when impersonation begins', async () => {
    const { Wrapper } = wrapper();
    const hook = renderHook(() => useStudioAccount(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data).toBeTruthy());
    auth.isImpersonating = true; hook.rerender();
    expect(hook.result.current.data).toBeUndefined();
    expect(hook.result.current.eligible).toBe(false);
    expect(listingStudioClient.account).toHaveBeenCalledOnce();
  });
  it('masks a loaded balance immediately when the account becomes inactive', async () => {
    const { Wrapper } = wrapper();
    const hook = renderHook(() => useStudioAccount(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data).toBeTruthy());
    auth.user.isActive = false; hook.rerender();
    expect(hook.result.current.data).toBeUndefined();
    expect(hook.result.current.eligible).toBe(false);
    expect(listingStudioClient.account).toHaveBeenCalledOnce();
  });
  it('does not carry a previous client balance into another account while it loads', async () => {
    const { Wrapper } = wrapper();
    const hook = renderHook(() => useStudioAccount(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data).toBeTruthy());
    vi.mocked(listingStudioClient.account).mockImplementationOnce(() => new Promise(() => undefined));
    auth.user = { id: 99, role: 'client', isActive: true }; hook.rerender();
    expect(hook.result.current.data).toBeUndefined();
    await waitFor(() => expect(listingStudioClient.account).toHaveBeenCalledTimes(2));
  });
  it('stops interval polling while hidden and resumes at 30 seconds when visible', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { Wrapper } = wrapper();
    const hook = renderHook(() => useStudioAccount(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data).toBeTruthy());
    vi.useFakeTimers();
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(listingStudioClient.account).toHaveBeenCalledOnce();
    await act(async () => { visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange')); });
    const callsOnFocus = vi.mocked(listingStudioClient.account).mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(listingStudioClient.account).toHaveBeenCalledTimes(callsOnFocus + 1);
  });
});

