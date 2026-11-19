import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getNormalizedIguideSync } from '@/utils/shootTourData';
import { TourProvidersSection } from './TourProvidersSection';
import {
  readTourVisibility,
  usePublicTourVisibility,
  type PublicTourVisibilityOptions,
  type TourVisibilityKey,
} from './usePublicTourVisibility';

type Props = React.ComponentProps<typeof TourProvidersSection>;

/** The tab owns the switches; this stands in for it around the section. */
function Section({ visibilityOptions, ...props }: Props & { visibilityOptions?: PublicTourVisibilityOptions }) {
  const control = usePublicTourVisibility(props.shootId, props.unitId, visibilityOptions, props.onShootUpdate);
  return <TourProvidersSection {...props} publicVisibility={control} />;
}

const visibilityOptions = (
  hidden: TourVisibilityKey[] = [],
  access: Partial<Pick<PublicTourVisibilityOptions, 'canManage' | 'canOpenSavedLink'>> = {},
): PublicTourVisibilityOptions => ({
  canManage: true,
  canOpenSavedLink: true,
  ...access,
  visibility: { ...readTourVisibility(null), ...Object.fromEntries(hidden.map((key) => [key, false])) },
});

const savedResponse = (hidden: TourVisibilityKey[]) => vi.fn(async () => ({
  ok: true, json: async () => ({ data: visibilityOptions(hidden).visibility }),
}));

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
      visibilityOptions: visibilityOptions(),
    };
    const fetch = savedResponse(['show_zillow_on_mls']);
    vi.stubGlobal('fetch', fetch);
    try {
      render(<Section {...props} />);
      const zillow = within(screen.getByTestId('tour-provider-zillow'));
      fireEvent.click(zillow.getByRole('button', { name: /^Zillow 3D (Not set|Ready)/ }));
      fireEvent.click(zillow.getByRole('switch', { name: 'Show on MLS' }));

      await waitFor(() => expect(zillow.getByRole('switch', { name: 'Show on MLS' }).getAttribute('aria-checked')).toBe('false'));
      expect(zillow.getByRole('switch', { name: 'Show on Branded' }).getAttribute('aria-checked')).toBe('true');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/shoots/21/tour-visibility'), expect.objectContaining({
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
      visibilityOptions: visibilityOptions(['show_zillow_on_branded', 'show_zillow_on_mls']),
    };
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    try {
      const { rerender } = render(<Section {...props} />);
      const zillow = within(screen.getByTestId('tour-provider-zillow'));
      fireEvent.click(zillow.getByRole('button', { name: 'Open' }));
      expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
      expect(props.openLink).not.toHaveBeenCalled();

      fireEvent.keyDown(zillow.getByRole('button', { name: 'Zillow 3D actions' }), { key: 'Enter' });
      expect(screen.queryByRole('menuitem', { name: 'Share link' })).toBeNull();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy saved link' }));
      expect(props.copyLink).toHaveBeenCalledWith('zillow_3d', url);

      rerender(<Section {...props} visibilityOptions={{ ...props.visibilityOptions, canOpenSavedLink: false }} />);
      expect(zillow.queryByRole('button', { name: 'Open' })).toBeNull();
      rerender(<Section {...props} visibilityOptions={{ ...props.visibilityOptions, canManage: false }} />);
      expect(zillow.queryByRole('button', { name: 'Open' })).toBeNull();
      fireEvent.click(zillow.getByRole('button', { name: /^Zillow 3D (Not set|Ready)/ }));
      expect(zillow.queryByRole('switch', { name: 'Show on Branded' })).toBeNull();
    } finally {
      open.mockRestore();
    }
  });
  it('lets staff switch a Matterport walkthrough off for one public page and says so on the row', async () => {
    const props = {
      ...baseProps(), tourLinks: { matterport_branded: 'https://my.matterport.com/show/?m=one' },
      visibilityOptions: visibilityOptions(),
    };
    const fetch = savedResponse(['show_matterport_on_branded']);
    vi.stubGlobal('fetch', fetch);
    try {
      render(<Section {...props} />);
      const matterport = within(screen.getByTestId('tour-provider-matterport'));
      fireEvent.click(matterport.getByRole('button', { name: /^Matterport Ready/ }));
      expect(matterport.getByRole('group', { name: 'Matterport public tour visibility' })).toBeTruthy();
      fireEvent.click(matterport.getByRole('switch', { name: 'Show on Branded' }));

      await waitFor(() => expect(matterport.getByRole('switch', { name: 'Show on Branded' }).getAttribute('aria-checked')).toBe('false'));
      expect(matterport.getByRole('switch', { name: 'Show on MLS' }).getAttribute('aria-checked')).toBe('true');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/shoots/21/tour-visibility'), expect.objectContaining({
        method: 'PATCH', body: JSON.stringify({ show_matterport_on_branded: false }),
      }));
      expect(matterport.getByText(/Hidden on Branded tour/)).toBeTruthy();
      // The saved link is still listed for the people who manage it.
      expect(matterport.getByText('https://my.matterport.com/show/?m=one')).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('opens and copies the saved link itself once a 3D tour is off the public page', () => {
    const branded = 'https://youriguide.com/saved_branded';
    const mls = 'https://unbranded.youriguide.com/saved_mls';
    const props = {
      ...baseProps(), tourLinks: { iguide_branded: branded, iguide_mls: mls },
      visibilityOptions: visibilityOptions(['show_iguide_on_branded']),
    };
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    try {
      const { rerender } = render(<Section {...props} />);
      const iguide = within(screen.getByTestId('tour-provider-iguide'));
      fireEvent.click(iguide.getByRole('button', { name: 'Open' }));
      expect(open).toHaveBeenCalledWith(branded, '_blank', 'noopener,noreferrer');
      expect(props.openLink).not.toHaveBeenCalled();

      fireEvent.keyDown(iguide.getByRole('button', { name: 'iGUIDE actions' }), { key: 'Enter' });
      // Branded is hidden, MLS is still public: one saved copy, one public copy and share.
      expect(screen.getAllByRole('menuitem', { name: 'Copy saved link' })).toHaveLength(1);
      expect(screen.getAllByRole('menuitem', { name: 'Copy link' })).toHaveLength(1);
      expect(screen.getAllByRole('menuitem', { name: 'Share link' })).toHaveLength(1);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy saved link' }));
      expect(props.copyLink).toHaveBeenCalledWith('iguide_branded', branded);

      // Someone who cannot manage visibility falls through to the page that is still public.
      rerender(<Section {...props} visibilityOptions={{ ...props.visibilityOptions, canManage: false }} />);
      fireEvent.click(iguide.getByRole('button', { name: 'Open' }));
      expect(props.openLink).toHaveBeenCalledWith('iguide_mls');
    } finally {
      open.mockRestore();
    }
  });

  it('offers the switches on every 3D provider only to people who may change them', () => {
    const props = { ...baseProps(), cubicasaSync: { status: 'ready', brandedUrl: 'https://app.cubi.casa/tour/one' } };
    const { rerender } = render(<Section {...props} visibilityOptions={visibilityOptions(['show_cubicasa_on_branded', 'show_cubicasa_on_mls'])} />);
    for (const [id, name] of [['matterport', 'Matterport'], ['iguide', 'iGUIDE'], ['cubicasa', 'CubiCasa'], ['zillow', 'Zillow 3D']]) {
      const row = within(screen.getByTestId(`tour-provider-${id}`));
      fireEvent.click(row.getAllByRole('button')[0]);
      expect(row.getByRole('group', { name: `${name} public tour visibility` })).toBeTruthy();
      expect(row.getAllByRole('switch')).toHaveLength(2);
      // Only one provider is open at a time, so each is read while it is.
      expect(row.getByRole('switch', { name: 'Show on MLS' }).getAttribute('aria-checked')).toBe(id === 'cubicasa' ? 'false' : 'true');
    }
    expect(within(screen.getByTestId('tour-provider-cubicasa')).getByText(/Hidden on public tours/)).toBeTruthy();

    rerender(<Section {...props} visibilityOptions={visibilityOptions([], { canManage: false })} />);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    rerender(<TourProvidersSection {...props} />);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
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
