import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { studioService, type StudioShootRef } from '@/services/studioService';

import { CommandCenterSourcePanel } from './CommandCenterSourcePanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CommandCenterSourcePanel', () => {
  it('searches, selects, and displays a property without opening the media launcher', async () => {
    const user = userEvent.setup({ delay: null });
    const shoot: StudioShootRef = {
      id: 1234,
      propertyIdentifier: 'RP-1234',
      address: '1234 Maple Drive',
      location: 'Bethesda, MD',
      label: '1234 Maple Drive',
      thumbnailUrl: null,
      updatedAt: '2026-07-26T00:00:00Z',
    };
    vi.spyOn(studioService, 'searchShoots').mockResolvedValue([shoot]);
    const onShootSelect = vi.fn();
    const onChooseMedia = vi.fn();

    render(
      <CommandCenterSourcePanel
        selectedShoot={null}
        onShootSelect={onShootSelect}
        onChooseMedia={onChooseMedia}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Choose a property' }));
    await user.type(screen.getByRole('textbox', { name: 'Search properties' }), 'Maple');

    await waitFor(() =>
      expect(studioService.searchShoots).toHaveBeenCalledWith('Maple'),
    );
    await user.click(await screen.findByRole('option', { name: /1234 Maple Drive/i }));

    expect(onShootSelect).toHaveBeenCalledWith(shoot);
    expect(onChooseMedia).not.toHaveBeenCalled();

    cleanup();
    render(
      <CommandCenterSourcePanel
        selectedShoot={shoot}
        onShootSelect={onShootSelect}
        onChooseMedia={onChooseMedia}
      />,
    );
    expect(screen.getByRole('button', { name: 'Choose a property' })).toHaveTextContent(
      '1234 Maple Drive',
    );

    await user.click(screen.getByRole('button', { name: 'Choose media' }));
    expect(onChooseMedia).toHaveBeenCalledTimes(1);
  });
});
