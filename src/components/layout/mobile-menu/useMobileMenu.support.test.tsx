import { cleanup, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMobileMenu } from './useMobileMenu';

const state = vi.hoisted(() => ({ role: 'client', denied: new Set<string>() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: state.role, user: { secondary_roles: ['admin'] }, logout: vi.fn() }) }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ can: (resource: string) => !state.denied.has(resource), isLoading: false }) }));
vi.mock('@/hooks/useLinkedSharedVisibility', () => ({ useLinkedSharedVisibility: () => ({ data: { hasLinkedAccounts: false } }) }));
beforeEach(() => { state.role = 'client'; state.denied.clear(); });
afterEach(cleanup);
function menu() { return renderHook(useMobileMenu, { wrapper: ({ children }) => <MemoryRouter initialEntries={['/messaging/email/inbox?tab=support']}>{children}</MemoryRouter> }).result.current.filteredItems; }
it.each(['client', 'photographer', 'editor', 'salesRep'])('opens support from a separate Emails tile for %s', role => {
  state.role = role; const items = menu();
  expect(items.find(item => item.label === 'Emails')).toMatchObject({ to: '/messaging/email/inbox?tab=support', isActive: true });
  expect(items.filter(item => ['Emails', 'SMS', 'Calls'].includes(item.label)).map(item => item.label)).toEqual(['Emails', 'SMS', 'Calls']);
  expect(items.some(item => item.label === 'Support' || item.label === 'Messaging')).toBe(false);
});
it.each(['admin', 'superadmin', 'editing_manager'])('retains permitted staff channel links for %s without an overview', role => {
  state.role = role; const items = menu();
  expect(items.find(item => item.label === 'Emails')).toMatchObject({ to: '/messaging/email/inbox', badgeChannel: 'email' });
  expect(items.find(item => item.label === 'SMS')).toMatchObject({ to: '/messaging/sms', badgeChannel: 'sms' });
  expect(items.find(item => item.label === 'Calls')).toMatchObject({ to: '/calls', badgeChannel: 'call' });
  expect(items.some(item => item.to === '/messaging/overview' || item.label === 'Messaging')).toBe(false);
});
it('respects custom Support denial for the support-only Emails entry', () => {
  state.denied.add('support'); expect(menu().some(item => item.label === 'Emails')).toBe(false);
});
it.each([
  ['messaging-sms', 'SMS'],
  ['voice-calls', 'Calls'],
])('respects custom %s denial for the separate %s tile', (resource, label) => {
  state.role = 'admin'; state.denied.add(resource);
  expect(menu().some(item => item.label === label)).toBe(false);
});
it('keeps the email-only staff entry when overview, SMS, calls, and support are denied', () => {
  state.role = 'admin';
  ['messaging-overview', 'messaging-sms', 'voice-calls', 'support'].forEach(resource => state.denied.add(resource));
  expect(menu().find(item => item.label === 'Emails')).toMatchObject({ to: '/messaging/email/inbox', badgeChannel: 'email' });
});
it('does not expose staff email through an overview-only grant', () => {
  state.role = 'admin'; state.denied.add('messaging-email'); state.denied.add('support');
  expect(menu().some(item => item.label === 'Emails' || item.to === '/messaging/overview')).toBe(false);
});
