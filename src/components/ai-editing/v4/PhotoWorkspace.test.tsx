import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { V4WorkspaceProps } from '@/components/studio/v4/types';
import { PhotoWorkspace } from './PhotoWorkspace';
import { downloadWorkspaceOutput } from './downloadOutput';

vi.mock('./downloadOutput', () => ({ downloadWorkspaceOutput: vi.fn().mockResolvedValue(undefined) }));

const makeProps = (): V4WorkspaceProps => ({
      workspace: { id: 'draft', name: 'Georgetown', presetId: 'listing-ready', media: [{ id: 'a', name: 'Exterior', kind: 'image', url: 'https://media.test/a.jpg', thumbnailUrl: 'https://media.test/a.jpg' }], config: { prompt: '', ratio: '9:16', duration: 30, transition: 'none', transitionDuration: 0, text: { title: '', subtitle: '', style: 'none', position: 'bottom' }, adjustments: {}, frames: [{ mediaId: 'a', duration: 5, method: 'fit' }] }, status: 'draft', progress: null, error: null, outputs: [], preparedFrames: [], createdAt: '', updatedAt: '' },
      preset: { id: 'listing-ready', name: 'Listing Ready', description: '', kind: 'image', tag: '', icon: '', color: '', workflow: 'photo-enhancement' }, busy: false, error: null,
      onBack: vi.fn(), onChangeMedia: vi.fn(), onSave: vi.fn().mockResolvedValue(undefined), onGenerate: vi.fn(), onPrepare: vi.fn(), onRefine: vi.fn(), onCancel: vi.fn(), onRefresh: vi.fn(), onDetect: vi.fn(),
});
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('photo generation scope and selected versions', () => {
  it('places live progress over the photo instead of a separate banner and removes it on completion', () => {
    const props = makeProps();
    props.workspace = { ...props.workspace, status: 'generating', progress: 37 };
    const { container, rerender } = render(<PhotoWorkspace {...props} />);
    const progress = screen.getByRole('progressbar', { name: 'Editing photos' });
    expect(progress).toHaveAttribute('aria-valuenow', '37');
    expect(container.querySelector('.v4-photo-focus')).toContainElement(progress);
    expect(container.querySelector('.v4-photo-focus img')).toHaveAttribute('src', props.workspace.media[0].url);
    expect(container.querySelector('.v4-generation-banner')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh progress' }));
    expect(props.onRefresh).toHaveBeenCalledOnce();
    rerender(<PhotoWorkspace {...props} workspace={{ ...props.workspace, status: 'completed', progress: 100 }} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('animates selected gallery photos without adding refresh buttons inside the photo buttons', () => {
    const props = makeProps();
    props.workspace = { ...props.workspace, status: 'generating', progress: 0 };
    const { container } = render(<PhotoWorkspace {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));
    const card = screen.getByRole('button', { name: 'Open Exterior' });
    expect(card).toContainElement(screen.getByRole('progressbar', { name: 'Photo editing job' }));
    expect(card.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelector('.v4-generation-banner')).toBeNull();
  });

  it('does not suggest an unselected source photo is being edited', () => {
    const props = makeProps();
    props.workspace = { ...props.workspace, status: 'generating', progress: 35, media: [...props.workspace.media, { id: 'b', name: 'Interior', kind: 'image', url: 'https://media.test/b.jpg', thumbnailUrl: 'https://media.test/b.jpg' }] };
    render(<PhotoWorkspace {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select Interior' }));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('never shows a generation overlay on failed or cancelled photo jobs', () => {
    const props = makeProps();
    const { rerender } = render(<PhotoWorkspace {...props} workspace={{ ...props.workspace, status: 'failed' }} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    rerender(<PhotoWorkspace {...props} workspace={{ ...props.workspace, status: 'cancelled' }} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
  it('upscales the selected older version only when the server reports the service ready', async () => {
    const props = makeProps();
    props.workspace.status = 'completed';
    props.workspace.outputs = [1, 2].map(version => ({ id: `a-v${version}`, mediaId: 'a', version, status: 'completed', url: `https://media.test/v${version}.jpg`, kind: 'image' }));
    props.onUpscale = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<PhotoWorkspace {...props} />);
    expect(screen.getByRole('button', { name: 'Upscale version 2' })).toBeDisabled();
    props.capabilities = { presets: {}, revision: { ready: true, referenceImages: true }, upscale: { ready: true }, outpaint: { ready: true } };
    rerender(<PhotoWorkspace {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Version 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upscale version 1' }));
    await waitFor(() => expect(props.onUpscale).toHaveBeenCalledWith('a', 'a-v1'));
    expect(screen.queryByText(/fotello/i)).not.toBeInTheDocument();
  });

  it('disables generation for an unconfigured photo service', () => {
    const props = makeProps();
    props.capabilities = { presets: { 'listing-ready': { ready: false, reason: 'An administrator needs to configure this edit.' } }, revision: { ready: true, referenceImages: false }, upscale: { ready: false }, outpaint: { ready: true } };
    const { container } = render(<PhotoWorkspace {...props} />);
    expect(container.querySelector('.v4-editor-desktop-actions button[data-variant=primary]')).toBeDisabled();
    expect(screen.getByText('An administrator needs to configure this edit.')).toBeVisible();
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('allows deselecting the last photo without silently selecting the full shoot', () => {
    const props = makeProps();
    const { container } = render(<PhotoWorkspace {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply to selected photos' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Exterior' }));
    expect(within(dialog).getByRole('button', { name: 'Exterior' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(dialog).getByRole('button', { name: 'Use 0 photos' })).toBeDisabled();
    const generate = container.querySelector('.v4-editor-desktop-actions button[data-variant=primary]');
    expect(generate).toHaveTextContent('Generate 0 photos');
    expect(generate).toBeDisabled();
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('uses the explicitly reviewed older version in the gallery, saved review, download and shared link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const browserNavigator = Object.create(navigator);
    Object.defineProperty(browserNavigator, 'clipboard', { value: { writeText } });
    Object.defineProperty(browserNavigator, 'share', { value: undefined });
    vi.stubGlobal('navigator', browserNavigator);
    const props = makeProps();
    props.workspace.status = 'completed';
    props.workspace.outputs = [1, 2, 3].map(version => ({ id: `a-v${version}`, mediaId: 'a', version, status: 'completed', url: `https://media.test/exterior-v${version}.jpg`, kind: 'image' }));
    props.workspace.config.reviewedOutputIds = ['a-v3'];
    const { container, unmount } = render(<PhotoWorkspace {...props} />);
    const actions = within(container.querySelector('.v4-editor-desktop-actions') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Version 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use this photo' }));
    expect(actions.getByRole('button', { name: 'Finish review' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));
    expect(container.querySelector('.v4-media-card img')).toHaveAttribute('src', 'https://media.test/exterior-v1.jpg');
    fireEvent.click(actions.getByRole('button', { name: 'Finish review' }));
    await screen.findByRole('heading', { name: 'Your photos are ready' });
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ reviewedOutputIds: ['a-v1'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(downloadWorkspaceOutput).toHaveBeenCalledWith('draft', expect.objectContaining({ id: 'a-v1', version: 1 }), 'Exterior'));
    fireEvent.click(actions.getByRole('button', { name: 'Share photos' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://media.test/exterior-v1.jpg'));
    unmount();
    props.workspace.config.reviewedOutputIds = ['a-v1'];
    const reopened = render(<PhotoWorkspace {...props} />);
    expect(reopened.container.querySelector('.v4-media-card img')).toHaveAttribute('src', 'https://media.test/exterior-v1.jpg');
  });
});
