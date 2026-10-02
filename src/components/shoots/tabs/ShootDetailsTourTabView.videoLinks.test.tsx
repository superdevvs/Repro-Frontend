import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShootDetailsTourTabView } from './ShootDetailsTourTabView';

afterEach(cleanup);

const configs = [
  { key: 'video_branded', label: 'Branded Video', placeholder: 'Enter branded link' },
  { key: 'video_mls', label: 'MLS Video', placeholder: 'Enter MLS link' },
  { key: 'video_generic', label: 'Generic Video', placeholder: 'Enter generic link' },
];

function renderVideoLinks(tourLinks: Record<string, string>, canEditVideoLinks = true) {
  const openLink = vi.fn();
  const startEditVideoLink = vi.fn();
  render(<ShootDetailsTourTabView
    shootId={528}
    videoOnly
    showVideoLinksSection
    showVideoEmbedSection
    canEditVideoLinks={canEditVideoLinks}
    isAdmin={false}
    publicVideoLinkConfigs={configs}
    tourLinks={tourLinks}
    getTourUrl={(key: string) => `https://reprodashboard.com/tour/${key}?shootId=528`}
    copyLink={vi.fn()}
    openLink={openLink}
    shareLink={vi.fn()}
    getQrCode={vi.fn()}
    startEditVideoLink={startEditVideoLink}
    qrCodeDialog={{ open: false, type: 'branded', url: '' }}
  />);
  return { openLink, startEditVideoLink };
}

describe('Video Links availability', () => {
  it.each([true, false])('leaves unsaved video rows empty and disables their public actions (editable: %s)', (canEdit) => {
    renderVideoLinks({ video_branded: ' ', video_link: '  ' }, canEdit);
    for (const { label, placeholder } of configs) {
      expect(screen.getByLabelText(label)).toHaveValue('');
      expect(screen.getByLabelText(label)).toHaveAttribute('placeholder', placeholder);
    }
    expect(screen.getByLabelText('Video embed')).toHaveValue('');
    expect(screen.getByLabelText('Video embed')).toHaveAttribute('placeholder', 'Enter video link');
    expect(screen.queryByText(/Destination:/)).not.toBeInTheDocument();
    for (const button of screen.getAllByTestId('tour-link-desktop-open')) expect(button).toBeDisabled();
    for (const button of screen.getAllByTestId('tour-link-hover-copy')) expect(button).toBeDisabled();
    expect(screen.queryAllByTestId('tour-link-desktop-edit')).toHaveLength(canEdit ? 4 : 0);
  });

  it('shows the public URL only for a saved version, preserves the embed URL, and offers edit on empty rows', () => {
    const { openLink, startEditVideoLink } = renderVideoLinks({
      video_branded: 'https://vimeo.com/123',
      video_link: 'https://vimeo.com/456',
    });
    expect(screen.getByLabelText('Branded Video')).toHaveValue('https://reprodashboard.com/tour/video_branded?shootId=528');
    expect(screen.getByLabelText('MLS Video')).toHaveValue('');
    expect(screen.getByLabelText('Generic Video')).toHaveValue('');
    expect(screen.getByLabelText('Video embed')).toHaveValue('https://vimeo.com/456');
    expect(screen.getByText('Destination: https://vimeo.com/123')).toBeInTheDocument();
    const openButtons = screen.getAllByTestId('tour-link-desktop-open');
    expect(openButtons[0]).toBeEnabled();
    expect(openButtons[1]).toBeDisabled();
    expect(openButtons[2]).toBeDisabled();
    expect(openButtons[3]).toBeEnabled();
    fireEvent.click(openButtons[0]);
    expect(openLink).toHaveBeenCalledWith('video_branded');
    fireEvent.click(screen.getByRole('button', { name: 'Edit MLS Video' }));
    expect(startEditVideoLink).toHaveBeenCalledWith('video_mls');
  });
});
