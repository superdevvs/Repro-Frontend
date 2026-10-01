import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useVoicePushLifecycle } from './useVoicePushLifecycle';
const state = vi.hoisted(() => ({ authLoading: false, permissionsLoading: true, allowed: false, user: { id: '9' } as { id: string } | null, sync: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: state.user, isAuthenticated: Boolean(state.user), isImpersonating: false, isLoading: state.authLoading }) }));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: () => state.allowed, isLoading: state.permissionsLoading }) }));
vi.mock('@/services/voicePush', () => ({ syncVoicePushIdentity: state.sync }));
function Harness() { useVoicePushLifecycle(); return null; }
beforeEach(() => { state.authLoading = false; state.permissionsLoading = true; state.allowed = false; state.user = { id: '9' }; state.sync.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
it('waits for permission hydration before reconciling a saved device', async () => {
  const { rerender } = render(<Harness />);
  expect(state.sync).not.toHaveBeenCalled();
  state.permissionsLoading = false; state.allowed = true; rerender(<Harness />);
  await waitFor(() => expect(state.sync).toHaveBeenCalledWith('9', true));
  expect(state.sync).not.toHaveBeenCalledWith('9', false);
  state.allowed = false; rerender(<Harness />);
  await waitFor(() => expect(state.sync).toHaveBeenLastCalledWith('9', false));
});
it('clears device authorization when the user logs out', async () => {
  state.permissionsLoading = false; state.allowed = true;
  const { rerender } = render(<Harness />);
  state.user = null; state.allowed = false; rerender(<Harness />);
  await waitFor(() => expect(state.sync).toHaveBeenLastCalledWith(null, false));
});
