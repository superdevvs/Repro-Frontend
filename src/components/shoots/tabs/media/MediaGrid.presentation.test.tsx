import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { MediaGrid } from './MediaGrid';
import { canInteractWithMediaFile, canManageMediaVisibility, canReorderMediaFile, canSetMediaHero, canUseMediaDownload } from './mediaPresentationPermissions';

const files: MediaFile[] = [
  { id: '11', filename: 'visible.jpg', media_type: 'edited', workflowStage: 'verified', can_manage_visibility: true, can_set_hero: true, can_download: true },
  { id: '12', filename: 'hidden.jpg', media_type: 'edited', workflowStage: 'verified', is_hidden: true, can_manage_visibility: true, can_set_hero: false },
  { id: '13', filename: 'shared-readonly.jpg', media_type: 'edited', workflowStage: 'verified', can_manage_visibility: false, can_set_hero: false, can_download: true },
];
beforeEach(() => {
  vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function finishDrawerClose(drawer: HTMLElement) {
  expect(drawer.getAttribute('data-state')).toBe('closed');
  // jsdom does not emit the browser's CSS animation completion events.
  for (const [element, animationName] of [[document.querySelector('[data-vaul-overlay]'), 'fadeOut'], [drawer, 'slideToBottom']] as const) {
    if (!element) continue;
    const event = new Event('animationend', { bubbles: true });
    Object.defineProperty(event, 'animationName', { value: animationName });
    fireEvent(element, event);
  }
}
describe('curation across ordinary and sortable grids/lists', () => {
  it.each(['grid', 'list'].flatMap(viewMode => [false, true].map(manual => ({ viewMode, manual }))))('rejects legacy original fallback in hidden customer $viewMode manual=$manual', async ({ viewMode, manual }) => {
    const original = 'https://media.test/private-original.jpg';
    const hidden: MediaFile = { ...files[1], thumb: original, url: original, original_url: original, web_url: original, media_curation_scope: 'customer' };
    const { container } = render(<MediaGrid files={[hidden]} viewMode={viewMode as 'grid' | 'list'} selectedFiles={new Set()} canSelect={false} onSelectionChange={vi.fn()}
      onFileClick={vi.fn()} getImageUrl={() => original} getSrcSet={() => `${original} 600w`} isImage={() => true} isClient
      sortOrder={manual ? 'manual' : 'time'} manualSortActive={manual} canManageVisibility={file => canManageMediaVisibility(file, 'client')} toggleFileHidden={vi.fn()} />);
    if (viewMode === 'list') fireEvent.click(screen.getByRole('button', { name: 'Media actions for hidden.jpg' }));
    expect(await screen.findByRole('button', { name: 'Unhide image' })).toBeTruthy();
    expect(container.innerHTML).not.toContain(original);
    expect(document.body.innerHTML).not.toContain(original);
  });
  it.each(['client', 'salesRep'].flatMap(role => ['grid', 'list'].flatMap(viewMode => [false, true].map(manual => ({ role, viewMode, manual })))))('$role $viewMode manual=$manual uses per-file gates for hide, restore and hero', async ({ role, viewMode, manual }) => {
    const toggleFileHidden = vi.fn(), onSetHero = vi.fn(), onFileClick = vi.fn();
    render(<MediaGrid files={files} viewMode={viewMode as 'grid' | 'list'} selectedFiles={new Set()} canSelect={false} onSelectionChange={vi.fn()}
      onFileClick={onFileClick} getImageUrl={() => '/image.jpg'} getSrcSet={() => ''} isImage={() => true} isClient={role === 'client'}
      sortOrder={manual ? 'manual' : 'time'} manualSortActive={manual} canManageVisibility={file => canManageMediaVisibility(file, role)}
      canSetHero={file => canSetMediaHero(file, role)} toggleFileHidden={toggleFileHidden} onSetHero={onSetHero}
      canReorderFile={file => canReorderMediaFile(file, role)}
      canInteractSingleMedia canInteractWithFile={file => canInteractWithMediaFile(file, role)} onToggleFavorite={vi.fn()} onAddComment={vi.fn()}
      canDownloadSingleMedia={file => canUseMediaDownload(file, role)} onDownloadSingle={vi.fn()} />);
    expect(screen.getByText('hidden.jpg')).toBeTruthy();
    if (viewMode === 'list') {
      expect(screen.queryByRole('button', { name: 'Download image' })).toBeNull();
      const openActions = async (filename: string) => {
        if (screen.queryByRole('dialog')) {
          const drawer = screen.getByRole('dialog');
          fireEvent.click(screen.getByRole('button', { name: 'Done' }));
          finishDrawerClose(drawer);
          await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        }
        fireEvent.click(screen.getByRole('button', { name: `Media actions for ${filename}` }));
        await screen.findByRole('dialog');
      };
      await openActions('visible.jpg');
      expect(screen.getAllByRole('button', { name: 'Hide image' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Set hero image' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Download image' })).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Like image' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Add comment' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Hide image' }));
      await openActions('hidden.jpg');
      expect(screen.queryByRole('button', { name: 'Set hero image' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Hide image' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Unhide image' }));
      await openActions('visible.jpg');
      fireEvent.click(screen.getByRole('button', { name: 'Set hero image' }));
      await openActions('shared-readonly.jpg');
      expect(screen.queryByRole('button', { name: 'Hide image' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Unhide image' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Set hero image' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
      expect(toggleFileHidden.mock.calls).toEqual([['11', true], ['12', false]]);
      expect(onSetHero).toHaveBeenCalledExactlyOnceWith('11');
      expect(onFileClick).not.toHaveBeenCalled();
      return;
    }
    expect(screen.getAllByRole('button', { name: 'Hide image' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Unhide image' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Set hero image' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Download image' })).toHaveLength(2);
    expect(screen.getAllByTitle('Like image')).toHaveLength(2);
    expect(screen.getAllByTitle('Add comment')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Hide image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unhide image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set hero image' }));
    expect(toggleFileHidden.mock.calls).toEqual([['11', true], ['12', false]]);
    expect(onSetHero).toHaveBeenCalledWith('11');
    expect(onFileClick).not.toHaveBeenCalled();
    if (viewMode === 'grid') expect(screen.getByRole('button', { name: 'Hide image' }).parentElement?.className).toContain('opacity-100 sm:opacity-0');
  });
});
