import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioProviderSettings } from '@/services/studioProviderService';
import { AiEditingProviderSettings } from './AiEditingProviderSettings';

const mocks = vi.hoisted(() => ({ role: 'superadmin', settings: vi.fn(), save: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: mocks.role }) }));
vi.mock('@/services/studioProviderService', () => ({ studioProviderService: { settings: mocks.settings, save: mocks.save } }));
vi.mock('@/services/studioWorkspaceService', () => ({ studioError: (error: Error) => error.message }));
const fixture = (): StudioProviderSettings => ({
  services: ['listing-ready', 'twilight', 'outpaint'].map(id => ({
    id, label: id === 'listing-ready' ? 'Listing ready' : id === 'twilight' ? 'Twilight' : 'AI Extend',
    provider: 'fal', model: 'image-model', ready: true,
    providers: [{ id: 'fal', label: 'fal.ai', models: [{ id: 'image-model', label: 'Current image model' }] }, { id: 'fotello', label: 'Fotello', models: [{ id: 'enhance', label: 'Photo enhancement' }] }],
    ...(id === 'outpaint' ? { fallback: null } : {}),
  })),
  credentials: { fotello: { keyConfigured: false, teamIdConfigured: false } },
});
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'superadmin'; mocks.settings.mockResolvedValue(fixture()); });
afterEach(cleanup);

describe('Superadmin AI Editing provider settings', () => {
  it.each(['client', 'admin', 'editor', 'editing_manager'])('does not query or expose credentials for %s', role => {
    mocks.role = role;
    const { container } = render(<AiEditingProviderSettings />);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.settings).not.toHaveBeenCalled();
  });

  it('saves an API key alone without switching providers, and never repopulates credentials', async () => {
    const saved = fixture(); saved.credentials.fotello.keyConfigured = true;
    mocks.save.mockResolvedValue(saved);
    render(<AiEditingProviderSettings />);
    const key = await screen.findByLabelText('API key');
    expect(screen.getByRole('button', { name: 'Use Fotello for enhancement' })).toBeDisabled();
    fireEvent.change(key, { target: { value: 'local-fixture-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save connection details' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ credentials: { fotello: { apiKey: 'local-fixture-key' } } }));
    expect(await screen.findByText('API key saved')).toBeVisible();
    expect(screen.getByText('Team ID pending')).toBeVisible();
    expect(key).toHaveValue('');
    expect(screen.getByLabelText('Team ID')).toHaveValue('');
    expect(screen.getByLabelText('Listing ready API')).toHaveValue('fal');
    expect(screen.getByRole('button', { name: 'Save service routing' })).toBeDisabled();
  });

  it('stages only supported enhancement routes and requires a separate save', async () => {
    const saved = fixture(); saved.credentials.fotello = { keyConfigured: true, teamIdConfigured: true };
    mocks.settings.mockResolvedValue(saved); mocks.save.mockResolvedValue(saved);
    render(<AiEditingProviderSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Use Fotello for enhancement' }));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Listing ready API')).toHaveValue('fotello');
    expect(screen.getByLabelText('Twilight API')).toHaveValue('fal');
    expect(screen.getByLabelText('AI Extend API')).toHaveValue('fal');
    fireEvent.click(screen.getByRole('button', { name: 'Save service routing' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ services: [
      { id: 'listing-ready', provider: 'fotello', model: 'enhance' },
      { id: 'twilight', provider: 'fal', model: 'image-model' },
      { id: 'outpaint', provider: 'fal', model: 'image-model', fallback: null },
    ] }));
  });

  it('keeps the unsaved key and reports a failed save without claiming success', async () => {
    mocks.save.mockRejectedValue(new Error('Connection details could not be saved.'));
    render(<AiEditingProviderSettings />);
    fireEvent.change(await screen.findByLabelText('API key'), { target: { value: 'local-fixture-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save connection details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection details could not be saved.');
    expect(screen.getByLabelText('API key')).toHaveValue('local-fixture-key');
    expect(screen.queryByText('Connection details saved. Service routing is unchanged.')).not.toBeInTheDocument();
  });
});
