import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SystemMonitor from './SystemMonitor';

const auth = vi.hoisted(() => ({ role: 'superadmin', isImpersonating: false, user: { role: 'superadmin', secondary_roles: [] as string[] } }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/features/server-monitor/OverviewWithServer', () => ({ default: () => <div>Monitor content mounted</div> }));

function view() {
  return render(<MemoryRouter initialEntries={['/system-monitor']}><Routes>
    <Route path="/system-monitor" element={<SystemMonitor />} />
    <Route path="/settings" element={<div>Settings destination</div>} />
  </Routes></MemoryRouter>);
}
describe('System Monitor access', () => {
  afterEach(() => { cleanup(); auth.role = 'superadmin'; auth.isImpersonating = false; auth.user.secondary_roles = []; });
  it('allows a superadmin and exposes a Settings return link', () => {
    view(); expect(screen.getByText('Monitor content mounted')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });
  it('allows the existing superadmin secondary role', () => {
    auth.role = 'photographer'; auth.user.secondary_roles = ['superadmin']; view();
    expect(screen.getByText('Monitor content mounted')).toBeVisible();
  });
  it.each(['admin', 'editing_manager', 'client', 'photographer'])('rejects %s before mounting monitoring', role => {
    auth.role = role; view();
    expect(screen.getByText('Settings destination')).toBeVisible();
    expect(screen.queryByText('Monitor content mounted')).not.toBeInTheDocument();
  });
  it('rejects monitoring during impersonation', () => {
    auth.isImpersonating = true; view();
    expect(screen.getByText('Settings destination')).toBeVisible();
  });
});
