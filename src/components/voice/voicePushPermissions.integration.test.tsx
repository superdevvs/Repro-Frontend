import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PermissionsProvider, usePermissions } from '@/context/PermissionsContext';
import { useVoicePushLifecycle } from './useVoicePushLifecycle';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), sync: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({
  user: { id: '1108' }, role: 'admin', isAuthenticated: true, isLoading: false, isImpersonating: false,
}) }));
vi.mock('@/services/permissionService', () => ({ fetchCurrentUserPermissions: mocks.fetch }));
vi.mock('@/services/voicePush', () => ({ syncVoicePushIdentity: mocks.sync }));

const allowed = { permissionIds: ['voice-calls-view', 'voice-calls-operate'], permissions: [
  { resource: 'voice-calls', action: 'view' }, { resource: 'voice-calls', action: 'operate' },
] };
function Harness() {
  useVoicePushLifecycle();
  const permissions = usePermissions();
  return <button disabled={!permissions.can('voice-calls', 'operate')}>Call</button>;
}
beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.sync.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(['initial load', 'focus refresh'])('keeps an enrolled device through a failed %s and recovers on reconnect', async phase => {
  if (phase === 'focus refresh') mocks.fetch.mockResolvedValueOnce(allowed);
  else mocks.fetch.mockRejectedValueOnce(new Error('Network unavailable'));
  const { getByRole } = render(<PermissionsProvider><Harness /></PermissionsProvider>);
  await waitFor(() => expect(mocks.sync).toHaveBeenLastCalledWith('1108', true));
  if (phase === 'focus refresh') {
    mocks.fetch.mockRejectedValueOnce(new Error('Network unavailable'));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
  }
  await waitFor(() => expect((getByRole('button') as HTMLButtonElement).disabled).toBe(true));
  expect(mocks.sync).not.toHaveBeenCalledWith('1108', false);
  mocks.fetch.mockResolvedValueOnce(allowed);
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect((getByRole('button') as HTMLButtonElement).disabled).toBe(false));
  expect(mocks.sync).not.toHaveBeenCalledWith('1108', false);
  mocks.fetch.mockResolvedValueOnce({ permissionIds: [], permissions: [] });
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(mocks.sync).toHaveBeenLastCalledWith('1108', false));
});
