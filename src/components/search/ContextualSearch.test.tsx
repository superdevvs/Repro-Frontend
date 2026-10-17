import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContextualSearchProvider } from './ContextualSearchProvider';
import { PageSearch } from './PageSearch';
import { GlobalCommandBar } from './GlobalCommandBar';
import { pageSearchResults } from './pageSearchResults';
import { accountMatchesSearch } from './accountMatchesSearch';

const api = vi.hoisted(() => ({
  scopes: vi.fn(async () => ({ enabled: true, scopes: [{ id: 'accounts', label: 'Accounts' }, { id: 'shoots', label: 'Shoots' }] })),
  search: vi.fn(async () => ({ groups: [] })), preview: vi.fn(async () => ({ type: 'accounts', id: '42', title: 'Acme Agent', destination: '/accounts?account=42', metadata: { Company: 'Acme Realty', Phone: '+1 (202) 555-0137' } })),
}));
vi.mock('@/services/contextualSearch', () => ({ contextualSearch: api }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '1' }, role: 'admin', isAuthenticated: true }) }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissionIds: ['accounts-view'] }) }));
vi.mock('@/services/api', () => ({ getImpersonatedUserId: () => null }));

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

function Workspace() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState('accounts');
  const location = useLocation();
  const records = [{ id: '42', name: 'Acme Agent', email: 'agent@example.test', company: 'Acme Realty', role: 'client', phone: '+1 (202) 555-0137' }, { id: '43', name: 'Other Agent', email: 'other@example.test' }];
  const filtered = records.filter(row => accountMatchesSearch(row, query));
  return <>
    <button onClick={() => setOpen(true)}>Open search</button>
    <button onClick={() => setTab(tab === 'accounts' ? 'inactive' : 'accounts')}>Switch workspace</button>
    <PageSearch searchId={tab} scope="accounts" scopeLabel={tab === 'accounts' ? 'Accounts' : 'Inactive clients'} value={query} onChange={event => setQuery(event.target.value)}
      placeholder="Legacy accounts search" searchResults={pageSearchResults(filtered, 'accounts', '/accounts?account={id}')} />
    <output data-testid="page-query">{query}</output><output data-testid="page-count">{filtered.length}</output><output data-testid="location">{location.search}</output>
    <GlobalCommandBar open={open} onOpenChange={setOpen} />
  </>;
}
function setup(initial = '/accounts?role=client') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[initial]}><ContextualSearchProvider><Workspace /></ContextualSearchProvider></MemoryRouter></QueryClientProvider>);
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('contextual header and page integration', () => {
  it('live filters the page, preserves its filters, and restores results when cleared', async () => {
    const user = userEvent.setup(); setup();
    const input = await screen.findByPlaceholderText('Search accounts…');
    expect(screen.queryByPlaceholderText('Legacy accounts search')).toBeNull();
    await user.type(input, 'Acme');
    await waitFor(() => expect(screen.getByTestId('page-query').textContent).toBe('Acme'));
    expect(screen.getByTestId('page-count').textContent).toBe('1');
    expect(screen.getByTestId('location').textContent).toContain('role=client');
    expect(screen.getByTestId('location').textContent).toContain('searchContext=accounts');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByTestId('page-count').textContent).toBe('2');
    expect(screen.getByTestId('location').textContent).not.toContain('search=');
  });

  it('shows permitted details in a read-only preview without opening a record', async () => {
    const user = userEvent.setup(); setup();
    await user.type(await screen.findByPlaceholderText('Search accounts…'), 'Acme');
    await user.click(await screen.findByRole('button', { name: 'Preview Acme Agent' }));
    expect(screen.getByRole('region', { name: 'Preview Acme Agent' })).toBeTruthy();
    expect(screen.getByText('+1 (202) 555-0137')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).not.toContain('account=');
    await waitFor(() => expect(api.preview).toHaveBeenCalledWith('accounts', '42', 'Acme', {}, expect.any(AbortSignal)));
  });

  it('keeps an Everywhere query separate from the applied page filter', async () => {
    const user = userEvent.setup(); setup();
    await user.type(await screen.findByPlaceholderText('Search accounts…'), 'Acme');
    await user.click(screen.getByRole('button', { name: 'Everywhere' }));
    const global = await screen.findByPlaceholderText('Search everywhere…');
    await user.clear(global); await user.type(global, 'Lane');
    expect(screen.getByTestId('page-query').textContent).toBe('Acme');
    await waitFor(() => expect(api.search).toHaveBeenCalledWith('everywhere', 'Lane', {}, 1, expect.any(AbortSignal)));
    await user.click(screen.getByRole('button', { name: 'Search Accounts' }));
    expect((screen.getByPlaceholderText('Search accounts…') as HTMLInputElement).value).toBe('Acme');
  });

  it('restores URL queries without removing deep-link parameters', async () => {
    setup('/accounts?role=client&search=Acme&searchContext=accounts&account=42');
    await screen.findByPlaceholderText('Search accounts…');
    await waitFor(() => expect(screen.getByTestId('page-query').textContent).toBe('Acme'));
    expect(screen.getByTestId('location').textContent).toContain('account=42');
  });

  it('retains legacy inputs while the feature is disabled', async () => {
    api.scopes.mockResolvedValueOnce({ enabled: false, scopes: [] });
    // Do not open the legacy palette, whose separately tested providers are unrelated here.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><ContextualSearchProvider><PageSearch searchId="accounts" scope="accounts" scopeLabel="Accounts" value="" onChange={() => {}} placeholder="Legacy input" /></ContextualSearchProvider></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByPlaceholderText('Legacy input')).toBeTruthy();
  });
});

describe('account matching parity', () => {
  const account = { id: '42', name: 'Acme Agent', email: 'test@example.test', company: 'Example Realty', phone: '+1 (202) 555-0137' };
  it.each(['ACME', 'example.test', 'Realty', '00042', '2025550137', '+1 (202)'])('matches %s', query => {
    expect(accountMatchesSearch(account, query)).toBe(true);
  });
  it('does not treat wildcard characters as arbitrary matches', () => { expect(accountMatchesSearch(account, '%')).toBe(false); });
});
