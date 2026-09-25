import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootEditingDialog } from './ShootEditingDialog';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: api }));
vi.mock('@/components/studio/v4/StudioImage', () => ({ StudioImage: ({ alt }: { alt: string }) => <span>{alt}</span> }));

const plan = { shootId: 4, photoCount: 2, photos: [{ id: 1, name: 'Living room', url: '', available: true }, { id: 2, name: 'Garden', url: '', available: true }], services: ['Photos', 'Virtual staging', 'Green grass', 'Video'], hasVideo: true, addons: [{ preset: 'virtual-staging', label: 'Virtual staging', fileIds: [] }, { preset: 'green-grass', label: 'Grass greening', fileIds: [2] }] };
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: { data: plan } }); api.post.mockResolvedValue({ data: {} }); });

describe('shoot editing dispatch', () => {
  it('requires untagged add-on targets and sends linked AI services with all photos', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} onClose={onClose} />);
    await screen.findByText('Photos · Virtual staging · Green grass · Video · 2 photos');
    fireEvent.click(screen.getByRole('button', { name: /Send to AI editing.*Edit the full/ }));
    const send = screen.getByRole('button', { name: 'Send to AI editing' });
    expect(send).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Grass greening: Garden' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Virtual staging: Living room' }));
    expect(send).toBeEnabled();
    fireEvent.click(send);
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(api.post).toHaveBeenCalledWith('/shoots/4/editing-dispatch', expect.objectContaining({ mode: 'ai', targets: { 'virtual-staging': [1], 'green-grass': [2] } }));
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('file_ids');
  });

  it('routes a partial selection to Autoenhance without demanding shoot add-ons', async () => {
    render(<ShootEditingDialog shootId={4} fileIds={[2]} onClose={vi.fn()} />);
    await screen.findByText('Selected photos · Autoenhance · 1 photos');
    expect(screen.getByText('Finished selected-photo edits appear directly in Edited, without a review step.')).toBeVisible();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sky-replacement' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI editing' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/shoots/4/editing-dispatch', expect.objectContaining({ file_ids: [2], preset: 'sky-replacement', targets: {} })));
  });

  it('uses the complete server photo set when the media panel selects all', async () => {
    render(<ShootEditingDialog shootId={4} fileIds={[2, 1]} onClose={vi.fn()} />);
    await screen.findByText('Full Shoot · Fotello · all 2 photos');
    expect(screen.getByText(/Full-shoot photos go to In Review for approval/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send to AI editing' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Virtual staging: Living room' })).toBeVisible();
  });

  it('keeps manual photo and video editing available without selecting AI targets', async () => {
    const onClose = vi.fn();
    render(<ShootEditingDialog shootId={4} onClose={onClose} />);
    await screen.findByText('Photos · Virtual staging · Green grass · Video · 2 photos');
    fireEvent.click(screen.getByRole('button', { name: 'Send to editor' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(api.post).toHaveBeenCalledWith('/shoots/4/editing-dispatch', expect.objectContaining({ mode: 'editor', targets: {} }));
  });
});
import '@testing-library/jest-dom/vitest';
