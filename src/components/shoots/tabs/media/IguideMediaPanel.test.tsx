import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  it('shows a compact, actionable offline package without rendering a broken iframe', () => {
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
    expect(screen.getByRole('button', { name: 'Open iGUIDE' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(screen.queryByTitle('iGUIDE 3D Tour')).toBeNull();
  });

  it('does not expose an offline-only package to client or editor views', () => {
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

    expect(screen.queryByTestId('iguide-offline-package')).toBeNull();

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
});
