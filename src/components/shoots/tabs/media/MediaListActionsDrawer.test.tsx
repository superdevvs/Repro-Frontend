import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { MediaFile } from '@/hooks/useShootFiles';
import { useMediaGridActions } from './useMediaGridActions';

type Options = Parameters<typeof useMediaGridActions>[0];
const file: MediaFile = { id: 'one', filename: 'living-room.jpg', thumb_url: '/thumbnail.jpg' };
const options = (): Options => ({
  canInteractSingleMedia: true, canInteractWithFile: () => true,
  canDownloadSingleMedia: true, isClient: false,
  canManageVisibility: () => true, canSetHero: () => true,
  toggleFileHidden: vi.fn(), onSetHero: vi.fn(), onToggleFavorite: vi.fn(),
  onAddComment: vi.fn(), onDownloadSingle: vi.fn(),
});

function Row({ actions, media = file, view = 'list', onViewer = vi.fn(), onDrag = vi.fn(), previewUrl = '/thumbnail.jpg' }: {
  actions: Options; media?: MediaFile | null; view?: 'list' | 'grid'; onViewer?: () => void; onDrag?: () => void; previewUrl?: string | null;
}) {
  const { renderListMediaActions, renderSingleMediaActions } = useMediaGridActions(actions);
  return <div data-testid="media-row" onClick={onViewer} onPointerDown={onDrag}>
    {media && (view === 'list' ? renderListMediaActions(media, previewUrl ?? undefined) : renderSingleMediaActions(media, true))}
  </div>;
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture;
  delete (HTMLElement.prototype as Partial<HTMLElement>).releasePointerCapture;
});

async function openDrawer() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Media actions for living-room.jpg' }));
  return { user, drawer: screen.getByRole('dialog', { name: 'File actions' }) };
}

function finishCloseAnimation(drawer: HTMLElement) {
  expect(drawer).toHaveAttribute('data-state', 'closed');
  // jsdom does not run Vaul's CSS exit animations or emit their completion.
  for (const [element, animationName] of [[document.querySelector('[data-vaul-overlay]'), 'fadeOut'], [drawer, 'slideToBottom']] as const) {
    if (!element) continue;
    const event = new Event('animationend', { bubbles: true });
    Object.defineProperty(event, 'animationName', { value: animationName });
    fireEvent(element, event);
  }
}

describe('list media actions drawer', () => {
  it('opens one bottom drawer and performs the existing actions without opening the row viewer', async () => {
    const actions = options();
    const onViewer = vi.fn();
    const onDrag = vi.fn();
    render(<Row actions={actions} onViewer={onViewer} onDrag={onDrag} />);
    const trigger = screen.getByRole('button', { name: 'Media actions for living-room.jpg' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const { user, drawer } = await openDrawer();
    expect(within(drawer).getByRole('button', { name: 'Close file actions' })).toHaveFocus();
    expect(within(drawer).getByText('living-room.jpg')).toBeVisible();
    expect(drawer.querySelector('img')).toHaveAttribute('src', '/thumbnail.jpg');
    expect(drawer).toHaveClass('bottom-0', 'z-[121]');
    expect(document.querySelector('[data-vaul-overlay]')).toHaveClass('z-[120]');
    await user.click(within(drawer).getByRole('button', { name: 'Like image' }));
    await user.click(within(drawer).getByRole('button', { name: 'Set hero image' }));
    await user.click(within(drawer).getByRole('button', { name: 'Hide image' }));
    expect(actions.onToggleFavorite).toHaveBeenCalledExactlyOnceWith('one');
    expect(actions.onSetHero).toHaveBeenCalledExactlyOnceWith('one');
    expect(actions.toggleFileHidden).toHaveBeenCalledExactlyOnceWith('one', true);
    await user.click(within(drawer).getByRole('button', { name: 'Done' }));
    finishCloseAnimation(drawer);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onViewer).not.toHaveBeenCalled();
    expect(onDrag).not.toHaveBeenCalled();
  });

  it('writes and cancels comments inside the drawer without another popover', async () => {
    const actions = options();
    const onViewer = vi.fn();
    render(<Row actions={actions} onViewer={onViewer} media={{ ...file, latest_comment: { comment: 'Earlier note' } }} />);
    const { user, drawer } = await openDrawer();
    await user.click(within(drawer).getByRole('button', { name: 'Add comment' }));
    const input = within(drawer).getByRole('textbox', { name: 'Add a comment' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(drawer).getByText('Latest: Earlier note')).toBeVisible();
    expect(within(drawer).getByRole('button', { name: 'Post comment' })).toBeDisabled();
    await user.type(input, '  Brighten the windows  ');
    await user.click(within(drawer).getByRole('button', { name: 'Post comment' }));
    expect(actions.onAddComment).toHaveBeenCalledExactlyOnceWith('one', 'Brighten the windows');
    expect(within(drawer).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Add comment' }));
    await user.type(within(drawer).getByRole('textbox'), 'Discard this');
    await user.click(within(drawer).getByRole('button', { name: 'Cancel comment' }));
    expect(actions.onAddComment).toHaveBeenCalledTimes(1);
    expect(onViewer).not.toHaveBeenCalled();
  });

  it('honors per-file and role restrictions without granting additional actions', async () => {
    const actions = { ...options(), canInteractWithFile: () => false, canManageVisibility: () => false, canSetHero: () => false };
    render(<Row actions={actions} />);
    const { drawer } = await openDrawer();
    expect(within(drawer).getByRole('button', { name: 'Download image' })).toBeEnabled();
    for (const name of ['Like image', 'Add comment', 'Hide image', 'Set hero image']) {
      expect(within(drawer).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('omits the menu when the file has no available actions', () => {
    render(<Row actions={{ canInteractSingleMedia: false, canDownloadSingleMedia: () => false, isClient: true }} />);
    expect(screen.queryByRole('button', { name: /Media actions/ })).not.toBeInTheDocument();
  });

  it('reflects refreshed favorite, visibility and current-hero values while open', async () => {
    const actions = options();
    const { rerender } = render(<Row actions={actions} />);
    const { user, drawer } = await openDrawer();
    rerender(<Row actions={actions} media={{ ...file, is_favorite: true, is_hidden: true, is_cover: true }} />);
    await user.click(within(drawer).getByRole('button', { name: 'Unlike image' }));
    await user.click(within(drawer).getByRole('button', { name: 'Unhide image' }));
    const hero = within(drawer).getByRole('button', { name: 'Set hero image' });
    expect(hero).toBeDisabled();
    expect(hero).toHaveTextContent('Current hero image');
    await user.click(hero);
    expect(actions.onSetHero).not.toHaveBeenCalled();
    expect(actions.toggleFileHidden).toHaveBeenCalledExactlyOnceWith('one', false);
    expect(actions.onToggleFavorite).toHaveBeenCalledExactlyOnceWith('one');
  });

  it('prevents duplicate downloads and reflects external busy state without closing the drawer', async () => {
    let complete!: () => void;
    const actions = { ...options(), onDownloadSingle: vi.fn(() => new Promise<void>(resolve => { complete = resolve; })) };
    const { rerender } = render(<Row actions={actions} />);
    const { drawer } = await openDrawer();
    const download = within(drawer).getByRole('button', { name: 'Download image' });
    fireEvent.click(download);
    fireEvent.click(download);
    expect(actions.onDownloadSingle).toHaveBeenCalledExactlyOnceWith('one');
    expect(download).toBeDisabled();
    expect(download).toHaveAttribute('aria-busy', 'true');
    expect(download.querySelector('svg.animate-spin')).not.toBeNull();
    rerender(<Row actions={{ ...actions, downloadingFileIds: new Set(['one']) }} />);
    await act(async () => { complete(); });
    expect(download).toBeDisabled();
    rerender(<Row actions={{ ...actions, downloadingFileIds: new Set() }} />);
    expect(download).toBeEnabled();
    expect(screen.getByRole('dialog', { name: 'File actions' })).toBeVisible();
  });

  it.each(['removed', 'grid'] as const)('closes when the row is %s', async change => {
    const actions = options();
    const { rerender } = render(<Row actions={actions} />);
    await openDrawer();
    rerender(<Row actions={actions} media={change === 'removed' ? null : file} view={change === 'grid' ? 'grid' : 'list'} />);
    expect(screen.queryByRole('dialog', { name: 'File actions' })).not.toBeInTheDocument();
  });

  it('never falls back to hidden file URL fields when no safe preview was supplied', async () => {
    render(<Row actions={options()} previewUrl={null} media={{ ...file, is_hidden: true, thumb_url: '/private-original.jpg', grid_url: '/private-original.jpg', thumb: '/private-original.jpg' }} />);
    const { drawer } = await openDrawer();
    expect(drawer.querySelector('img')).toBeNull();
    expect(document.body.innerHTML).not.toContain('/private-original.jpg');
  });

  it('releases a failed download so it can be retried without an unhandled rejection', async () => {
    const actions = { ...options(), onDownloadSingle: vi.fn().mockRejectedValueOnce(new Error('Network failed')).mockResolvedValue(undefined) };
    render(<Row actions={actions} />);
    const { user, drawer } = await openDrawer();
    await user.click(within(drawer).getByRole('button', { name: 'Download image' }));
    expect(await within(drawer).findByRole('alert')).toHaveTextContent('Download failed. Try again.');
    expect(within(drawer).getByRole('button', { name: 'Download image' })).toBeEnabled();
    await user.click(within(drawer).getByRole('button', { name: 'Download image' }));
    expect(actions.onDownloadSingle).toHaveBeenCalledTimes(2);
    expect(within(drawer).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes only the drawer on Escape inside the shoot dialog', async () => {
    const onShootOpenChange = vi.fn();
    render(<Dialog open onOpenChange={onShootOpenChange}><DialogContent><DialogTitle>Shoot details</DialogTitle><DialogDescription>Property media</DialogDescription><Row actions={options()} /></DialogContent></Dialog>);
    const { user, drawer } = await openDrawer();
    await user.keyboard('{Escape}');
    finishCloseAnimation(drawer);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'File actions' })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Shoot details' })).toBeVisible();
    expect(onShootOpenChange).not.toHaveBeenCalled();
  });
});
