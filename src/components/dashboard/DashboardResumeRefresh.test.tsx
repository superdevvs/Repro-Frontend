import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DashboardResumeRefresh } from './DashboardResumeRefresh';
import * as resume from '@/lib/dashboardResumeRefresh';
import { protectUploadFromNavigation, releaseUploadNavigationProtection } from '@/lib/uploadNavigationProtection';

const state = vi.hoisted(() => ({ auth: { isAuthenticated: true, user: { id: '901', role: 'superadmin' } }, phone: { active: null as unknown, busy: false, outgoingPhase: 'idle', session: null } }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => state.auth }));
vi.mock('@/context/BrowserPhoneContext', () => ({ useBrowserPhone: () => state.phone }));
const reload = vi.fn();
const actualWatch = resume.watchDashboardResume;
const show = (path = '/dashboard') => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[path]}><DashboardResumeRefresh /></MemoryRouter></QueryClientProvider>);
const returnAfterIdle = () => act(() => {
  vi.setSystemTime(Date.now() + resume.DASHBOARD_IDLE_REFRESH_MS);
  window.dispatchEvent(new Event('focus'));
});

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-21T03:00:00Z'));
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.spyOn(resume, 'watchDashboardResume').mockImplementation(options => actualWatch({ ...options, reload }));
  state.auth.isAuthenticated = true; state.phone.active = null;
});
afterEach(() => {
  cleanup(); releaseUploadNavigationProtection('resume-test');
  vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks();
});

it.each(['superadmin', 'admin', 'salesRep', 'editing_manager', 'editor', 'photographer', 'client'])('refreshes the dashboard for %s', role => {
  state.auth.user.role = role; show(); returnAfterIdle(); expect(reload).toHaveBeenCalledTimes(1);
});
it('does not install an idle refresh for a signed-out visitor', () => {
  state.auth.isAuthenticated = false; show(); returnAfterIdle(); expect(reload).not.toHaveBeenCalled();
});
it.each(['/book-shoot', '/ai-editing', '/messaging/email/compose', '/messaging/email/templates', '/messaging/email/automations/12'])('protects button-driven draft state in %s', path => {
  show(path); returnAfterIdle(); expect(reload).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Save any changes');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
  expect(reload).toHaveBeenCalledTimes(1);
});
it('does not refresh if the person cancels the unsaved-work confirmation', () => {
  show('/book-shoot'); returnAfterIdle(); vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' })); expect(reload).not.toHaveBeenCalled();
});
it('disables explicit refresh during a registered upload', () => {
  act(() => protectUploadFromNavigation('resume-test')); show(); returnAfterIdle();
  expect(screen.getByRole('button', { name: 'Refresh dashboard' })).toBeDisabled(); expect(reload).not.toHaveBeenCalled();
});
it('preserves an active phone call', () => {
  state.phone.active = { state: 'active' }; show(); returnAfterIdle();
  expect(screen.getByRole('button', { name: 'Refresh dashboard' })).toBeDisabled(); expect(reload).not.toHaveBeenCalled();
});
import '@testing-library/jest-dom/vitest';
