import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./tours/TourProvidersSection', () => ({
  TourProvidersSection: () => <section data-testid="provider-section">3D &amp; floor plans</section>,
}));

import { ShootDetailsTourTabView } from './ShootDetailsTourTabView';

describe('ShootDetailsTourTabView ordering', () => {
  it('places provider status and actions before the general tour links', () => {
    render(
      <ShootDetailsTourTabView
        shootId={82}
        onShootUpdate={vi.fn()}
        getTourUrl={vi.fn(() => '')}
        copyLink={vi.fn()}
        openLink={vi.fn()}
        shareLink={vi.fn()}
        getQrCode={vi.fn()}
        showVideoLinksSection={false}
        showVideoEmbedSection={false}
        showTourSettings={false}
        publicVideoLinkConfigs={[]}
        tourLinks={{}}
        isAdmin
        isClientView={false}
        show3dTours
        showMatterportSection
        showIguideSection
        showZillowSection
        visibleMatterportKeys={[]}
        visibleIguideKeys={[]}
        qrCodeDialog={{ open: false, type: 'branded', url: '' }}
        onQrDialogOpenChange={vi.fn()}
        onQrImageError={vi.fn()}
        onCopyQrDialogLink={vi.fn()}
        downloadQrCode={vi.fn()}
      />,
    );

    const providers = screen.getByTestId('provider-section');
    const tourLinks = screen.getByText('Tour Links');

    expect(providers.compareDocumentPosition(tourLinks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
