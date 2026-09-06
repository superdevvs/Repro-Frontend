import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsProvider, usePermissions } from './PermissionsContext';

const mocks = vi.hoisted(() => ({
  auth: { role: 'client', user: { id: '1' }, isAuthenticated: true, isLoading: false },
  fetch: vi.fn(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/services/permissionService', () => ({ fetchCurrentUserPermissions: mocks.fetch }));

describe('Studio client rollout', () => {
  beforeEach(() => {
    mocks.auth.role = 'client';
    mocks.fetch.mockReset().mockResolvedValue({
      permissionIds: ['ai-editing.view', 'ai-editing.create', 'shoots.view'],
      permissions: [
        { id: 'ai-editing.view', resource: 'ai-editing', action: 'view' },
        { id: 'ai-editing.create', resource: 'ai-editing', action: 'create' },
        { id: 'shoots.view', resource: 'shoots', action: 'view' },
      ],
    });
  });

  it('hides all Studio actions for clients even with previously granted permissions', async () => {
    const { result } = renderHook(() => usePermissions(), { wrapper: PermissionsProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.can('ai-editing', 'view')).toBe(false);
    expect(result.current.can('ai-editing', 'create')).toBe(false);
    expect(result.current.can('shoots', 'view')).toBe(true);
  });

  it.each(['admin', 'superadmin', 'editing_manager', 'editor'])('retains existing %s Studio access', async role => {
    mocks.auth.role = role;
    const { result } = renderHook(() => usePermissions(), { wrapper: PermissionsProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.can('ai-editing', 'view')).toBe(true);
  });
});
