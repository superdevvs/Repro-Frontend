import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { UserData, UserRole } from '@/types/auth';
import { useAccountImpersonation } from './useAccountImpersonation';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: '7' } as { id: string } | null, role: 'salesRep' as UserRole, isImpersonating: false, impersonate: vi.fn() },
  navigate: vi.fn(), toast: vi.fn(),
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => mocks.auth }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer rep-token' }) }));

const target: UserData = { id: '42', name: 'Assigned client', email: 'client@example.test', role: 'client', can_impersonate: true };
const fetcher = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = { id: '7' }; mocks.auth.role = 'salesRep'; mocks.auth.isImpersonating = false;
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ ...target, id: 42 }) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('authorizes the target on the server before changing identity and navigating', async () => {
  const { result } = renderHook(useAccountImpersonation);
  await act(() => result.current(target));
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/user'), {
    headers: { Authorization: 'Bearer rep-token', 'X-Impersonate-User-Id': '42' },
  });
  expect(mocks.auth.impersonate).toHaveBeenCalledWith(target);
  expect(mocks.navigate).toHaveBeenCalledWith('/dashboard');
});

it('keeps the rep signed in if the client was reassigned after the directory loaded', async () => {
  fetcher.mockResolvedValue({ ok: false, json: async () => ({ message: 'You can only impersonate client accounts assigned to you.' }) });
  const { result } = renderHook(useAccountImpersonation);
  await act(() => result.current(target));
  expect(mocks.auth.impersonate).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: expect.stringContaining('assigned to you') }));
});

it('rejects a successful response for the original rep instead of the target client', async () => {
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ id: 7, role: 'salesRep' }) });
  const { result } = renderHook(useAccountImpersonation);
  await act(() => result.current(target));
  expect(mocks.auth.impersonate).not.toHaveBeenCalled();
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
});

it('does not request unauthorized targets', async () => {
  const { result } = renderHook(useAccountImpersonation);
  await act(() => result.current({ ...target, can_impersonate: false }));
  await act(() => result.current({ ...target, role: 'admin' }));
  expect(fetcher).not.toHaveBeenCalled();
  expect(mocks.auth.impersonate).not.toHaveBeenCalled();
});

it('ignores a late authorization after sign-in changes and prevents duplicate starts', async () => {
  let resolve!: (response: unknown) => void;
  fetcher.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result, rerender } = renderHook(useAccountImpersonation);
  const first = result.current(target);
  await result.current(target);
  expect(fetcher).toHaveBeenCalledOnce();
  mocks.auth.user = { id: '8' }; rerender();
  await act(async () => { resolve({ ok: true, json: async () => target }); await first; });
  expect(mocks.auth.impersonate).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
});

it('preserves the existing admin flow', async () => {
  mocks.auth.role = 'admin';
  const { result } = renderHook(useAccountImpersonation);
  await act(() => result.current({ ...target, can_impersonate: undefined }));
  expect(fetcher).not.toHaveBeenCalled();
  expect(mocks.auth.impersonate).toHaveBeenCalledOnce();
  expect(mocks.navigate).toHaveBeenCalledWith('/dashboard');
});
