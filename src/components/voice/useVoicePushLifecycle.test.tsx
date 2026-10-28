import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useVoicePushLifecycle } from './useVoicePushLifecycle';
const state = vi.hoisted(() => ({ authLoading: false, permissionsLoading: true, permissionsUnavailable: false, impersonating: false, allowed: false, user: { id: '9' } as { id: string } | null, sync: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: state.user, isAuthenticated: Boolean(state.user), isImpersonating: state.impersonating, isLoading: state.authLoading }) }));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: () => state.allowed, isLoading: state.permissionsLoading, hasError: state.permissionsUnavailable }) }));
vi.mock('@/services/voicePush', () => ({ syncVoicePushIdentity: state.sync }));
function Harness() { useVoicePushLifecycle(); return null; }
beforeEach(() => { state.authLoading = false; state.permissionsLoading = true; state.permissionsUnavailable = false; state.impersonating = false; state.allowed = false; state.user = { id: '9' }; state.sync.mockReset().mockResolvedValue(undefined); });
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
it('preserves enrollment on a failed permission lookup but honors a confirmed denial', async () => {
  state.permissionsLoading = false; state.permissionsUnavailable = true;
  const { rerender } = render(<Harness />);
  await waitFor(() => expect(state.sync).toHaveBeenLastCalledWith('9', true));
  expect(state.sync).not.toHaveBeenCalledWith('9', false);
  state.permissionsUnavailable = false; rerender(<Harness />);
  await waitFor(() => expect(state.sync).toHaveBeenLastCalledWith('9', false));
});
it.each(['logout', 'impersonation'])('clears enrollment during permission loading on %s', async mode => {
  state.permissionsLoading = true; state.permissionsUnavailable = true;
  if (mode === 'logout') state.user = null;
  else state.impersonating = true;
  render(<Harness />);
  await waitFor(() => expect(state.sync).toHaveBeenLastCalledWith(null, false));
});
it('reconciles the new identity even when its permissions are unavailable', async () => {
  state.permissionsLoading = false; state.allowed = true;
  const { rerender } = render(<Harness />);
  state.user = { id: '10' }; state.allowed = false; state.permissionsUnavailable = true;
  rerender(<Harness />);
  await waitFor(() => expect(state.sync).toHaveBeenLastCalledWith('10', true));
});
