import '@testing-library/jest-dom/vitest';
import type { ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MediaPicker } from './MediaPicker';
import { findPreset } from './presets';
import type { StudioShootRef } from '@/services/studioService';

const sources = vi.hoisted(() => ({ searchShoots: vi.fn(), getShootMedia: vi.fn(), upload: vi.fn() }));
vi.mock('@/services/studioWorkspaceService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/studioWorkspaceService')>(), workspaceSources: sources,
}));
vi.mock('./StudioImage', () => ({ StudioImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));

const shoot: StudioShootRef = { id: 42, address: '8704 Margaret Lane', propertyIdentifier: 'fixture-42', label: 'Georgetown', location: 'Georgetown', thumbnailUrl: null, updatedAt: '2026-09-06T00:00:00Z' };
const props = () => ({ open: true, onClose: vi.fn(), selected: [], preset: findPreset('listing-ready'), onSelect: vi.fn() });

describe('Studio shoot picker', () => {
  beforeEach(() => {
    sources.searchShoots.mockReset().mockResolvedValue([shoot]);
    sources.getShootMedia.mockReset().mockResolvedValue([]);
  });
  afterEach(cleanup);

  it('loads recent shoots on opening and reloads them after clearing a search', async () => {
    sources.searchShoots.mockImplementation(async (query: string) => query.trim() ? [] : [shoot]);
    render(<MediaPicker {...props()} />);
    expect(screen.getByText('Loading media…')).toBeInTheDocument();
    expect(screen.queryByText('No shoots are available to your account yet.')).not.toBeInTheDocument();
    expect(await screen.findByText(shoot.address!)).toBeVisible();
    expect(sources.searchShoots).toHaveBeenCalledWith('');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search shoots' }), { target: { value: 'missing address' } });
    expect(await screen.findByText('No shoots match your search.')).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search shoots' }), { target: { value: '' } });
    expect(await screen.findByText(shoot.address!)).toBeVisible();
    expect(sources.searchShoots.mock.calls.map(call => call[0])).toEqual(['', 'missing address', '']);
  });

  it('shows a request failure without falsely describing an empty library', async () => {
    sources.searchShoots.mockRejectedValue(new Error('Shoot library is temporarily unavailable.'));
    render(<MediaPicker {...props()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Shoot library is temporarily unavailable.');
    expect(screen.queryByText('No shoots are available to your account yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No shoots match your search.')).not.toBeInTheDocument();
  });

  it('keeps the media loading state when reopening a selected shoot', async () => {
    const initial = props();
    const view = render(<MediaPicker {...initial} />);
    await screen.findByText(shoot.address!);
    fireEvent.click(screen.getByRole('button', { name: 'Browse photos' }));
    await waitFor(() => expect(sources.getShootMedia).toHaveBeenCalledWith(42, 'photo-enhancement'));
    view.rerender(<MediaPicker {...initial} open={false} />);
    sources.getShootMedia.mockImplementation(() => new Promise(() => {}));
    sources.searchShoots.mockClear();
    view.rerender(<MediaPicker {...initial} open />);
    await waitFor(() => expect(screen.getByText('Loading media…')).toBeVisible());
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(sources.searchShoots).not.toHaveBeenCalled();
    expect(screen.queryByText('No compatible media in this shoot.')).not.toBeInTheDocument();
  });
});
