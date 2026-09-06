import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { V4WorkspaceProps } from '@/components/studio/v4/types';
import { VideoWorkspace } from './VideoWorkspace';

const makeProps = (): V4WorkspaceProps => ({
  workspace: { id: 'draft', version: 4, name: 'Georgetown', presetId: 'walkthrough',
    media: ['a', 'b'].map(id => ({ id, name: `Photo ${id}`, kind: 'image', url: `https://media.test/${id}.jpg`, thumbnailUrl: `https://media.test/${id}.jpg` })),
    config: { prompt: 'Keep the architecture', ratio: '9:16', duration: 10, transition: 'none', transitionDuration: .5,
      text: { title: '', subtitle: '', style: 'none', position: 'bottom' }, adjustments: {},
      frames: ['a', 'b'].map(mediaId => ({ mediaId, method: 'extend', duration: 5 })) },
    status: 'failed', progress: 45, error: 'The provider could not finish preparation.', outputs: [],
    preparedFrames: [{ mediaId: 'a', method: 'extend', ratio: '9:16', url: 'https://media.test/a-ready.jpg', status: 'completed', version: 1 }], createdAt: '', updatedAt: '' },
  preset: { id: 'walkthrough', name: 'Walkthrough', description: '', kind: 'video', tag: '', icon: '', color: '', workflow: 'reel-generator' }, busy: false, error: null,
  onBack: vi.fn(), onChangeMedia: vi.fn(), onSave: vi.fn().mockResolvedValue(undefined), onGenerate: vi.fn().mockResolvedValue(undefined),
  onPrepare: vi.fn().mockResolvedValue(undefined), onRefine: vi.fn(), onCancel: vi.fn(), onRefresh: vi.fn(), onDetect: vi.fn(),
});
afterEach(cleanup);

describe('video job recovery and live progress', () => {
  it('offers one explicit retry for failed preparation and keeps the original scope and completed frames', async () => {
    const props = makeProps();
    const { container } = render(<VideoWorkspace {...props} />);
    const actions = within(container.querySelector('.v4-editor-desktop-actions') as HTMLElement);
    expect(screen.getByText('Frame preparation stopped')).toBeVisible();
    expect(screen.getByText(/1 of 2 frames are ready/)).toBeVisible();
    expect(props.onPrepare).not.toHaveBeenCalled();
    expect(props.onGenerate).not.toHaveBeenCalled();
    fireEvent.click(actions.getByRole('button', { name: 'Retry frame preparation' }));
    await waitFor(() => expect(props.onPrepare).toHaveBeenCalledExactlyOnceWith(props.workspace.config));
    expect(props.workspace.preparedFrames).toHaveLength(1);
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('keeps queued and in-progress clips in processing without offering retry or starting another paid job', () => {
    const props = makeProps();
    props.workspace = { ...props.workspace, status: 'generating', error: null, progress: 10,
      generation: { phase: 'generating', total: 12, submitted: 12, completed: 0 } };
    render(<VideoWorkspace {...props} />);
    expect(screen.getByText(/0 of 12 clips ready · 12 submitted/)).toBeVisible();
    expect(screen.queryByText('Frame preparation stopped')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(props.onPrepare).not.toHaveBeenCalled();
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('does not resume or offer failed-preparation retry for a cancelled job', () => {
    const props = makeProps();
    props.workspace = { ...props.workspace, status: 'cancelled', error: null };
    render(<VideoWorkspace {...props} />);
    expect(screen.queryByRole('button', { name: 'Retry frame preparation' })).not.toBeInTheDocument();
    expect(props.onPrepare).not.toHaveBeenCalled();
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('distinguishes final rendering from clips waiting in the provider queue', () => {
    const props = makeProps();
    props.workspace = { ...props.workspace, status: 'generating', error: null,
      generation: { phase: 'rendering', total: 12, submitted: 12, completed: 12 } };
    render(<VideoWorkspace {...props} />);
    expect(screen.getByText('Your clips are ready. Rendering the final reel…')).toBeVisible();
    expect(screen.queryByText(/Queued clips will start/)).not.toBeInTheDocument();
  });
});
