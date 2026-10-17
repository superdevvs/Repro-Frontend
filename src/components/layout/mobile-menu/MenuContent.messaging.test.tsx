import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MenuContent } from './MenuContent';
import { useMobileMenu } from './useMobileMenu';

const state = vi.hoisted(() => ({ email: 12, sms: 7, call: 3, denied: new Set<string>() }));
vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ role: 'admin', user: { secondary_roles: [] }, logout: vi.fn() }),
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ can: (resource: string) => !state.denied.has(resource), isLoading: false }),
}));
vi.mock('@/hooks/useLinkedSharedVisibility', () => ({
  useLinkedSharedVisibility: () => ({ data: { hasLinkedAccounts: false } }),
}));
vi.mock('@/hooks/useMessagingBadgeCounts', () => ({ useMessagingBadgeCounts: () => state }));

const closeMenu = vi.fn();
function Menu() {
  const { filteredItems } = useMobileMenu();
  const location = useLocation();
  return <>
    <MenuContent isMenuOpen filteredItems={filteredItems} closeMenu={closeMenu} handleLogout={vi.fn()} />
    <output data-testid="location">{location.pathname}</output>
  </>;
}
function openMenu() {
  return render(<MemoryRouter initialEntries={['/dashboard']}><Menu /></MemoryRouter>);
}
beforeEach(() => {
  Object.assign(state, { email: 12, sms: 7, call: 3 });
  state.denied.clear(); closeMenu.mockClear();
});
afterEach(cleanup);

it.each([
  ['Emails', 12, '/messaging/email/inbox'],
  ['SMS', 7, '/messaging/sms'],
  ['Calls', 3, '/calls'],
])('shows %s with its own count and closes the menu on direct navigation', (label, count, path) => {
  openMenu();
  const link = screen.getByRole('link', { name: `${label}, ${count} unread` });
  expect(link).toHaveAttribute('href', path);
  expect(link).toHaveTextContent(String(count));
  expect(screen.queryByRole('button', { name: 'Toggle submenu' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Messaging|Overview/i })).not.toBeInTheDocument();
  fireEvent.click(link);
  expect(closeMenu).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('location')).toHaveTextContent(path);
  expect(link).toHaveAttribute('aria-current', 'page');
});

it('updates each badge, hides zero counts, and caps large counts consistently with desktop', () => {
  const view = openMenu();
  Object.assign(state, { email: 0, sms: 999, call: 1000 });
  view.rerender(<MemoryRouter initialEntries={['/dashboard']}><Menu /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Emails' })).toHaveTextContent(/^Emails$/);
  expect(screen.getByRole('link', { name: 'SMS, 999 unread' })).toHaveTextContent('999');
  expect(screen.getByRole('link', { name: 'Calls, 999+ unread' })).toHaveTextContent('999+');
});

it('does not show a denied channel or its count', () => {
  state.denied.add('messaging-sms');
  openMenu();
  expect(screen.queryByRole('link', { name: /^SMS/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Emails, 12 unread' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Calls, 3 unread' })).toBeInTheDocument();
});
