import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import SystemMonitor from './SystemMonitor';

const auth = vi.hoisted(() => ({ role: 'superadmin', isImpersonating: false, user: { id: '42', role: 'superadmin', secondary_roles: [] as string[] } }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/features/server-monitor/OverviewWithServer', () => ({ default: () => <div>Monitor content mounted</div> }));

function Destination() {
  const location = useLocation();
  return <div>Settings destination{location.search}</div>;
}
function view() {
  return render(<MemoryRouter initialEntries={['/system-monitor?view=server']}><Routes>
    <Route path="/system-monitor" element={<SystemMonitor />} />
    <Route path="/settings" element={<Destination />} />
  </Routes></MemoryRouter>);
}
describe('System Monitor access', () => {
  afterEach(() => { cleanup(); sessionStorage.clear(); auth.role = 'superadmin'; auth.isImpersonating = false; auth.user.secondary_roles = []; });
  it('sends a locked superadmin bookmark to the Account tab', () => {
    view(); expect(screen.getByText('Settings destination?view=server&tab=account')).toBeVisible();
    expect(screen.queryByText('Monitor content mounted')).not.toBeInTheDocument();
  });
  it('preserves an unlocked bookmark and its Server view inside Settings', () => {
    sessionStorage.setItem('settings.systemOverview.unlocked:42', 'true');
    view(); expect(screen.getByText('Settings destination?view=server&tab=overview')).toBeVisible();
  });
  it('allows the existing superadmin secondary role', () => {
    sessionStorage.setItem('settings.systemOverview.unlocked:42', 'true');
    auth.role = 'photographer'; auth.user.secondary_roles = ['superadmin']; view();
    expect(screen.getByText('Settings destination?view=server&tab=overview')).toBeVisible();
  });
  it.each(['admin', 'editing_manager', 'client', 'photographer'])('rejects %s before mounting monitoring', role => {
    sessionStorage.setItem('settings.systemOverview.unlocked:42', 'true');
    auth.role = role; view();
    expect(screen.getByText('Settings destination')).toBeVisible();
    expect(screen.queryByText('Monitor content mounted')).not.toBeInTheDocument();
  });
  it('rejects monitoring during impersonation', () => {
    sessionStorage.setItem('settings.systemOverview.unlocked:42', 'true');
    auth.isImpersonating = true; view();
    expect(screen.getByText('Settings destination')).toBeVisible();
  });
});
