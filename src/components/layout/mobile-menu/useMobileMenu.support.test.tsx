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
function menu() { return renderHook(useMobileMenu, { wrapper: ({ children }) => <MemoryRouter initialEntries={['/messaging/email/inbox?tab=support']}>{children}</MemoryRouter> }).result.current.filteredItems.find(item => item.label === 'Messaging'); }
it.each(['client', 'photographer', 'editor', 'salesRep'])('makes Support the %s Messaging destination without an Emails subitem', role => {
  state.role = role; const item = menu(); expect(item?.to).toBe('/messaging/email/inbox?tab=support');
  expect(item?.subItems?.map(link => link.label)).toEqual(['SMS', 'Calls', 'Support']);
  expect(item?.subItems?.find(link => link.label === 'Support')?.isActive).toBe(true);
});
it.each(['admin', 'editing_manager'])('retains permitted staff Messaging links for %s', role => {
  state.role = role; expect(menu()?.subItems?.map(link => link.label)).toEqual(['Emails', 'SMS', 'Calls', 'Support']);
});
it('respects custom Support denial rather than making the support link unconditional', () => {
  state.denied.add('support'); expect(menu()?.subItems?.some(link => link.label === 'Support')).toBe(false);
});
