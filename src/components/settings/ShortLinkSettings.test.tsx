import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShortLinkSettings } from './ShortLinkSettings';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  apiClient: {
    get: mocks.get,
    put: mocks.put,
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

const defaults = {
  enabled: true,
  code_length: 10,
  types: {
    iguide_offline_viewer: true,
    share_download: false,
    media_zip: false,
    payment: false,
  },
};

describe('Short link settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ data: { data: defaults } });
    mocks.put.mockResolvedValue({ data: { data: { ...defaults, types: { ...defaults.types, share_download: true } } } });
  });

  afterEach(cleanup);

  it('loads the current short-link toggles', async () => {
    render(<ShortLinkSettings />);

    expect(await screen.findByLabelText('Shorten public links')).toBeChecked();
    expect(screen.getByRole('heading', { name: 'Link shortening' })).toBeVisible();
    expect(screen.getByLabelText('Offline iGUIDE viewer')).toBeChecked();
    expect(screen.getByLabelText('Editor share links')).not.toBeChecked();
    expect(screen.getByLabelText('Email zip downloads')).not.toBeChecked();
    expect(screen.getByLabelText('Payment links')).not.toBeChecked();
  });

  it('saves a type toggle without turning off the offline iGUIDE alias', async () => {
    render(<ShortLinkSettings />);
    fireEvent.click(await screen.findByLabelText('Editor share links'));

    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/admin/short-links/settings', {
      enabled: true,
      code_length: 10,
      types: {
        iguide_offline_viewer: true,
        share_download: true,
        media_zip: false,
        payment: false,
      },
    }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Link shortening updated',
    }));
  });

  it('keeps the previous toggle when the save fails', async () => {
    mocks.put.mockRejectedValue(new Error('Could not save short-link settings.'));
    render(<ShortLinkSettings />);
    fireEvent.click(await screen.findByLabelText('Editor share links'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save short-link settings.');
    expect(screen.getByLabelText('Editor share links')).not.toBeChecked();
  });
});
