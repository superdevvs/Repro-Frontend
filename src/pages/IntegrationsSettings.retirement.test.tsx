import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { IntegrationsSettingsContent } from './IntegrationsSettings';
import Integrations from './Integrations';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: { get: mocks.get, post: mocks.post } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: () => null }));
vi.mock('@/components/settings/AddressLookupTester', () => ({ AddressLookupTester: () => null }));

describe('remaining integration settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ data: { success: true, data: { value: {} } } });
  });
  afterEach(cleanup);

  it('preserves the five other provider tabs without a Dropbox connection surface or request', async () => {
    render(<MemoryRouter initialEntries={['/settings?tab=integrations&dropbox=connected']}><IntegrationsSettingsContent /></MemoryRouter>);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(6));
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Zillow', 'Bright MLS', 'iGUIDE', 'MMM', 'Repro API']);
    expect(screen.queryByText(/dropbox/i)).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Zillow' })).toHaveAttribute('aria-selected', 'true');
    expect(mocks.get.mock.calls.every(([url]) => !String(url).toLowerCase().includes('dropbox'))).toBe(true);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('keeps the integrations redirect without forwarding retired callback parameters', async () => {
    function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
    render(<MemoryRouter initialEntries={['/integrations?dropbox=connected&access_token=discarded']}><Integrations /><Location /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('/settings?tab=integrations'));
    expect(screen.getByRole('status')).not.toHaveTextContent('dropbox');
    expect(screen.getByRole('status')).not.toHaveTextContent('access_token');
  });
});
