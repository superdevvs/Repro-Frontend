import type { ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useShoot } from './useShoot';

const auth = vi.hoisted(() => ({
  user: { id: '1', role: 'admin' }, role: 'admin', isImpersonating: false,
  originalUser: null as { id: string } | null, impersonatedUserId: null as string | null,
  session: { accessToken: 'actor-token' },
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/api', () => ({ getImpersonatedUserId: () => auth.impersonatedUserId }));
vi.mock('@/context/shootNormalization', () => ({ transformShootFromApi: (value: unknown) => value }));

const clients: QueryClient[] = [];
beforeEach(() => {
  localStorage.clear();
  Object.assign(auth, { user: { id: '1', role: 'admin' }, role: 'admin', isImpersonating: false, originalUser: null, impersonatedUserId: null });
});
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.unstubAllGlobals(); });

it('refetches actor-specific file grants and sends the impersonated account header', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ data: { id: 5963, files: [{ id: 'video', can_download: true }] } }))
    .mockResolvedValueOnce(Response.json({ data: { id: 5963, files: [{ id: 'video', can_download: false, download_unavailable_reason: 'content_not_finalized' }] } }));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender } = renderHook(() => useShoot(5963), { wrapper });
  await waitFor(() => expect(result.current.data?.files?.[0].can_download).toBe(true));
  Object.assign(auth, { user: { id: '2475', role: 'client' }, role: 'client', isImpersonating: true, originalUser: { id: '1' }, impersonatedUserId: '2475' });
  rerender();
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.data?.files?.[0].can_download).toBe(false));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ Authorization: 'Bearer actor-token', 'X-Impersonate-User-Id': '2475' });
  expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Impersonate-User-Id');
  expect(client.getQueryCache().getAll()).toHaveLength(2);
});

it('does not reuse another signed-in customer’s fresh capabilities', async () => {
  Object.assign(auth, { user: { id: '2475', role: 'client' }, role: 'client' });
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ data: { id: 5963, files: [{ id: 'video', can_download: true }] } }))
    .mockResolvedValueOnce(Response.json({ data: { id: 5963, files: [] } }));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender } = renderHook(() => useShoot(5963), { wrapper });
  await waitFor(() => expect(result.current.data?.files).toHaveLength(1));
  auth.user = { id: 'other-client', role: 'client' };
  rerender();
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.data?.files).toEqual([]));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
