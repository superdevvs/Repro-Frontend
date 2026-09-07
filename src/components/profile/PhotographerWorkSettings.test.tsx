import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotographerWorkSettings } from './PhotographerWorkSettings';

const mocks = vi.hoisted(() => ({
  saveProfile: vi.fn(), toast: vi.fn(),
  user: {
    id: '42', role: 'photographer', name: '', phone: '', email: '',
    address: '10 Main St', city: 'Richmond', state: 'VA', zipcode: '23220',
    default_bracket_mode: 5, metadata: { travel_range: 25, preferences: { weeklyInvoice: true } },
  },
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useSelfProfileSave', () => ({ useSelfProfileSave: () => ({ saveProfile: mocks.saveProfile }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/profile/TaxDocumentCard', () => ({ TaxDocumentCard: () => <div>Tax upload</div> }));

describe('photographer work settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    mocks.saveProfile.mockResolvedValue({ user: mocks.user, reauthRequired: false });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('saves work preferences on this tab without requiring or submitting personal profile fields', async () => {
    const user = userEvent.setup();
    render(<PhotographerWorkSettings />);
    await user.click(screen.getByRole('radio', { name: '3x' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Timezone' }), 'America/Chicago');
    await user.click(screen.getByRole('switch', { name: 'Weekly Invoice' }));
    await user.click(screen.getByRole('button', { name: 'Save Work Settings' }));
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith({
      address: '10 Main St', city: 'Richmond', state: 'VA', zip: '23220',
      timezone: 'America/Chicago',
      travel_range: 25, travel_range_unit: 'miles', default_bracket_mode: 3,
      preferences: { weeklyInvoice: false },
    }));
    expect(screen.queryByRole('textbox', { name: 'Full Name' })).not.toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Work settings updated' }));
  });

  it('keeps the approved address after submitting an address change for review', async () => {
    mocks.saveProfile.mockResolvedValue({
      user: { ...mocks.user, pending_address_change: { status: 'pending', street_address: '20 New St' } },
      reauthRequired: false,
    });
    const user = userEvent.setup();
    render(<PhotographerWorkSettings />);
    const address = screen.getByRole('textbox', { name: 'Street Address' });
    await user.clear(address);
    await user.type(address, '20 New St');
    await user.click(screen.getByRole('button', { name: 'Save Work Settings' }));
    await waitFor(() => expect(address).toHaveValue('10 Main St'));
    expect(mocks.saveProfile).toHaveBeenCalledWith(expect.objectContaining({ address: '20 New St' }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Address submitted for approval' }));
  });

  it('preserves edits after a failed save so the photographer can retry', async () => {
    mocks.saveProfile.mockRejectedValueOnce(new Error('Connection interrupted'));
    const user = userEvent.setup();
    render(<PhotographerWorkSettings />);
    await user.click(screen.getByRole('radio', { name: '3x' }));
    await user.click(screen.getByRole('button', { name: 'Save Work Settings' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Unable to save work settings' })));
    expect(screen.getByRole('radio', { name: '3x' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Save Work Settings' }));
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(2));
    expect(mocks.saveProfile).toHaveBeenLastCalledWith(expect.objectContaining({ default_bracket_mode: 3 }));
  });
});
