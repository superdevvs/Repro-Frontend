import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./tours/TourProvidersSection', () => ({
  TourProvidersSection: () => <section data-testid="provider-section" />,
}));

import { ShootDetailsTourTabView } from './ShootDetailsTourTabView';
import { readTourVisibility, type PublicTourVisibilityOptions } from './tours/usePublicTourVisibility';

const video = 'https://vimeo.com/900000001';

const renderView = (options: PublicTourVisibilityOptions | undefined, onShootUpdate = vi.fn()) => render(
  <ShootDetailsTourTabView
    shootId={5961}
    onShootUpdate={onShootUpdate}
    getTourUrl={vi.fn((key: string) => `https://app.example.test/tour/${key}`)}
    copyLink={vi.fn()}
    openLink={vi.fn()}
    shareLink={vi.fn()}
    getQrCode={vi.fn()}
    showVideoLinksSection
    showVideoEmbedSection={false}
    showTourSettings={false}
    publicVideoLinkConfigs={[{ key: 'video_branded', label: 'Branded Video', placeholder: 'Enter branded link' }]}
    publicVisibilityOptions={options}
    tourLinks={{ video_branded: video }}
    isAdmin={false}
    isClientView
    show3dTours
    showMatterportSection={false}
    showIguideSection={false}
    showZillowSection={false}
    visibleMatterportKeys={[]}
    visibleIguideKeys={[]}
    qrCodeDialog={{ open: false, type: 'branded', url: '' }}
    onQrDialogOpenChange={vi.fn()}
    onQrImageError={vi.fn()}
    onCopyQrDialogLink={vi.fn()}
    downloadQrCode={vi.fn()}
  />,
);

describe('ShootDetailsTourTabView video visibility', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Client request: "please remove video tour from the tour. I have it hidden
  // but it still shows on the tour link when shared." Hiding the file in Media
  // never touched the saved video link; this switch is the control that does.
  it('lets the owning client take the video off the shared tour from Video Links', async () => {
    const saved = { ...readTourVisibility(null), show_video_on_branded: false };
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: saved }) }));
    vi.stubGlobal('fetch', fetch);
    const onShootUpdate = vi.fn();
    renderView({ canManage: true, canOpenSavedLink: true, visibility: readTourVisibility(null) }, onShootUpdate);

    const switches = within(screen.getByRole('group', { name: 'Video public tour visibility' }));
    expect(switches.getByRole('switch', { name: 'Show on Branded' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(switches.getByRole('switch', { name: 'Show on Branded' }));

    await waitFor(() => expect(switches.getByRole('switch', { name: 'Show on Branded' }).getAttribute('aria-checked')).toBe('false'));
    expect(switches.getByRole('switch', { name: 'Show on MLS' }).getAttribute('aria-checked')).toBe('true');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/shoots/5961/tour-visibility'), expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ show_video_on_branded: false }),
    }));
    expect(onShootUpdate).toHaveBeenCalledOnce();
    expect(screen.getByText(/Hidden on Branded tour/)).toBeTruthy();
  });

  it('shows the saved state and keeps a refused change switched on', async () => {
    const fetch = vi.fn(async () => ({ ok: false, json: async () => ({ message: 'Forbidden' }) }));
    vi.stubGlobal('fetch', fetch);
    const visibility = { ...readTourVisibility(null), show_video_on_mls: false };
    renderView({ canManage: true, canOpenSavedLink: true, visibility });

    const switches = within(screen.getByRole('group', { name: 'Video public tour visibility' }));
    expect(switches.getByRole('switch', { name: 'Show on MLS' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/Hidden on MLS tours/)).toBeTruthy();

    fireEvent.click(switches.getByRole('switch', { name: 'Show on Branded' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await waitFor(() => expect(switches.getByRole('switch', { name: 'Show on Branded' }).hasAttribute('disabled')).toBe(false));
    expect(switches.getByRole('switch', { name: 'Show on Branded' }).getAttribute('aria-checked')).toBe('true');
  });

  it('hides the switches from people who cannot change them', () => {
    renderView({ canManage: false, canOpenSavedLink: true, visibility: readTourVisibility(null) });
    expect(screen.queryByRole('group', { name: 'Video public tour visibility' })).toBeNull();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });
});
