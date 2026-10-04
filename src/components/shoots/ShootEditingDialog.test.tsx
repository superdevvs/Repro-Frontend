import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootEditingDialog } from './ShootEditingDialog';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: api }));
const media = [1, 2, 3].map(id => ({ id, name: `Photo ${id}`, version: 2, lane: 'photo', source: 'raw', available: true, stack: [{ id, name: `Photo ${id}`, version: 2 }] }));
const plan = { media, workflows: [
  { id: 'full-shoot', label: 'Full shoot enhancement', available: true, provider: 'fotello' },
  { id: 'listing-ready', label: 'Enhancement', available: true, provider: 'autoenhance' },
  { id: 'twilight', label: 'Twilight', available: false, provider: 'fal', reason: 'Provider key missing' },
  { id: 'revision', label: 'Custom revision', available: true, provider: 'fal' },
], editors: [{ id: 7, name: 'Photo editor A', lanes: ['photo'] }], addons: [], videoAi: { available: false, reason: 'Video AI workflows are not enabled yet. Choose a human video editor.' } };
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: plan } });
  api.post.mockResolvedValue({ data: { data: {} } });
});
describe('Send to editing', () => {
  it('sends the whole shoot to its editors in one step', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send to editor' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/shoots/4/editing-dispatch', expect.objectContaining({ mode: 'editor', scope: 'whole', source_versions: { 1: 2, 2: 2, 3: 2 } }));
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('preset');
    expect(screen.queryByText(/Confirm/)).not.toBeInTheDocument();
  });

  it('sends photos only to AI editing with the chosen preset', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Send to AI editing\s*Edit the photos/ }));
    expect(screen.getByLabelText('Preset')).toHaveValue('full-shoot');
    expect(screen.getByRole('option', { name: 'Twilight — Provider key missing' })).toBeDisabled();
    expect(screen.queryByRole('option', { name: 'Custom revision' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Send'), { target: { value: 'photos' } });
    fireEvent.change(screen.getByLabelText('Preset'), { target: { value: 'listing-ready' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI editing' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(api.post.mock.calls[0][1]).toMatchObject({ mode: 'ai', scope: 'photos', preset: 'listing-ready' });
  });

  it('blocks videos-only AI editing', async () => {
    render(<ShootEditingDialog shootId={4} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Send to AI editing\s*Edit the photos/ }));
    fireEvent.change(screen.getByLabelText('Send'), { target: { value: 'videos' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Video AI workflows are not enabled');
    expect(screen.getByRole('button', { name: 'Send to AI editing' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('sends selected photos to AI with a preset, without the whole-shoot workflow', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} fileIds={[1, 3]} onClose={onClose} />);
    expect(await screen.findByLabelText('Preset')).toHaveValue('listing-ready');
    expect(screen.queryByLabelText('Send')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Full shoot enhancement' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI editing' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(api.post.mock.calls[0][1]).toMatchObject({ mode: 'ai', scope: 'selected', file_ids: [1, 3], preset: 'listing-ready' });
  });

  it('sends selected photos to a chosen editor with instructions', async () => {
    render(<ShootEditingDialog shootId={4} fileIds={[2]} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Send to editor\s*The photo editor/ }));
    fireEvent.change(screen.getByLabelText('Editor'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Green the lawn only' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to editor' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1]).toMatchObject({ mode: 'editor', scope: 'selected', file_ids: [2], preset: 'revision', photo_editor_id: 7, instructions: 'Green the lawn only' });
  });

  it('keeps the dialog open after a lost response and retries with the same request id', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} fileIds={[1]} onClose={onClose} />);
    await screen.findByLabelText('Preset');
    api.post.mockRejectedValueOnce(new Error('Connection interrupted'));
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI editing' }));
    await screen.findByRole('alert');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI editing' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[1][1]).toEqual(api.post.mock.calls[0][1]);
  });
});
