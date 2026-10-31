import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import fixture from '../client/studioFixtures.test-data.json';
import type { StudioCatalog } from '@/types/listingStudioClient';
import { listingStudioService } from '@/services/listingStudioService';
import { listingStudioStaff } from '@/services/listingStudioStaffService';
import { StudioPricingOverview } from './StudioPricingOverview';

vi.mock('@/services/listingStudioService', () => ({ listingStudioService: { catalog: vi.fn() } }));
vi.mock('@/services/listingStudioStaffService', () => ({ listingStudioStaff: { clients: vi.fn() } }));
const view = (role = 'admin', path = '/listing-studio/manage') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><MemoryRouter initialEntries={[path]}><StudioPricingOverview actorId="9" role={role} /></MemoryRouter></QueryClientProvider>);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listingStudioService.catalog).mockResolvedValue({ plans: [], services: [], billing: fixture.catalog as StudioCatalog });
  vi.mocked(listingStudioStaff.clients).mockResolvedValue({ clients: [{ id: '42', name: 'Jane Client', email: 'jane@example.test' }], pagination: { page: 1, perPage: 20, total: 1, hasMore: false } });
});
afterEach(cleanup);

describe('staff Studio pricing overview', () => {
  it('opens the selector directly from Change client and preserves its tab in legacy tools', async () => {
    view('superadmin', '/listing-studio/manage?tab=clients');
    expect(await screen.findByLabelText('Find an active client')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Jane Client/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Client accounts' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('link', { name: 'Requests' })).toHaveAttribute('href', '/listing-studio/manage?tab=clients&listingStudio=1&listingStudioTab=requests');
    await userEvent.click(screen.getByRole('tab', { name: 'Plans & pricing' }));
    expect(await screen.findByRole('heading', { name: 'Monthly client plans' })).toBeInTheDocument();
  });
  it('ignores a delegated client-tab URL for primary admin without requesting client data', async () => {
    view('admin', '/listing-studio/manage?tab=clients');
    expect(await screen.findByRole('heading', { name: 'Monthly client plans' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Find an active client')).not.toBeInTheDocument();
    expect(listingStudioStaff.clients).not.toHaveBeenCalled();
  });
  it('gives primary admin read-only canonical pricing and its existing internal editor', async () => {
    view();
    expect(await screen.findByRole('heading', { name: 'Monthly client plans' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pay per photo' })).toBeInTheDocument();
    expect(screen.getByText('Staff editing doesn’t use client credits.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open editor' })).toHaveAttribute('href', '/ai-editing');
    expect(screen.getByRole('link', { name: 'Requests' })).toHaveAttribute('href', '/listing-studio/manage?listingStudio=1&listingStudioTab=requests');
    expect(screen.getByRole('link', { name: 'Subscriptions' })).toHaveAttribute('href', '/listing-studio/manage?listingStudio=1&listingStudioTab=subscriptions');
    expect(screen.queryByRole('button', { name: 'Choose a client' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Client accounts' })).not.toBeInTheDocument();
    expect(listingStudioStaff.clients).not.toHaveBeenCalled();
  });
  it.each(['superadmin', 'salesRep'])('opens the explicit client directory only after primary %s chooses it', async role => {
    view(role);
    await screen.findByRole('heading', { name: 'Monthly client plans' });
    expect(listingStudioStaff.clients).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Choose a client' })[0]);
    expect(await screen.findByRole('link', { name: /Jane Client/ })).toHaveAttribute('href', '/listing-studio/manage/42');
    if (role === 'salesRep') expect(screen.queryByRole('link', { name: 'Open editor' })).not.toBeInTheDocument();
  });
  it('renders server prices and credits without introducing a second price list', async () => {
    const catalog = structuredClone(fixture.catalog) as StudioCatalog;
    catalog.plans[0].monthlyPriceCents = 5012; catalog.plans[0].monthlyCreditCents = 7311; catalog.services[0].aiPriceCents = 1605;
    vi.mocked(listingStudioService.catalog).mockResolvedValue({ plans: [], services: [], billing: catalog });
    view();
    expect(await screen.findByText('$50.12')).toBeInTheDocument();
    expect(screen.getByText('$73.11', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('$16.05', { exact: false })).toBeInTheDocument();
  });
  it('handles a missing canonical catalog without inventing pricing or client access', async () => {
    vi.mocked(listingStudioService.catalog).mockResolvedValue({ plans: [], services: [] });
    view();
    expect(await screen.findByRole('alert')).toHaveTextContent('Pricing is temporarily unavailable');
    expect(screen.queryByRole('heading', { name: 'Starter' })).not.toBeInTheDocument();
    expect(listingStudioStaff.clients).not.toHaveBeenCalled();
  });
});
