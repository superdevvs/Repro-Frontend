import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNormalizedIguideSync } from '@/utils/shootTourData';
import { IguideMediaPanel } from './IguideMediaPanel';

const readySync = getNormalizedIguideSync({
  iguide_data: {
    manual_offline_package: {
      id: 'package-1',
      file_id: 1726,
      status: 'ready',
      original_filename: '9137 Lakeland Valley - offline_en.zip',
      size_bytes: 144018253,
    },
  },
});

describe('IguideMediaPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      data: {
        url: 'https://api.example.test/api/iguide/offline-view/token/index.html',
        expires_at: '2026-09-01T02:00:00Z',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads a ready offline package inline while retaining staff controls', async () => {
    render(
      <IguideMediaPanel
        iguideSync={readySync}
        isAdmin
        isClient={false}
        isEditor={false}
        onShootUpdate={vi.fn()}
        shootId={82}
      />,
    );

    expect(screen.getByText('Offline iGUIDE')).toBeTruthy();
    expect(screen.getByText('ZIP ready')).toBeTruthy();
    expect(screen.getByText('9137 Lakeland Valley - offline_en.zip')).toBeTruthy();
    expect(screen.getByText(/137\.3 MB/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open in new tab' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect((await screen.findByTitle('iGUIDE 3D Tour')).getAttribute('src')).toBe(
      'https://api.example.test/api/iguide/offline-view/token/index.html',
    );
  });

  it('gives clients the inline and new-tab viewers without ZIP management or download actions', async () => {
    const { rerender } = render(
      <IguideMediaPanel
        iguideSync={readySync}
        isAdmin={false}
        isClient
        isEditor={false}
        onShootUpdate={vi.fn()}
        shootId={82}
      />,
    );

    expect(screen.getByTestId('iguide-offline-package')).toBeTruthy();
    expect(screen.getByText('iGUIDE 3D Tour')).toBeTruthy();
    expect(screen.getByText('Ready to view')).toBeTruthy();
    expect(await screen.findByTitle('iGUIDE 3D Tour')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open in new tab' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull();
    expect(screen.queryByText('9137 Lakeland Valley - offline_en.zip')).toBeNull();

    rerender(
      <IguideMediaPanel
        iguideSync={readySync}
        isAdmin
        isClient={false}
        isEditor
        onShootUpdate={vi.fn()}
        shootId={82}
      />,
    );

    expect(screen.queryByTestId('iguide-offline-package')).toBeNull();
  });

  it('opens a fresh signed viewer link in a new tab when requested', async () => {
    render(
      <IguideMediaPanel
        iguideSync={readySync}
        isAdmin
        isClient={false}
        isEditor={false}
        onShootUpdate={vi.fn()}
        shootId={82}
      />,
    );
    await screen.findByTitle('iGUIDE 3D Tour');

    const replace = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      closed: false,
      close: vi.fn(),
      location: { replace },
      opener: window,
    } as unknown as Window);

    fireEvent.click(screen.getByRole('button', { name: 'Open in new tab' }));

    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        'https://api.example.test/api/iguide/offline-view/token/index.html',
      );
    });
  });

  it('keeps published iGUIDE management, billing, and deliverables out of the client view', () => {
    const publishedSync = getNormalizedIguideSync({
      iguide_data: {
        manage_url: 'https://manage.example.test/property',
        pdf_imperial_url: 'https://files.example.test/floor-plan.pdf',
        gallery_zip_url: 'https://files.example.test/gallery.zip',
        billing: {
          iguideType: 'premium',
          billableAreaSqFeet: 3059,
        },
      },
      iguide_last_synced_at: '2026-09-01T01:00:00Z',
    });

    render(
      <IguideMediaPanel
        iguideUrl="https://youriguide.com/9137-lakeland"
        iguideSync={publishedSync}
        isAdmin={false}
        isClient
        isEditor={false}
        onShootUpdate={vi.fn()}
        shootId={82}
      />,
    );

    expect(screen.getByTitle('iGUIDE 3D Tour')).toBeTruthy();
    expect(screen.getByText('Open published tour')).toBeTruthy();
    expect(screen.queryByText('Manage')).toBeNull();
    expect(screen.queryByText('Deliverables')).toBeNull();
    expect(screen.queryByText('Floor plan PDF (Imperial)')).toBeNull();
    expect(screen.queryByText('Gallery (ZIP)')).toBeNull();
    expect(screen.queryByText('PREMIUM')).toBeNull();
    expect(screen.queryByText(/Last synced/)).toBeNull();
  });

  it('prefers the ready offline viewer instead of stacking a published viewer below it', async () => {
    render(
      <IguideMediaPanel
        iguideUrl="https://youriguide.com/9137-lakeland"
        iguideSync={readySync}
        isAdmin
        isClient={false}
        isEditor={false}
        onShootUpdate={vi.fn()}
        shootId={82}
      />,
    );

    expect(await screen.findByTitle('iGUIDE 3D Tour')).toBeTruthy();
    expect(screen.getAllByTitle('iGUIDE 3D Tour')).toHaveLength(1);
    expect(screen.queryByText('Published iGUIDE')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open in new tab' })).toBeTruthy();
  });

  it('shows clients the published viewer instead of an unfinished offline-package status', () => {
    const scanningSync = getNormalizedIguideSync({
      iguide_data: {
        manual_offline_package: {
          id: 'package-2',
          status: 'scanning',
          original_filename: 'internal-package.zip',
        },
      },
    });

    render(
      <IguideMediaPanel
        iguideUrl="https://youriguide.com/9137-lakeland"
        iguideSync={scanningSync}
        isAdmin={false}
        isClient
        isEditor={false}
        onShootUpdate={vi.fn()}
        shootId={82}
      />,
    );

    expect(screen.getByTitle('iGUIDE 3D Tour').getAttribute('src')).toBe(
      'https://youriguide.com/9137-lakeland',
    );
    expect(screen.queryByTestId('iguide-offline-package')).toBeNull();
    expect(screen.queryByText('ZIP scanning')).toBeNull();
    expect(screen.queryByText('internal-package.zip')).toBeNull();
  });
});
