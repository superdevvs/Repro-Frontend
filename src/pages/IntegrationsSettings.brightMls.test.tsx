import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import API_ROUTES from '@/lib/api';
import { IntegrationsSettingsContent } from './IntegrationsSettings';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: { get: mocks.get, post: mocks.post } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: () => null }));
vi.mock('@/components/settings/AddressLookupTester', () => ({ AddressLookupTester: () => null }));

async function openBrightMls(settings: { vendorName?: string | null } | null) {
  mocks.get.mockImplementation(async (url: string) => ({
    data: url === API_ROUTES.admin.settings.get('integrations.bright_mls')
      ? { success: true, data: { value: settings } }
      : { success: false },
  }));
  render(<MemoryRouter><IntegrationsSettingsContent /></MemoryRouter>);
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(6));
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Bright MLS' }), { button: 0, ctrlKey: false });
  return screen.findByLabelText('Vendor Name');
}

describe('Bright MLS vendor credit settings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.post.mockResolvedValue({ data: { success: true, message: 'Connection verified' } });
  });
  afterEach(cleanup);

  it.each([
    { label: 'missing settings', settings: null, expected: 'R/E Pro Photos' },
    { label: 'missing name', settings: {}, expected: 'R/E Pro Photos' },
    { label: 'null name', settings: { vendorName: null }, expected: 'R/E Pro Photos' },
    { label: 'blank name', settings: { vendorName: '' }, expected: 'R/E Pro Photos' },
    { label: 'whitespace', settings: { vendorName: '   ' }, expected: 'R/E Pro Photos' },
    { label: 'old default', settings: { vendorName: 'Repro Photos' }, expected: 'R/E Pro Photos' },
    { label: 'mixed case old default', settings: { vendorName: ' rEpRo pHoToS ' }, expected: 'R/E Pro Photos' },
    { label: 'current name', settings: { vendorName: 'R/E Pro Photos' }, expected: 'R/E Pro Photos' },
    { label: 'custom name', settings: { vendorName: 'Acme Photography' }, expected: 'Acme Photography' },
    { label: 'custom legacy prefix', settings: { vendorName: 'Repro Photos Studio' }, expected: 'Repro Photos Studio' },
    { label: 'custom legacy suffix', settings: { vendorName: 'My Repro Photos' }, expected: 'My Repro Photos' },
  ])('loads and saves $label', async ({ settings, expected }) => {
    const input = await openBrightMls(settings);
    expect(input).toHaveValue(expected);
    expect(input).toHaveAttribute('placeholder', 'R/E Pro Photos');

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Settings saved' })));
    expect(mocks.post).toHaveBeenCalledWith(API_ROUTES.admin.settings.store, expect.objectContaining({
      key: 'integrations.bright_mls',
      value: expect.objectContaining({ vendorName: expected }),
    }));
    expect(input).toHaveValue(expected);
  });

  it.each([
    { action: 'Save Settings', entered: '   ', expected: 'R/E Pro Photos' },
    { action: 'Save Settings', entered: ' rEpRo pHoToS ', expected: 'R/E Pro Photos' },
    { action: 'Save Settings', entered: 'Custom Vendor', expected: 'Custom Vendor' },
    { action: 'Test Connection', entered: '', expected: 'R/E Pro Photos' },
    { action: 'Test Connection', entered: 'Repro Photos', expected: 'R/E Pro Photos' },
    { action: 'Test Connection', entered: 'Custom Vendor', expected: 'Custom Vendor' },
  ])('normalizes "$entered" on $action', async ({ action, entered, expected }) => {
    const input = await openBrightMls({ vendorName: 'Original Custom Vendor' });
    fireEvent.change(input, { target: { value: entered } });
    fireEvent.click(screen.getByRole('button', { name: action }));

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(API_ROUTES.admin.settings.store, expect.objectContaining({
      key: 'integrations.bright_mls',
      value: expect.objectContaining({ vendorName: expected }),
    })));
    expect(input).toHaveValue(expected);
    if (action === 'Test Connection') {
      await screen.findByText('Connection verified');
      expect(mocks.post.mock.calls[0][1].key).toBe('integrations.bright_mls');
      expect(mocks.post.mock.calls[1]).toEqual([API_ROUTES.integrations.testConnection, { service: 'bright_mls' }]);
    } else {
      await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Settings saved' })));
    }
  });
});
