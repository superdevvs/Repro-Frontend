import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserPermissionOverridesResponse } from '@/types/permissions';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  can: vi.fn(() => true),
  fetchConfig: vi.fn(),
  fetchUsers: vi.fn(),
  fetchOverrides: vi.fn(),
  updateOverrides: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ can: mocks.can }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '1', role: 'superadmin' } }) }));
vi.mock('@/services/permissionService', () => ({
  fetchAdminPermissionsConfig: mocks.fetchConfig,
  fetchPermissionUsers: mocks.fetchUsers,
  fetchUserPermissionOverrides: mocks.fetchOverrides,
  updateUserPermissionOverrides: mocks.updateOverrides,
}));

import { UserPermissionOverridesManager } from './UserPermissionOverridesManager';

const catalog = [
  {
    id: 'core-navigation',
    label: 'Core Navigation',
    description: 'Primary pages.',
    permissions: [
      { id: 'dashboard-view', resource: 'dashboard', action: 'view', label: 'Dashboard', description: 'Open the dashboard.', defaultRoles: ['admin'] },
      { id: 'accounting-view', resource: 'accounting', action: 'view', label: 'Accounting / Billing', description: 'Access accounting.', defaultRoles: ['admin'] },
      { id: 'watermark-settings-view', resource: 'watermark-settings', action: 'view', label: 'Watermark Settings', description: 'Open watermark settings.', defaultRoles: ['superadmin'] },
    ],
  },
];

const roles = [
  { id: 'superadmin', label: 'Super Admin', description: '', locked: true },
  { id: 'admin', label: 'Admin', description: '', locked: false },
];

const detailFor = (overrides: { allow: string[]; deny: string[] }): UserPermissionOverridesResponse => {
  const baseline = ['dashboard-view', 'accounting-view'];
  const effective = [...baseline.filter((id) => !overrides.deny.includes(id)), ...overrides.allow];
  return {
    user: { id: 7, name: 'Restricted Admin', email: 'ops@example.test', role: 'admin', secondaryRoles: [], locked: false },
    roleBaseline: baseline,
    overrides,
    effective,
  };
};

describe('UserPermissionOverridesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Radix ScrollArea needs ResizeObserver, which jsdom lacks.
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    mocks.can.mockReturnValue(true);
    mocks.fetchConfig.mockResolvedValue({ roles, catalog, permissions: {}, defaults: {} });
    mocks.fetchUsers.mockResolvedValue({
      users: [
        { id: 7, name: 'Restricted Admin', email: 'ops@example.test', role: 'admin', secondaryRoles: [], locked: false, overrideCount: 0 },
        { id: 1, name: 'Primary Super', email: 'aj@example.test', role: 'superadmin', secondaryRoles: [], locked: true, overrideCount: 0 },
      ],
    });
    mocks.fetchOverrides.mockResolvedValue(detailFor({ allow: [], deny: [] }));
    mocks.updateOverrides.mockImplementation(async (_id: number, overrides: { allow: string[]; deny: string[] }) =>
      detailFor(overrides),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('denies accounting for one admin and saves allow/deny lists', async () => {
    const user = userEvent.setup();
    render(<UserPermissionOverridesManager initialUserId={7} />);

    await waitFor(() => expect(mocks.fetchOverrides).toHaveBeenCalledWith('7', expect.anything()));
    await screen.findByText('ops@example.test', { selector: 'p.text-sm' });

    const accountingGroup = await screen.findByRole('radiogroup', { name: 'Accounting / Billing override' });
    expect(within(accountingGroup).getByRole('radio', { name: 'Inherit Accounting / Billing' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByText('On via Admin')).toHaveLength(2);

    await user.click(within(accountingGroup).getByRole('radio', { name: 'Deny Accounting / Billing' }));
    expect(screen.getByText('Off (override)')).toBeInTheDocument();

    const watermarkGroup = screen.getByRole('radiogroup', { name: 'Watermark Settings override' });
    await user.click(within(watermarkGroup).getByRole('radio', { name: 'Allow Watermark Settings' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mocks.updateOverrides).toHaveBeenCalledWith(7, {
        allow: ['watermark-settings-view'],
        deny: ['accounting-view'],
      }),
    );
    await screen.findByText('2 overrides');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'User permissions saved' }));
  });

  it('clear overrides resets every permission back to inherit before saving', async () => {
    const user = userEvent.setup();
    mocks.fetchOverrides.mockResolvedValue(detailFor({ allow: [], deny: ['accounting-view'] }));
    render(<UserPermissionOverridesManager initialUserId={7} />);

    const accountingGroup = await screen.findByRole('radiogroup', { name: 'Accounting / Billing override' });
    expect(within(accountingGroup).getByRole('radio', { name: 'Deny Accounting / Billing' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: 'Clear overrides' }));
    expect(within(accountingGroup).getByRole('radio', { name: 'Inherit Accounting / Billing' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.updateOverrides).toHaveBeenCalledWith(7, { allow: [], deny: [] }));
  });

  it('locks the editor for superadmin accounts and read-only viewers', async () => {
    const user = userEvent.setup();
    mocks.fetchOverrides.mockResolvedValue({
      ...detailFor({ allow: [], deny: [] }),
      user: { id: 1, name: 'Primary Super', email: 'aj@example.test', role: 'superadmin', secondaryRoles: [], locked: true },
    });
    render(<UserPermissionOverridesManager initialUserId={1} />);

    await screen.findByText(/Super Admin accounts always keep every permission/);
    const accountingGroup = screen.getByRole('radiogroup', { name: 'Accounting / Billing override' });
    expect(within(accountingGroup).getByRole('radio', { name: 'Deny Accounting / Billing' })).toBeDisabled();

    cleanup();
    mocks.can.mockReturnValue(false);
    mocks.fetchOverrides.mockResolvedValue(detailFor({ allow: [], deny: [] }));
    render(<UserPermissionOverridesManager initialUserId={7} />);

    const group = await screen.findByRole('radiogroup', { name: 'Accounting / Billing override' });
    const deny = within(group).getByRole('radio', { name: 'Deny Accounting / Billing' });
    expect(deny).toBeDisabled();
    await user.click(deny);
    expect(mocks.updateOverrides).not.toHaveBeenCalled();
  });
});
