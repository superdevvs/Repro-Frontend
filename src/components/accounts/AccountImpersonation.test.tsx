import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserData, UserRole } from '@/types/auth';
import { AccountList } from './AccountList';
import { AccountCard } from './AccountCard';

const auth = vi.hoisted(() => ({ role: 'salesRep' as UserRole }));
vi.mock('@/components/auth', () => ({ useAuth: () => auth }));

const client: UserData = { id: '42', name: 'Assigned client', email: 'client@example.test', role: 'client', can_impersonate: true };
const callbacks = {
  onEdit: vi.fn(), onAssignRep: vi.fn(), onChangeRole: vi.fn(), onResetPassword: vi.fn(),
  onImpersonate: vi.fn(), onManageNotifications: vi.fn(), onLinkClientBranding: vi.fn(),
  onViewProfile: vi.fn(), onDeleteUser: vi.fn(),
};

beforeEach(() => { auth.role = 'salesRep'; vi.clearAllMocks(); });
afterEach(cleanup);

describe.each(['list', 'grid'] as const)('%s impersonation actions', (view) => {
  async function open(target = client) {
    render(view === 'list'
      ? <AccountList users={[target]} sort={null} onColumnSort={vi.fn()} {...callbacks} />
      : <AccountCard user={target} {...callbacks} />);
    await userEvent.click(screen.getByRole('button', { name: `Actions for ${target.name}` }));
  }

  it('lets a rep open an authorized client without exposing account administration', async () => {
    await open();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Login as User' }));
    expect(callbacks.onImpersonate).toHaveBeenCalledWith(client);
    expect(callbacks.onViewProfile).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: `Actions for ${client.name}` }));
    expect(screen.queryByRole('menuitem', { name: 'Reset Password' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Notification Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Change Role' })).not.toBeInTheDocument();
  });

  it.each([false, undefined])('hides Login as User when the server capability is %s', async (can_impersonate) => {
    await open({ ...client, can_impersonate });
    expect(screen.queryByRole('menuitem', { name: 'Login as User' })).not.toBeInTheDocument();
  });

  it('does not expose staff impersonation to reps even with a stale capability', async () => {
    await open({ ...client, role: 'photographer' });
    expect(screen.queryByRole('menuitem', { name: 'Login as User' })).not.toBeInTheDocument();
  });

  it.each(['admin', 'superadmin'] as const)('preserves %s impersonation', async (role) => {
    auth.role = role;
    await open({ ...client, can_impersonate: undefined, role: 'photographer' });
    expect(screen.getByRole('menuitem', { name: 'Login as User' })).toBeVisible();
  });

  it('does not grant impersonation to editing managers', async () => {
    auth.role = 'editing_manager';
    await open();
    expect(screen.queryByRole('menuitem', { name: 'Login as User' })).not.toBeInTheDocument();
  });
});
