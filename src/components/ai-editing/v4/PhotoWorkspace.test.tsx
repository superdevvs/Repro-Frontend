import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { V4WorkspaceProps } from '@/components/studio/v4/types';
import { PhotoWorkspace } from './PhotoWorkspace';
import { downloadWorkspaceOutput } from './downloadOutput';
import { studioWorkspaceService } from '@/services/studioWorkspaceService';

vi.mock('./downloadOutput', () => ({ downloadWorkspaceOutput: vi.fn().mockResolvedValue(undefined) }));

const makeProps = (): V4WorkspaceProps => ({
      workspace: { id: 'draft', name: 'Georgetown', presetId: 'listing-ready', media: [{ id: 'a', name: 'Exterior', kind: 'image', url: 'https://media.test/a.jpg', thumbnailUrl: 'https://media.test/a.jpg' }], config: { prompt: '', ratio: '9:16', duration: 30, transition: 'none', transitionDuration: 0, text: { title: '', subtitle: '', style: 'none', position: 'bottom' }, adjustments: {}, frames: [{ mediaId: 'a', duration: 5, method: 'fit' }] }, status: 'draft', progress: null, error: null, outputs: [], preparedFrames: [], createdAt: '', updatedAt: '' },
      preset: { id: 'listing-ready', name: 'Listing Ready', description: '', kind: 'image', tag: '', icon: '', color: '', workflow: 'photo-enhancement' }, busy: false, error: null,
      onBack: vi.fn(), onChangeMedia: vi.fn(), onSave: vi.fn().mockResolvedValue(undefined), onGenerate: vi.fn(), onPrepare: vi.fn(), onRefine: vi.fn(), onCancel: vi.fn(), onRefresh: vi.fn(), onDetect: vi.fn(),
});
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('photo generation scope and selected versions', () => {
  it('opens custom instructions on demand and preserves drafts through closing and failed refinement', async () => {
    const props = makeProps();
    props.workspace.outputs = [{ id: 'a-v1', mediaId: 'a', version: 1, status: 'completed', kind: 'image', url: '/edited.jpg' }];
    props.capabilities = { presets: {}, revision: { ready: true, referenceImages: false }, upscale: { ready: false }, outpaint: { ready: false } };
    props.onRefine = vi.fn().mockRejectedValueOnce(new Error('Retry this edit.')).mockResolvedValue(undefined);
    render(<PhotoWorkspace {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    expect(screen.queryByRole('button', { name: 'Before' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'After' })).not.toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Before and after comparison position' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Detect areas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Custom edit' })).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Custom edit' });
    fireEvent.click(trigger);
    let field = screen.getByRole('textbox', { name: 'Custom edit' });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: 'Remove the chair.' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Custom edit' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    field = screen.getByRole('textbox', { name: 'Custom edit' });
    expect(field).toHaveValue('Remove the chair.');
    fireEvent.click(screen.getByRole('button', { name: 'Apply custom edit' }));
    await screen.findByText('Retry this edit.');
    expect(field).toHaveValue('Remove the chair.');
    fireEvent.click(screen.getByRole('button', { name: 'Apply custom edit' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Custom edit' })).not.toBeInTheDocument());
    fireEvent.click(trigger);
    expect(screen.getByRole('textbox', { name: 'Custom edit' })).toHaveValue('');
    expect(props.onRefine).toHaveBeenCalledWith({ mediaId: 'a', outputId: 'a-v1', prompt: 'Remove the chair.', customEdit: true });
    expect(props.onGenerate).not.toHaveBeenCalled();
  });
  it('toggles comparison from the top toolbar and disables it for an original-only photo', () => {
    const props = makeProps();
    const { container, rerender } = render(<PhotoWorkspace {...props} />);
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();
    props.workspace.outputs = [{ id: 'a-v1', mediaId: 'a', version: 1, status: 'completed', kind: 'image', url: '/edited.jpg' }];
    rerender(<PhotoWorkspace {...props} />);
    const compare = within(container.querySelector('header') as HTMLElement).getByRole('button', { name: 'Compare' });
    expect(compare).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(compare);
    expect(screen.queryByRole('slider', { name: 'Before and after comparison position' })).not.toBeInTheDocument();
    fireEvent.click(compare);
    expect(screen.getByRole('slider', { name: 'Before and after comparison position' })).toBeVisible();
  });
  it('opens mobile instructions above the thumbnail rail outside the photo', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const props = makeProps();
    props.workspace.outputs = [{ id: 'a-v1', mediaId: 'a', version: 1, status: 'completed', kind: 'image', url: '/edited.jpg' }];
    const { container } = render(<PhotoWorkspace {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom edit' }));
    const field = screen.getByRole('textbox', { name: 'Custom edit' });
    const composer = container.querySelector('.v4-editor-mobile-content') as HTMLElement;
    expect(composer).toContainElement(field);
    expect(composer.nextElementSibling).toHaveClass('v4-editor-filmstrip');
    expect(container.querySelector('.v4-photo-image-frame')).not.toContainElement(field);
    expect(screen.getAllByRole('textbox', { name: 'Custom edit' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close custom edit' }));
    expect(screen.queryByRole('textbox', { name: 'Custom edit' })).not.toBeInTheDocument();
  });
  it('switches focused custom controls and saves the explicitly selected version without generating again', async () => {
    const props = makeProps();
    props.workspace.status = 'completed';
    props.workspace.outputs = [1, 2].map(version => ({ id: `a-v${version}`, mediaId: 'a', version, status: 'completed', url: `https://media.test/v${version}.jpg`, kind: 'image' }));
    props.onApplyEdits = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(studioWorkspaceService, 'previewEdits').mockReturnValue(new Promise(() => {}));
    render(<PhotoWorkspace {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Version 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Light & color' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Exposure' }), { target: { value: '1.2' } });
    expect(screen.queryByRole('slider', { name: 'Highlights' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tone' }));
    expect(screen.queryByRole('slider', { name: 'Exposure' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Shadows' }), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new version' }));
    await waitFor(() => expect(props.onApplyEdits).toHaveBeenCalledWith({ exposure: 1.2, shadows: 20 }, [{ mediaId: 'a', outputId: 'a-v1' }]));
    expect(props.onGenerate).not.toHaveBeenCalled();
    expect(props.onRefine).not.toHaveBeenCalled();
  });

  it('sends only relevant provider settings and keeps scene controls in a separate panel', () => {
    const props = makeProps();
    render(<PhotoWorkspace {...props} />);
    expect(screen.queryByRole('slider', { name: 'Window recovery' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Window recovery').tagName).toBe('SELECT');
    expect(screen.queryByLabelText('TV screens')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Scene details' }));
    expect(screen.getByLabelText('TV screens')).toBeVisible();
    expect(screen.queryByLabelText('Window recovery')).not.toBeInTheDocument();
  });
  it('makes completed shoot AI outputs ready without requiring manual review', () => {
    const props = makeProps();
    props.workspace = { ...props.workspace, shootId: 42, status: 'completed', outputs: [{ id: 'out-1', mediaId: 'a', url: 'https://media.test/edited.jpg', kind: 'image', version: 1, status: 'completed' }] };
    render(<PhotoWorkspace {...props} />);
    expect(screen.getByRole('button', { name: 'Needs review 0' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ready 1' })).toBeVisible();
  });
  it('shows one result per HDR stack, refreshes its thumbnail, and keeps every exposure in generation scope', async () => {
    const props = makeProps();
    const media = Array.from({ length: 6 }, (_, i) => ({ id: `raw-${i}`, name: `Exposure ${i}.CR3`, kind: 'raw' as const, url: `https://media.test/raw-${i}.jpg`, thumbnailUrl: `https://media.test/raw-${i}.jpg` }));
    props.preset = { ...props.preset, id: 'full-shoot', name: 'Full Shoot' };
    props.workspace = { ...props.workspace, shootId: 42, presetId: 'full-shoot', status: 'draft', media, requiresReview: false,
      photoGroups: [{ mediaId: 'raw-2', sourceMediaIds: media.slice(0, 5).map(item => item.id), sourceFileIds: [1, 2, 3, 4, 5], name: 'Living room-HDR.jpg' }, { mediaId: 'raw-5', sourceMediaIds: ['raw-5'], sourceFileIds: [6], name: 'Single.jpg' }] };
    const { container, rerender } = render(<PhotoWorkspace {...props} />);
    const strip = screen.getByRole('group', { name: 'Edited images · 6 original exposures' });
    expect(within(strip).getAllByRole('button')).toHaveLength(2);
    fireEvent.click(within(container.querySelector('.v4-editor-desktop-actions') as HTMLElement).getByRole('button', { name: 'Generate 2 photos' }));
    await waitFor(() => expect(props.onGenerate).toHaveBeenCalledWith(expect.objectContaining({ frames: media.map(item => ({ mediaId: item.id, method: 'fit', duration: 5 })) })));
    const outputs = props.workspace.photoGroups!.map((group, i) => ({ id: `out-${i}`, name: `2912-park-avenue_00${i + 1}.jpg`, mediaId: group.mediaId, sourceMediaIds: group.sourceMediaIds, url: `https://media.test/merged-${i}.jpg`, kind: 'image' as const, status: 'completed', version: 1 }));
    rerender(<PhotoWorkspace {...props} workspace={{ ...props.workspace, status: 'completed', outputs }} />);
    expect(within(strip).getByRole('button', { name: 'Select 2912-park-avenue_001.jpg' }).querySelector('img')).toHaveAttribute('src', 'https://media.test/merged-0.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));
    expect(screen.getByRole('button', { name: 'Ready 2' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Approve shoot edits' })).not.toBeInTheDocument();
  });
  it('requires explicit full-shoot review and approval before delivery', async () => {
    const props = makeProps();
    props.preset = { ...props.preset, id: 'full-shoot', name: 'Full Shoot' };
    props.workspace = { ...props.workspace, presetId: 'full-shoot', shootId: 42, status: 'completed', outputs: [{ id: 'out-1', mediaId: 'a', url: 'https://media.test/edited.jpg', kind: 'image', version: 1, status: 'completed' }] };
    props.onApproveShoot = vi.fn().mockRejectedValueOnce(new Error('Wait for the other editing lanes.')).mockResolvedValue(undefined);
    const { container } = render(<PhotoWorkspace {...props} />);
    expect(screen.getByRole('button', { name: 'Needs review 1' })).toBeVisible();
    const actions = within(container.querySelector('.v4-editor-desktop-actions') as HTMLElement);
    expect(actions.getByRole('button', { name: 'Approve shoot edits' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Use this photo' }));
    fireEvent.click(actions.getByRole('button', { name: 'Approve shoot edits' }));
    await screen.findByText('Wait for the other editing lanes.');
    expect(screen.queryByRole('heading', { name: 'Your photos are ready' })).not.toBeInTheDocument();
    fireEvent.click(actions.getByRole('button', { name: 'Approve shoot edits' }));
    await screen.findByRole('heading', { name: 'Your photos are ready' });
    expect(props.onApproveShoot).toHaveBeenCalledTimes(2);
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ reviewedOutputIds: ['out-1'] }));
  });
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

  it('keeps focus visible while a completed, loaded photo unblurs, then restores comparison', () => {
    vi.useFakeTimers();
    const props = makeProps();
    props.workspace = { ...props.workspace, status: 'generating', progress: 50 };
    const { container, rerender } = render(<PhotoWorkspace {...props} />);
    const output = { id: 'a-v1', mediaId: 'a', url: '/edited.jpg', kind: 'image' as const, version: 1, status: 'completed' };
    rerender(<PhotoWorkspace {...props} workspace={{ ...props.workspace, status: 'completed', progress: 100, outputs: [output] }} />);
    expect(container.querySelector('.v4-photo-focus')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Loading edited photo' })).toBeVisible();
    fireEvent.load(screen.getByAltText('Exterior edited'));
    expect(container.querySelector('.is-revealing')).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Before and after comparison position' })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4200));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Before and after comparison position' })).toBeVisible();
  });

  it('animates a grouped re-edit despite older outputs and reveals each new group as it arrives', () => {
    vi.useFakeTimers();
    const props = makeProps();
    props.preset = { ...props.preset, id: 'full-shoot', name: 'Full Shoot' };
    const media = [...props.workspace.media, { id: 'b', name: 'Interior', kind: 'image' as const, url: '/b.jpg', thumbnailUrl: '/b.jpg' }];
    const oldOutputs = media.map(item => ({ id: `${item.id}-v1`, mediaId: item.id, url: `/${item.id}-v1.jpg`, kind: 'image' as const, version: 1, status: 'completed' }));
    props.workspace = { ...props.workspace, presetId: 'full-shoot', status: 'completed', media, outputs: oldOutputs, photoGroups: media.map(item => ({ mediaId: item.id, name: item.name, sourceMediaIds: [item.id], sourceFileIds: [] })) };
    const { rerender } = render(<PhotoWorkspace {...props} />);
    const running = { ...props.workspace, status: 'generating' as const, progress: 37, generation: { phase: 'generating' as const, total: 2, submitted: 2, completed: 0 } };
    rerender(<PhotoWorkspace {...props} workspace={running} />);
    expect(screen.getAllByRole('progressbar', { name: 'Photo editing job' })).toHaveLength(2);
    const newOutput = { ...oldOutputs[0], id: 'a-v2', url: '/a-v2.jpg', version: 2 };
    rerender(<PhotoWorkspace {...props} workspace={{ ...running, outputs: [...oldOutputs, newOutput], generation: { ...running.generation, completed: 1 } }} />);
    fireEvent.load(within(screen.getByRole('button', { name: 'Open Exterior' })).getByAltText('Exterior'));
    expect(screen.getByRole('progressbar', { name: 'Ready to review' })).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Photo editing job' })).toBeVisible();
    act(() => vi.advanceTimersByTime(4200));
    expect(screen.queryByRole('progressbar', { name: 'Ready to review' })).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Photo editing job' })).toBeVisible();
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

  it('stages through room, style, removal, and arrangement controls', () => {
    const props = makeProps();
    props.preset = { ...props.preset, id: 'virtual-staging', name: 'Virtual staging' };
    props.workspace = { ...props.workspace, presetId: 'virtual-staging', config: { ...props.workspace.config, adjustments: { roomType: 'living', furnitureStyle: 'modern', removal: 'off', addFurniture: true, variationCount: 1 } } };
    props.capabilities = { presets: { 'virtual-staging': { ready: true } }, revision: { ready: true, referenceImages: false }, upscale: { ready: false }, outpaint: { ready: true } };
    render(<PhotoWorkspace {...props} />);
    expect(screen.getByLabelText('Room type')).toHaveValue('living');
    expect(screen.getByRole('option', { name: 'Kitchen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Furniture style')).toHaveValue('modern');
    expect(screen.getByRole('option', { name: 'Coastal' })).toBeInTheDocument();
    expect(screen.getByLabelText('What to do')).toHaveValue('off');
    expect(screen.getByLabelText('Arrangements')).toHaveValue('1');
    expect(screen.queryByText('Brightness')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Stage 1 photo' }).every(button => !button.hasAttribute('disabled'))).toBe(true);
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
