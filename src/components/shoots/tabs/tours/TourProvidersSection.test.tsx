import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(within(iguide).getByText('Scanning')).toBeTruthy();
    fireEvent.click(within(iguide).getAllByRole('button')[0]);

    expect(within(iguide).getByRole('button', { name: 'Download previous' })).toBeTruthy();
    expect(within(iguide).getByText('new.zip')).toBeTruthy();
  });
});
