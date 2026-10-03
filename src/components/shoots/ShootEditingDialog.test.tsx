import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootEditingDialog } from './ShootEditingDialog';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: api }));
const media = Array.from({ length: 32 }, (_, i) => ({ id: i + 1, name: `Photo ${i + 1}`, version: 2, lane: 'photo', source: i ? 'raw' : 'edited', available: true, stack: [{ id: i + 1, name: `Photo ${i + 1}`, version: 2 }] }));
const plan = { media, workflows: [
  { id: 'full-shoot', label: 'Full shoot enhancement', available: true, provider: 'fotello' },
  { id: 'listing-ready', label: 'Enhancement', available: true, provider: 'autoenhance' },
  { id: 'twilight', label: 'Twilight', available: false, provider: 'fal', reason: 'Provider key missing' },
], editors: [{ id: 7, name: 'Photo editor A', lanes: ['photo'] }, { id: 8, name: 'Video editor B', lanes: ['video'] }], addons: [], videoAi: { available: false, reason: 'Video AI workflows are not enabled yet. Choose a human video editor.' } };
beforeEach(() => {
  vi.clearAllMocks(); api.get.mockResolvedValue({ data: { data: plan } });
  api.post.mockImplementation(async (url, body) => ({ data: { data: url.endsWith('editing-plan') ? {
    scope: body.scope, inputCount: 1, sourceCount: 2, items: [{ key: 'stack:1', workflow: body.preset, sources: [{ id: 1, name: 'Photo 1', version: 2 }, { id: 2, name: 'Photo 2', version: 2 }], destination: body.mode === 'editor' ? 'human' : 'ai', editor_name: 'Photo editor A', publication: 'Replace current image and keep its previous version' }],
  } : {} } }));
});
describe('explicit editing requests', () => {
  it('retains selected scope when all photos are selected and previews expanded sources before dispatch', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} fileIds={media.map(file => file.id)} onClose={onClose} />);
    await screen.findByLabelText('Scope');
    expect(screen.getByLabelText('Scope')).toHaveValue('selected');
    expect(screen.getByLabelText('Workflow')).toHaveValue('listing-ready');
    fireEvent.click(screen.getByRole('button', { name: 'Review request' }));
    await screen.findByRole('region', { name: 'Editing request preview' });
    expect(onClose).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Confirm 1 editing inputs · 2 source exposures/files')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and send' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(api.post.mock.calls[1][1]).toMatchObject({ scope: 'selected', file_ids: media.map(file => file.id), source_versions: { 1: 2 }, preset: 'listing-ready' });
    expect(api.post.mock.calls[1][1]).toEqual(api.post.mock.calls[0][1]);
  });
  it('keeps selections across pagination and permits a human override with instructions', async () => {
    render(<ShootEditingDialog shootId={4} fileIds={[1]} onClose={vi.fn()} />);
    await screen.findByLabelText('Scope');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByLabelText('Select Photo 32'));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByLabelText('Select Photo 1')).toBeChecked();
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'editor' } });
    fireEvent.change(screen.getByLabelText('Photo editor'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Green the lawn only' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review request' }));
    await screen.findByRole('button', { name: 'Confirm and send' });
    expect(api.post.mock.calls[0][1]).toMatchObject({ scope: 'selected', mode: 'editor', file_ids: [1, 32], photo_editor_id: 7, instructions: 'Green the lawn only' });
  });
  it('blocks AI video submissions and shows unavailable workflow reasons', async () => {
    render(<ShootEditingDialog shootId={4} fileIds={[1]} onClose={vi.fn()} />);
    await screen.findByLabelText('Scope');
    expect(screen.getByRole('option', { name: 'Twilight — Provider key missing' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'videos' } });
    expect(screen.getByRole('button', { name: 'Review request' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Video AI workflows are not enabled');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('keeps confirmation open after response loss and retries the identical request id once per click', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} fileIds={[1]} onClose={onClose} />);
    await screen.findByLabelText('Scope');
    fireEvent.click(screen.getByRole('button', { name: 'Review request' }));
    await screen.findByRole('button', { name: 'Confirm and send' });
    api.post.mockRejectedValueOnce(new Error('Connection interrupted'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and send' }));
    await screen.findByRole('alert');
    expect(onClose).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Confirm and send' });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledTimes(3);
    expect(api.post.mock.calls[2][1]).toEqual(api.post.mock.calls[1][1]);
  });
});
