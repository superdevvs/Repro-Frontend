import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getNormalizedIguideSync } from '@/utils/shootTourData';
import { TourProvidersSection } from './TourProvidersSection';

type Props = React.ComponentProps<typeof TourProvidersSection>;

const baseProps = (): Props => ({
  cancelEdit3D: vi.fn(),
  confirmDelete3D: vi.fn(),
  copyLink: vi.fn(),
  cubicasaSync: {},
  editing3DKey: null,
  editing3DValue: '',
  iguideSync: getNormalizedIguideSync({}),
  isAdmin: true,
  isClientView: false,
  isDeleting3D: null,
  isSaving3D: false,
  isSavingCubicasaIdentifiers: false,
  isSavingIguideIdentifiers: false,
  isSyncingCubicasa: false,
  isSyncingIguide: false,
  onShootUpdate: vi.fn(),
  openLink: vi.fn(),
  save3DTour: vi.fn(),
  setEditing3DValue: vi.fn(),
  shareLink: vi.fn(),
  shootId: 21,
  show3dTours: true,
  showIguideSection: true,
  showMatterportSection: true,
  showZillowSection: true,
  startEdit3D: vi.fn(),
  tourLinks: {},
  visibleIguideKeys: ['iguide_branded', 'iguide_mls'],
  visibleMatterportKeys: ['matterport_branded', 'matterport_mls'],
});

describe('TourProvidersSection', () => {

  it('lets an authorized client hide one public page before adding a unit Zillow link', async () => {
    const props = {
      ...baseProps(), isAdmin: false, isClientView: true, unitId: 6,
      zillowOptions: { canManage: true, canOpenSavedLink: true, showOnBranded: true, showOnMls: true },
    };
    const fetch = vi.fn(async () => ({
      ok: true, json: async () => ({ data: { show_zillow_on_branded: true, show_zillow_on_mls: false } }),
    }));
    vi.stubGlobal('fetch', fetch);
    try {
      render(<TourProvidersSection {...props} />);
      const zillow = within(screen.getByTestId('tour-provider-zillow'));
      fireEvent.click(zillow.getByRole('button', { name: /^Zillow 3D (Not set|Ready)/ }));
      fireEvent.click(zillow.getByRole('switch', { name: 'Show on MLS' }));

      await waitFor(() => expect(zillow.getByRole('switch', { name: 'Show on MLS' }).getAttribute('aria-checked')).toBe('false'));
      expect(zillow.getByRole('switch', { name: 'Show on Branded' }).getAttribute('aria-checked')).toBe('true');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/shoots/21/zillow-visibility'), expect.objectContaining({
        method: 'PATCH', body: JSON.stringify({ show_zillow_on_mls: false, unit_id: 6 }),
      }));
      expect(props.onShootUpdate).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('opens a hidden Zillow URL directly only when private access is allowed', () => {
    const url = 'https://www.zillow.com/view-imx/example-tour';
    const props = {
      ...baseProps(), isAdmin: false, isClientView: true, tourLinks: { zillow_3d: url },
      zillowOptions: { canManage: true, canOpenSavedLink: true, showOnBranded: false, showOnMls: false },
    };
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    try {
      const { rerender } = render(<TourProvidersSection {...props} />);
      const zillow = within(screen.getByTestId('tour-provider-zillow'));
      fireEvent.click(zillow.getByRole('button', { name: 'Open' }));
      expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
      expect(props.openLink).not.toHaveBeenCalled();

      fireEvent.keyDown(zillow.getByRole('button', { name: 'Zillow 3D actions' }), { key: 'Enter' });
      expect(screen.queryByRole('menuitem', { name: 'Share link' })).toBeNull();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy saved link' }));
      expect(props.copyLink).toHaveBeenCalledWith('zillow_3d', url);

      rerender(<TourProvidersSection {...props} zillowOptions={{ ...props.zillowOptions, canOpenSavedLink: false }} />);
      expect(zillow.queryByRole('button', { name: 'Open' })).toBeNull();
      rerender(<TourProvidersSection {...props} zillowOptions={{ ...props.zillowOptions, canManage: false }} />);
      expect(zillow.queryByRole('button', { name: 'Open' })).toBeNull();
      fireEvent.click(zillow.getByRole('button', { name: /^Zillow 3D (Not set|Ready)/ }));
      expect(zillow.queryByRole('switch', { name: 'Show on Branded' })).toBeNull();
    } finally {
      open.mockRestore();
    }
  });
  it('keeps only one provider disclosure open at a time', () => {
    render(<TourProvidersSection {...baseProps()} />);
    const matterport = screen.getByTestId('tour-provider-matterport');
    const iguide = screen.getByTestId('tour-provider-iguide');
    const matterportToggle = within(matterport).getAllByRole('button')[0];
    const iguideToggle = within(iguide).getAllByRole('button')[0];

    fireEvent.click(matterportToggle);
    expect(matterportToggle.getAttribute('aria-expanded')).toBe('true');
    expect(iguideToggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(iguideToggle);
    expect(matterportToggle.getAttribute('aria-expanded')).toBe('false');
    expect(iguideToggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows clients only public, set iGUIDE keys and hides offline/admin data', () => {
    const props = baseProps();
    props.isAdmin = false;
    props.isClientView = true;
    props.showMatterportSection = false;
    props.showZillowSection = false;
    props.visibleIguideKeys = ['iguide_branded'];
    props.tourLinks = { iguide_branded: 'https://example.com/branded' };
    props.iguideSync = getNormalizedIguideSync({
      tourLinks: props.tourLinks,
      iguide_data: {
        manual_offline_package: {
          id: 'private-package',
          file_id: 88,
          status: 'ready',
          original_filename: 'private.zip',
        },
      },
    });

    render(<TourProvidersSection {...props} />);
    const iguide = screen.getByTestId('tour-provider-iguide');
    fireEvent.click(within(iguide).getAllByRole('button')[0]);

    expect(screen.getByText('Branded tour')).toBeTruthy();
    expect(screen.queryByText('MLS tour')).toBeNull();
    expect(screen.queryByText('private.zip')).toBeNull();
    expect(screen.queryByText('Advanced matching')).toBeNull();
    expect(screen.queryByRole('button', { name: /upload zip/i })).toBeNull();
  });

  it('does not reveal an offline-only iGUIDE package to clients without a public wrapper link', () => {
    const props = baseProps();
    props.isAdmin = false;
    props.isClientView = true;
    props.show3dTours = false;
    props.showIguideSection = false;
    props.showMatterportSection = false;
    props.showZillowSection = false;
    props.visibleIguideKeys = [];
    props.iguideSync = getNormalizedIguideSync({
      iguide_data: {
        manual_offline_package: {
          id: 'private-package',
          file_id: 88,
          status: 'ready',
        },
      },
    });

    render(<TourProvidersSection {...props} />);

    expect(screen.queryByTestId('tour-provider-iguide')).toBeNull();
    expect(screen.queryByText('3D & floor plans')).toBeNull();
  });

  it('keeps the previous clean ZIP downloadable while its replacement is scanning', () => {
    const props = baseProps();
    props.iguideSync = getNormalizedIguideSync({
      iguide_data: {
        manual_offline_package: {
          id: 'replacement',
          status: 'scanning',
          original_filename: 'new.zip',
          previous_ready: {
            id: 'previous',
            file_id: 88,
            status: 'ready',
            original_filename: 'old.zip',
          },
        },
      },
    });

    render(<TourProvidersSection {...props} />);
    const iguide = screen.getByTestId('tour-provider-iguide');
    expect(within(iguide).getAllByText('ZIP scanning').length).toBeGreaterThan(0);
    expect(within(iguide).getAllByRole('button')[0].getAttribute('aria-expanded')).toBe('true');

    expect(within(iguide).getByRole('button', { name: 'Download previous' })).toBeTruthy();
    expect(within(iguide).getByText('new.zip')).toBeTruthy();
  });

  it('auto-expands a ready offline package with Open iGUIDE as the primary action', () => {
    const props = baseProps();
    props.showMatterportSection = false;
    props.showZillowSection = false;
    props.iguideSync = getNormalizedIguideSync({
      iguide_data: {
        manual_offline_package: {
          id: 'ready-package',
          file_id: 88,
          status: 'ready',
          original_filename: 'offline-tour.zip',
          size_bytes: 1048576,
        },
      },
    });

    render(<TourProvidersSection {...props} />);
    const iguide = screen.getByTestId('tour-provider-iguide');

    expect(within(iguide).getAllByRole('button')[0].getAttribute('aria-expanded')).toBe('true');
    expect(within(iguide).getAllByText('ZIP ready').length).toBeGreaterThan(0);
    expect(within(iguide).getByRole('button', { name: 'Open iGUIDE' })).toBeTruthy();
    expect(within(iguide).getByText('offline-tour.zip')).toBeTruthy();
  });

  it('does not reveal an offline-only package to a non-admin staff role', () => {
    const props = baseProps();
    props.isAdmin = false;
    props.isClientView = false;
    props.show3dTours = false;
    props.showIguideSection = false;
    props.showMatterportSection = false;
    props.showZillowSection = false;
    props.visibleIguideKeys = [];
    props.iguideSync = getNormalizedIguideSync({
      iguide_data: {
        manual_offline_package: {
          id: 'private-package',
          file_id: 88,
          status: 'ready',
          original_filename: 'private.zip',
        },
      },
    });

    render(<TourProvidersSection {...props} />);

    expect(screen.queryByTestId('tour-provider-iguide')).toBeNull();
    expect(screen.queryByText('private.zip')).toBeNull();
  });
});
