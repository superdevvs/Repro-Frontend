import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootEditingDialog } from './ShootEditingDialog';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: api }));
vi.mock('@/components/studio/v4/StudioImage', () => ({ StudioImage: () => null }));
const photos = [1, 2, 3, 4].map(id => ({ id, name: `Photo ${id}`, version: 2, lane: 'photo', source: 'raw', available: true, stack: [{ id, name: `Photo ${id}`, version: 2 }] }));
const video = { id: 9, name: 'Walkthrough.mp4', version: 1, lane: 'video', source: 'raw', available: true, stack: [{ id: 9, name: 'Walkthrough.mp4', version: 1 }] };
const workflows = [
  { id: 'full-shoot', label: 'Full shoot enhancement', available: true, provider: 'fotello' },
  { id: 'listing-ready', label: 'Enhancement', available: true, provider: 'autoenhance' },
  { id: 'green-grass', label: 'Grass greening', available: true, provider: 'fal' },
  { id: 'twilight', label: 'Twilight', available: true, provider: 'fal' },
  { id: 'revision', label: 'Custom revision', available: true, provider: 'fal' },
];
const plan = (lanes = { photo: { available: true, sent: false }, video: { available: true, sent: false } }) => ({
  media: [...photos, video], workflows, editors: [{ id: 7, name: 'Photo editor A', lanes: ['photo'] }], addons: [], lanes,
  videoAi: { available: false, reason: 'Video AI workflows are not enabled yet. Choose a human video editor.' },
});
const bodies = () => api.post.mock.calls.map(([, body]) => body);
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: plan() } });
  api.post.mockResolvedValue({ data: { data: {} } });
});

describe('Send to editing without a selection', () => {
  it('sends external video without dashboard files or source versions', async () => {
    api.get.mockResolvedValue({ data: { data: { ...plan(), media: [], status: 'scheduled', lanes: {
      photo: { available: false, sent: false }, video: { available: true, sent: false, external: true },
    } } } });
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={170} onClose={onClose} />);
    expect(await screen.findByRole('switch', { name: 'Videos' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Videos' })).toBeEnabled();
    expect(screen.getByText(/Files shared outside the dashboard/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Send to editor' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(bodies()[0]).toMatchObject({ mode: 'editor', scope: 'videos', source_versions: {} });
  });

  it('keeps AI photos blocked when only externally shared files exist', async () => {
    api.get.mockResolvedValue({ data: { data: { ...plan(), media: [], lanes: {
      photo: { available: true, sent: false, external: true }, video: { available: true, sent: false, external: true },
    } } } });
    render(<ShootEditingDialog shootId={170} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Send to AI editing\s*Photos get/ }));
    expect(screen.getByRole('note')).toHaveTextContent('Upload photos before using AI editing.');
    expect(screen.getByRole('button', { name: 'Send to AI editing' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('sends photos and videos to their editors by default', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} onClose={onClose} />);
    expect(await screen.findByRole('switch', { name: 'Photos' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Videos' })).toBeChecked();
    expect(screen.queryByText('Whole shoot')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send to editor' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(bodies()[0]).toMatchObject({ mode: 'editor', scope: 'whole' });
  });

  it('sends only the lane left on', async () => {
    render(<ShootEditingDialog shootId={4} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Photos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to editor' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(bodies()[0]).toMatchObject({ scope: 'videos' });
  });

  it('disables a lane that was already sent so the other can be sent later', async () => {
    api.get.mockResolvedValue({ data: { data: plan({ photo: { available: true, sent: false }, video: { available: true, sent: true } }) } });
    render(<ShootEditingDialog shootId={4} onClose={vi.fn()} />);
    const videos = await screen.findByRole('switch', { name: 'Videos' });
    expect(videos).toBeDisabled();
    expect(videos).not.toBeChecked();
    expect(screen.getByText('Already sent to editing.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Send to editor' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(bodies()[0]).toMatchObject({ scope: 'photos' });
  });

  it('explains when everything was already sent', async () => {
    api.get.mockResolvedValue({ data: { data: plan({ photo: { available: true, sent: true }, video: { available: true, sent: true } }) } });
    render(<ShootEditingDialog shootId={4} onClose={vi.fn()} />);
    expect(await screen.findByRole('note')).toHaveTextContent('already been sent to editing');
    expect(screen.getByRole('button', { name: 'Send to editor' })).toBeDisabled();
  });

  it('sends the photos to the full-shoot AI workflow and the videos to the video editor', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Send to AI editing\s*Photos get/ }));
    expect(screen.getByRole('switch', { name: 'Photos' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Photos' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Videos' })).toBeChecked();
    expect(screen.getByText('Goes to the video editor. AI video editing is not available yet.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI editing' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(bodies()[0]).toMatchObject({ mode: 'ai', scope: 'whole', preset: 'full-shoot' });
  });

  it('keeps the videos back from a whole-shoot AI request when Videos is off', async () => {
    render(<ShootEditingDialog shootId={4} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Send to AI editing\s*Photos get/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Videos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI editing' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(bodies()[0]).toMatchObject({ mode: 'ai', scope: 'photos' });
  });
});

describe('Send selected media to editing', () => {
  const chooseAi = async () => fireEvent.click(await screen.findByRole('button', { name: /^Send to AI editing\s*Choose an AI preset/ }));

  it('sends each assigned preset as its own request and the rest as Enhancement', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} fileIds={[1, 2, 3, 4]} onClose={onClose} />);
    await chooseAi();
    fireEvent.change(screen.getByLabelText('Preset for Photo 1'), { target: { value: 'green-grass' } });
    fireEvent.change(screen.getByLabelText('Preset for Photo 2'), { target: { value: 'twilight' } });
    fireEvent.change(screen.getByLabelText('Preset for Photo 3'), { target: { value: 'twilight' } });
    expect(screen.queryByRole('option', { name: 'Full shoot enhancement' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI editing' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(bodies().map(body => [body.preset, body.file_ids])).toEqual([['green-grass', [1]], ['twilight', [2, 3]], ['listing-ready', [4]]]);
    expect(new Set(bodies().map(body => body.request_id)).size).toBe(3);
    expect(bodies().every(body => body.scope === 'selected' && body.mode === 'ai')).toBe(true);
  });

  it('sets every selected photo to one preset at once', async () => {
    render(<ShootEditingDialog shootId={4} fileIds={[1, 2]} onClose={vi.fn()} />);
    await chooseAi();
    fireEvent.change(screen.getByLabelText('Set all presets'), { target: { value: 'twilight' } });
    expect(screen.getByLabelText('Preset for Photo 1')).toHaveValue('twilight');
    expect(screen.getByLabelText('Preset for Photo 2')).toHaveValue('twilight');
  });

  it('retries only the presets that failed, with their original request ids', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} fileIds={[1, 2]} onClose={onClose} />);
    await chooseAi();
    fireEvent.change(screen.getByLabelText('Preset for Photo 1'), { target: { value: 'twilight' } });
    api.post.mockResolvedValueOnce({ data: { data: {} } }).mockRejectedValueOnce(new Error('Provider busy'));
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI editing' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enhancement: Provider busy');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry remaining' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(bodies().map(body => body.preset)).toEqual(['twilight', 'listing-ready', 'listing-ready']);
    expect(bodies()[2].request_id).toBe(bodies()[1].request_id);
  });

  it('shows an HDR stack as one photo whose exposures share a preset', async () => {
    const stack = [1, 2, 3].map(id => ({ id, name: `Photo ${id}`, version: 2 }));
    api.get.mockResolvedValue({ data: { data: { ...plan(), media: [...photos.slice(0, 3).map(file => ({ ...file, stack })), photos[3], video] } } });
    render(<ShootEditingDialog shootId={4} fileIds={[1, 2, 3, 4]} onClose={vi.fn()} />);
    await chooseAi();
    expect(screen.getAllByRole('combobox', { name: /^Preset for/ })).toHaveLength(2);
    expect(screen.getByText('HDR · 3 exposures')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Preset for Photo 1'), { target: { value: 'twilight' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI editing' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(bodies().map(body => [body.preset, body.file_ids])).toEqual([['twilight', [1, 2, 3]], ['listing-ready', [4]]]);
  });

  it('blocks videos from AI editing', async () => {
    render(<ShootEditingDialog shootId={4} fileIds={[1, 9]} onClose={vi.fn()} />);
    await chooseAi();
    expect(screen.getByRole('note')).toHaveTextContent('Video AI workflows are not enabled');
    expect(screen.getByRole('button', { name: 'Send to AI editing' })).toBeDisabled();
  });

  it('sends the selected files to a chosen editor with instructions', async () => {
    render(<ShootEditingDialog shootId={4} fileIds={[2, 3]} onClose={vi.fn()} />);
    expect(await screen.findByRole('list', { name: 'Selected files' })).toHaveTextContent('Photo 2');
    fireEvent.change(screen.getByLabelText('Editor'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Brighten the kitchen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to editor' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(bodies()[0]).toMatchObject({ mode: 'editor', scope: 'selected', preset: 'revision', file_ids: [2, 3], photo_editor_id: 7, instructions: 'Brighten the kitchen' });
  });
});
