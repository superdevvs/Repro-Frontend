import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { MediaGrid } from './MediaGrid';
import { canInteractWithMediaFile, canManageMediaVisibility, canReorderMediaFile, canSetMediaHero, canUseMediaDownload } from './mediaPresentationPermissions';

const files: MediaFile[] = [
  { id: '11', filename: 'visible.jpg', media_type: 'edited', workflowStage: 'verified', can_manage_visibility: true, can_set_hero: true },
  { id: '12', filename: 'hidden.jpg', media_type: 'edited', workflowStage: 'verified', is_hidden: true, can_manage_visibility: true, can_set_hero: false },
  { id: '13', filename: 'shared-readonly.jpg', media_type: 'edited', workflowStage: 'verified', can_manage_visibility: false, can_set_hero: false },
];
afterEach(cleanup);
describe('curation across ordinary and sortable grids/lists', () => {
  it.each(['grid', 'list'].flatMap(viewMode => [false, true].map(manual => ({ viewMode, manual }))))('rejects legacy original fallback in hidden customer $viewMode manual=$manual', ({ viewMode, manual }) => {
    const original = 'https://media.test/private-original.jpg';
    const hidden: MediaFile = { ...files[1], thumb: original, url: original, original_url: original, web_url: original, media_curation_scope: 'customer' };
    const { container } = render(<MediaGrid files={[hidden]} viewMode={viewMode as 'grid' | 'list'} selectedFiles={new Set()} canSelect={false} onSelectionChange={vi.fn()}
      onFileClick={vi.fn()} getImageUrl={() => original} getSrcSet={() => `${original} 600w`} isImage={() => true} isClient
      sortOrder={manual ? 'manual' : 'time'} manualSortActive={manual} canManageVisibility={file => canManageMediaVisibility(file, 'client')} toggleFileHidden={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Unhide image' })).toBeTruthy();
    expect(container.innerHTML).not.toContain(original);
  });
  it.each(['client', 'salesRep'].flatMap(role => ['grid', 'list'].flatMap(viewMode => [false, true].map(manual => ({ role, viewMode, manual })))))('$role $viewMode manual=$manual uses per-file gates for hide, restore and hero', ({ role, viewMode, manual }) => {
    const toggleFileHidden = vi.fn(), onSetHero = vi.fn(), onFileClick = vi.fn();
    render(<MediaGrid files={files} viewMode={viewMode as 'grid' | 'list'} selectedFiles={new Set()} canSelect={false} onSelectionChange={vi.fn()}
      onFileClick={onFileClick} getImageUrl={() => '/image.jpg'} getSrcSet={() => ''} isImage={() => true} isClient={role === 'client'}
      sortOrder={manual ? 'manual' : 'time'} manualSortActive={manual} canManageVisibility={file => canManageMediaVisibility(file, role)}
      canSetHero={file => canSetMediaHero(file, role)} toggleFileHidden={toggleFileHidden} onSetHero={onSetHero}
      canReorderFile={file => canReorderMediaFile(file, role)}
      canInteractSingleMedia canInteractWithFile={file => canInteractWithMediaFile(file, role)} onToggleFavorite={vi.fn()} onAddComment={vi.fn()}
      canDownloadSingleMedia={file => canUseMediaDownload(file, role)} onDownloadSingle={vi.fn()} />);
    expect(screen.getByText('hidden.jpg')).toBeTruthy();
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
