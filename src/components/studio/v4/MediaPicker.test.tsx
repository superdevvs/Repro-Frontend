import '@testing-library/jest-dom/vitest';
import type { ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaPicker } from './MediaPicker';
import { findPreset } from './presets';
import { buildPickerTiles } from './usePickerSources';
import type { SourceMedia, StudioShootRef } from '@/services/studioService';

const sources = vi.hoisted(() => ({ searchShoots: vi.fn(), getShootMedia: vi.fn(), mergeHdr: vi.fn(), upload: vi.fn() }));
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
    sources.mergeHdr.mockReset();
  });
  afterEach(cleanup);

  const photo = (id: number, overrides: Partial<SourceMedia> = {}): SourceMedia => ({ id, shootId: 42, filename: `IMG${id}.CR3`, mimeType: 'image/x-canon-cr3', mediaType: 'raw', fileSize: 1024, workflowStage: 'todo', workflow: 'photo-enhancement', previewUrl: `/preview/${id}`, thumbnailUrl: `/thumb/${id}`, bracketGroup: 1, sequence: id, shootServiceId: 10, ...overrides });
  const merged = { id: 'hdr:one', stackFileIds: [1, 2, 3], shootId: 42, name: 'IMG1-HDR.jpg', kind: 'image' as const, url: '/hdr/one', thumbnailUrl: '/hdr/one' };

  it('combines shoot context, source tabs, and actions in one header without a sidebar or descriptions', async () => {
    sources.getShootMedia.mockResolvedValue([photo(1, { stackingEnabled: false })]);
    render(<MediaPicker {...props()} initialShoot={shoot} />);
    await screen.findByRole('button', { name: /Select IMG1.CR3/ });
    const dialog = screen.getByRole('dialog');
    const header = screen.getByRole('heading', { name: shoot.address! }).closest('header');
    expect(header).toContainElement(screen.getByRole('tablist', { name: 'Photo source' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Select all' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Upload media' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Back to shoots' }));
    expect(dialog.querySelectorAll('header')).toHaveLength(1);
    expect(dialog.querySelector('aside')).toBeNull();
    expect(screen.queryByText(/HDR stacks merge automatically/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Select photos from several shoots/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose raw HDR stacks/)).not.toBeInTheDocument();
  });

  it('keeps search and upload in the same library header after returning from a shoot', async () => {
    render(<MediaPicker {...props()} initialShoot={shoot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to shoots' }));
    await screen.findByRole('button', { name: 'Browse photos' });
    const header = screen.getByRole('heading', { name: 'Add media' }).closest('header');
    expect(header).toContainElement(screen.getByRole('textbox', { name: 'Search shoots' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Upload media' }));
  });

  it('shows raw stacks with merged finals and preserves edited selections across tabs', async () => {
    sources.getShootMedia.mockResolvedValue([photo(1), photo(2), photo(3), photo(4, { filename: 'final.jpg', mediaType: 'image', workflowStage: 'completed', bracketGroup: null })]);
    sources.mergeHdr.mockResolvedValue(merged);
    const initial = props();
    render(<MediaPicker {...initial} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Browse photos' }));
    expect(await screen.findByRole('tab', { name: /Raw/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(await screen.findByRole('button', { name: /Select IMG1-HDR.jpg/ }));
    expect(sources.mergeHdr).toHaveBeenCalledWith([1, 2, 3], expect.any(AbortSignal));
    expect(screen.getByText('3 exposures · Merged HDR')).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: /Edited/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Select final.jpg/ }));
    fireEvent.click(screen.getByRole('button', { name: /Use 2 photos/ }));
    expect(initial.onSelect.mock.calls[0][0]).toEqual([merged, expect.objectContaining({ fileId: 4 })]);
    expect(initial.onSelect.mock.calls[0][0].some((m: { fileId?: number }) => [1, 2, 3].includes(m.fileId!))).toBe(false);
  });

  it('keeps service stacks separate and select all uses only merged images in the active tab', async () => {
    sources.getShootMedia.mockResolvedValue([photo(1), photo(2), photo(3, { shootServiceId: 20 }), photo(4, { shootServiceId: 20 }), photo(5, { filename: 'edited.jpg', workflowStage: 'verified', mediaType: 'image' })]);
    sources.mergeHdr.mockImplementation(async (ids: number[]) => ({ ...merged, id: `hdr:${ids[0]}`, name: `stack-${ids[0]}.jpg`, stackFileIds: ids }));
    const initial = props();
    render(<MediaPicker {...initial} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Browse photos' }));
    await screen.findByRole('button', { name: /Select stack-3.jpg/ });
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: /Use 2 photos/ }));
    expect(initial.onSelect.mock.calls[0][0].map((m: { stackFileIds: number[] }) => m.stackFileIds)).toEqual([[1, 2], [3, 4]]);
  });

  it('does not select pending or failed stacks and allows retrying the merge', async () => {
    sources.getShootMedia.mockResolvedValue([photo(1), photo(2), photo(3)]);
    sources.mergeHdr.mockRejectedValueOnce(new Error('HDR merge unavailable')).mockResolvedValueOnce(merged);
    render(<MediaPicker {...props()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Browse photos' }));
    expect(await screen.findByText('HDR merge unavailable')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByText('0 selected')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry merge' }));
    expect(await screen.findByRole('button', { name: /Select IMG1-HDR.jpg/ })).toBeEnabled();
  });

  it('opens a shoot entry in the stack picker without bulk-selecting its original exposures', async () => {
    sources.getShootMedia.mockResolvedValue([photo(1), photo(2), photo(3)]);
    sources.mergeHdr.mockResolvedValue(merged);
    render(<MediaPicker {...props()} initialShoot={shoot} />);
    expect(await screen.findByRole('button', { name: /Select IMG1-HDR.jpg/ })).toBeVisible();
    expect(screen.getByText('0 selected')).toBeVisible();
    expect(sources.searchShoots).not.toHaveBeenCalled();
  });

  it('leaves non-bracket services and extras as individual photos and groups legacy raw captures', () => {
    expect(buildPickerTiles([photo(1, { stackingEnabled: false }), photo(2, { stackingEnabled: false })], 'raw').map(tile => tile.media?.fileId)).toEqual([1, 2]);
    expect(buildPickerTiles([photo(1, { isExtra: true }), photo(2, { isExtra: true })], 'raw').map(tile => tile.media?.fileId)).toEqual([1, 2]);
    expect(buildPickerTiles([photo(1, { bracketGroup: null }), photo(2, { bracketGroup: null }), photo(3, { bracketGroup: null })], 'raw')[0].sources).toHaveLength(3);
    expect(buildPickerTiles([photo(1, { workflowStage: 'archived' })], 'raw')).toEqual([]);
  });

  it('only selects ready single files while a stack is merging', async () => {
    sources.getShootMedia.mockResolvedValue([photo(1), photo(2), photo(3), photo(4, { filename: 'extra.jpg', isExtra: true, mediaType: 'image' })]);
    sources.mergeHdr.mockImplementation(() => new Promise(() => {}));
    const initial = props();
    render(<MediaPicker {...initial} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Browse photos' }));
    await screen.findByText('Preparing merged HDR…');
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: /Use 1 photo/ }));
    expect(initial.onSelect.mock.calls[0][0]).toEqual([expect.objectContaining({ fileId: 4 })]);
  });

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
