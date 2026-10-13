import type { ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { useShootFiles } from './useShootFiles';

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ session: { accessToken: 'local-fixture' }, user: { id: 10, role: 'client' }, isImpersonating: false }) }));
vi.mock('@/services/api', () => ({ getImpersonatedUserId: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('requests hidden restore rows only for curation and keeps the filtered download consumer cache separate', async () => {
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => ({ data: new URL(url, 'http://fixture.test').searchParams.get('include_hidden') === '1'
    ? [{ id: 11, filename: 'hidden.jpg', is_hidden: true, can_manage_visibility: true, can_set_hero: false }]
    : [{ id: 12, filename: 'visible.jpg', is_hidden: false }] }) }));
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => ({ curation: useShootFiles(156, 'edited', { includeHidden: true }), download: useShootFiles(156, 'edited') }), { wrapper });
  await waitFor(() => expect(result.current.curation.isSuccess && result.current.download.isSuccess).toBe(true));
  expect(result.current.curation.data?.[0]).toMatchObject({ id: '11', is_hidden: true, can_manage_visibility: true, can_set_hero: false });
  expect(result.current.download.data?.[0]).toMatchObject({ id: '12', is_hidden: false });
  expect(fetchMock.mock.calls.map(([url]) => new URL(url, 'http://fixture.test').searchParams.get('include_hidden')).sort()).toEqual([null, '1'].sort());
  expect(queryClient.getQueryCache().getAll()).toHaveLength(2);
  queryClient.clear();
});
